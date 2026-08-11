/**
 * Forgiving Answer Evaluator
 * 
 * Pure TypeScript answer evaluation without external dependencies.
 * Evaluates learner responses against expected answers with intelligent tolerance.
 * 
 * Evaluation order:
 * 1. Normalised exact accepted answer
 * 2. Curated accepted variants
 * 3. Required semantic concepts
 * 4. Critical-concept protection
 * 5. Conservative similarity check
 * 6. Incomplete or unmatched result
 */

import type { SemanticConcept, CriticalConcept } from '../content/types';

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Safe result labels for evaluation outcomes
 */
export type EvaluationResultLabel =
  | 'understood'           // Exact or near-exact match
  | 'also_correct'         // Accepted variant
  | 'minor_issue'          // Small error but meaning preserved
  | 'meaning_changing_error' // Critical concept wrong
  | 'incomplete'           // Missing required content
  | 'unmatched'            // No match found
  | 'technical_failure';   // Could not evaluate (empty, noise, etc.)

/**
 * Full evaluation result
 */
export interface EvaluationResult {
  /** Result label */
  readonly label: EvaluationResultLabel;
  /** Confidence score 0-1 */
  readonly confidence: number;
  /** Which accepted answer matched (if any) */
  readonly matchedAnswer?: string;
  /** Which critical concept failed (if any) */
  readonly failedCriticalConcept?: string;
  /** Which required concept is missing (if any) */
  readonly missingConcept?: string;
  /** Feedback message for learner */
  readonly feedback?: string;
  /** Whether to count as correct for progression */
  readonly countsAsCorrect: boolean;
}

// ============================================================================
// NORMALISATION FUNCTIONS
// ============================================================================

/**
 * Normalise text for comparison
 * Ignores: capitalisation, punctuation, extra whitespace, diacritics
 */
export function normaliseText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let normalised = text.trim();

  // Lowercase
  normalised = normalised.toLowerCase();

  // Remove diacritics (accents)
  normalised = normalised.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Remove punctuation except essential meaning-changing marks
  normalised = normalised.replace(/[¿?¡!.,;:()"\[\]{}]/g, '');

  // Normalise whitespace
  normalised = normalised.replace(/\s+/g, ' ').trim();

  return normalised;
}

/**
 * Check if text contains negation
 */
export function hasNegation(text: string): boolean {
  const normalised = normaliseText(text);
  const negationWords = ['no', 'nunca', 'jamás', 'ni', 'tampoco'];
  return negationWords.some(word => 
    new RegExp(`\\b${word}\\b`).test(normalised)
  );
}

/**
 * Extract numbers from text
 */
export function extractNumbers(text: string): string[] {
  const matches = text.match(/\d+(?:[.,]\d+)?/g);
  return matches || [];
}

/**
 * Check for critical preposition usage
 */
export function checkPreposition(text: string, preposition: 'con' | 'sin'): boolean {
  const normalised = normaliseText(text);
  const pattern = new RegExp(`\\b${preposition}\\b`);
  return pattern.test(normalised);
}

// ============================================================================
// EVALUATION LOGIC
// ============================================================================

/**
 * Evaluate a learner response against expected answers
 */
export function evaluateAnswer(
  transcript: string,
  correctAnswers: string[],
  acceptedVariants: string[] = [],
  requiredConcepts: SemanticConcept[] = [],
  criticalConcepts: CriticalConcept[] = []
): EvaluationResult {
  // Handle empty or invalid transcripts
  if (!transcript || transcript.trim() === '') {
    return {
      label: 'technical_failure',
      confidence: 0,
      countsAsCorrect: false,
      feedback: 'No speech detected. Please try again.'
    };
  }

  const normalisedTranscript = normaliseText(transcript);

  // Check for obvious noise or technical failure
  if (normalisedTranscript.length < 2) {
    return {
      label: 'technical_failure',
      confidence: 0,
      countsAsCorrect: false,
      feedback: 'Could not understand. Please speak clearly.'
    };
  }

  // STEP 1: Check normalised exact accepted answers
  for (const answer of correctAnswers) {
    const normalisedAnswer = normaliseText(answer);
    
    if (normalisedTranscript === normalisedAnswer) {
      return {
        label: 'understood',
        confidence: 1.0,
        matchedAnswer: answer,
        countsAsCorrect: true,
        feedback: 'Excellent!'
      };
    }

    // Check if transcript contains the answer (for longer responses)
    if (normalisedTranscript.includes(normalisedAnswer) && normalisedAnswer.length > 3) {
      return {
        label: 'understood',
        confidence: 0.95,
        matchedAnswer: answer,
        countsAsCorrect: true,
        feedback: 'Correct!'
      };
    }
  }

  // STEP 2: Check curated accepted variants
  for (const variant of acceptedVariants) {
    const normalisedVariant = normaliseText(variant);
    
    if (normalisedTranscript === normalisedVariant || 
        normalisedTranscript.includes(normalisedVariant)) {
      return {
        label: 'also_correct',
        confidence: 0.9,
        matchedAnswer: variant,
        countsAsCorrect: true,
        feedback: 'Good!'
      };
    }
  }

  // STEP 3: Check required semantic concepts
  if (requiredConcepts.length > 0) {
    const missingConcept = findMissingConcept(normalisedTranscript, requiredConcepts);
    if (missingConcept) {
      return {
        label: 'incomplete',
        confidence: 0.5,
        missingConcept: missingConcept.conceptId,
        countsAsCorrect: false,
        feedback: `Try to include: ${missingConcept.description}`
      };
    }
  }

  // STEP 4: Critical concept protection - check for meaning-changing errors
  const criticalFailure = checkCriticalConcepts(transcript, criticalConcepts);
  if (criticalFailure) {
    return {
      label: 'meaning_changing_error',
      confidence: 0.8,
      failedCriticalConcept: criticalFailure.slotId,
      countsAsCorrect: false,
      feedback: criticalFailure.errorMessage
    };
  }

  // STEP 5: Conservative similarity check
  const similarityResult = checkSimilarity(normalisedTranscript, correctAnswers);
  if (similarityResult.isMatch) {
    return {
      label: 'minor_issue',
      confidence: similarityResult.confidence,
      matchedAnswer: similarityResult.matchedAnswer,
      countsAsCorrect: true,
      feedback: 'Almost there!'
    };
  }

  // STEP 6: Unmatched
  return {
    label: 'unmatched',
    confidence: 0,
    countsAsCorrect: false,
    feedback: 'Not quite. Listen and try again.'
  };
}

/**
 * Find missing required semantic concept
 */
function findMissingConcept(
  transcript: string,
  concepts: SemanticConcept[]
): SemanticConcept | undefined {
  for (const concept of concepts) {
    if (!concept.required) {
      continue;
    }

    const hasExpression = concept.expressions.some(expr => {
      const normalisedExpr = normaliseText(expr);
      return transcript.includes(normalisedExpr);
    });

    if (!hasExpression) {
      return concept;
    }
  }

  return undefined;
}

/**
 * Check critical concepts for meaning-changing errors
 */
function checkCriticalConcepts(
  transcript: string,
  criticalConcepts: CriticalConcept[]
): CriticalConcept | undefined {
  const normalisedTranscript = normaliseText(transcript);

  for (const concept of criticalConcepts) {
    // Check negation errors
    if (concept.slotType === 'negation') {
      const expectsNegation = concept.correctValue === 'no';
      const hasNegationInTranscript = hasNegation(transcript);

      if (expectsNegation && !hasNegationInTranscript) {
        return concept;
      }
      if (!expectsNegation && hasNegationInTranscript && concept.commonConfusions.includes('')) {
        return concept;
      }
    }

    // Check con vs sin
    if (concept.slotType === 'preposition' && 
        concept.slotId === 'con_vs_sin') {
      const expectsCon = checkPreposition(transcript, 'con');
      const expectsSin = checkPreposition(transcript, 'sin');
      
      if (concept.correctValue === 'con' && !expectsCon && expectsSin) {
        return concept;
      }
      if (concept.correctValue === 'sin' && !expectsSin && expectsCon) {
        return concept;
      }
    }

    // Check number/price differences
    if (concept.slotType === 'number' || concept.slotType === 'price') {
      const transcriptNumbers = extractNumbers(transcript);
      const correctNumbers = extractNumbers(concept.correctValue);
      
      // If correct answer has specific numbers and transcript has different ones
      if (correctNumbers.length > 0 && transcriptNumbers.length > 0) {
        const numbersDifferent = !correctNumbers.every(n => 
          transcriptNumbers.includes(n)
        );
        if (numbersDifferent) {
          return concept;
        }
      }
    }

    // Check destination/location changes
    if (concept.slotType === 'destination') {
      // Simple heuristic: check if common confusions appear instead of correct value
      const normalisedCorrect = normaliseText(concept.correctValue);
      const hasCorrect = normalisedTranscript.includes(normalisedCorrect);
      
      if (!hasCorrect) {
        const hasConfusion = concept.commonConfusions.some(confusion => {
          const normalisedConfusion = normaliseText(confusion);
          return normalisedTranscript.includes(normalisedConfusion);
        });
        
        if (hasConfusion) {
          return concept;
        }
      }
    }

    // Check person/tense markers
    if (concept.slotType === 'person' || concept.slotType === 'tense') {
      const normalisedCorrect = normaliseText(concept.correctValue);
      const hasCorrect = normalisedTranscript.includes(normalisedCorrect);
      
      if (!hasCorrect) {
        const hasConfusion = concept.commonConfusions.some(confusion => {
          const normalisedConfusion = normaliseText(confusion);
          return normalisedTranscript.includes(normalisedConfusion);
        });
        
        if (hasConfusion) {
          return concept;
        }
      }
    }
  }

  return undefined;
}

/**
 * Conservative similarity check using word overlap
 */
function checkSimilarity(
  transcript: string,
  correctAnswers: string[]
): { isMatch: boolean; confidence: number; matchedAnswer: string } {
  const transcriptWords = new Set(transcript.split(' '));

  for (const answer of correctAnswers) {
    const answerWords = new Set(normaliseText(answer).split(' '));
    
    if (answerWords.size === 0) {
      continue;
    }

    // Calculate word overlap
    let overlapCount = 0;
    for (const word of answerWords) {
      if (transcriptWords.has(word)) {
        overlapCount++;
      }
    }

    const overlapRatio = overlapCount / answerWords.size;

    // High overlap but not exact match = minor issue
    if (overlapRatio >= 0.7 && answerWords.size >= 3) {
      return {
        isMatch: true,
        confidence: overlapRatio * 0.8,
        matchedAnswer: answer
      };
    }

    // Very high overlap on short phrases
    if (overlapRatio >= 0.8 && answerWords.size < 3) {
      return {
        isMatch: true,
        confidence: overlapRatio * 0.85,
        matchedAnswer: answer
      };
    }
  }

  return { isMatch: false, confidence: 0, matchedAnswer: '' };
}

/**
 * Batch evaluate multiple possible interpretations
 */
export function batchEvaluate(
  transcripts: string[],
  correctAnswers: string[],
  acceptedVariants: string[] = [],
  requiredConcepts: SemanticConcept[] = [],
  criticalConcepts: CriticalConcept[] = []
): EvaluationResult {
  // Return best result from all transcripts
  let bestResult: EvaluationResult | null = null;

  for (const transcript of transcripts) {
    const result = evaluateAnswer(
      transcript,
      correctAnswers,
      acceptedVariants,
      requiredConcepts,
      criticalConcepts
    );

    if (!bestResult || result.confidence > bestResult.confidence) {
      bestResult = result;
    }

    // Early exit on perfect match
    if (result.label === 'understood' && result.confidence === 1.0) {
      return result;
    }
  }

  return bestResult || {
    label: 'technical_failure',
    confidence: 0,
    countsAsCorrect: false
  };
}
