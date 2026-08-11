/**
 * Evaluator Test Fixtures
 * 
 * Dependency-free test fixtures for the answer evaluator.
 * Covers all required scenarios without external test frameworks.
 */

import { evaluateAnswer, normaliseText } from '../domain/evaluation/evaluator';
import type { SemanticConcept, CriticalConcept } from '../content/types';

// ============================================================================
// TEST RESULT TYPE
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

const testFixtures: Array<{
  name: string;
  transcript: string;
  correctAnswers: string[];
  acceptedVariants?: string[];
  requiredConcepts?: SemanticConcept[];
  criticalConcepts?: CriticalConcept[];
  expectedResultLabel: string;
  description: string;
}> = [
  // --- EXACT ANSWERS ---
  {
    name: 'exact_match_simple',
    transcript: 'Hola',
    correctAnswers: ['Hola'],
    expectedResultLabel: 'understood',
    description: 'Exact match should return understood'
  },
  {
    name: 'exact_match_phrase',
    transcript: 'Buenos días',
    correctAnswers: ['Buenos días'],
    expectedResultLabel: 'understood',
    description: 'Exact multi-word match'
  },
  
  // --- ACCEPTED VARIANTS ---
  {
    name: 'accepted_variant',
    transcript: 'De nada',
    correctAnswers: ['De nada'],
    acceptedVariants: ['Por nada', 'Con gusto', 'No hay de qué'],
    expectedResultLabel: 'understood',
    description: 'Exact match takes precedence'
  },
  {
    name: 'variant_match',
    transcript: 'Por nada',
    correctAnswers: ['De nada'],
    acceptedVariants: ['Por nada', 'Con gusto'],
    expectedResultLabel: 'also_correct',
    description: 'Accepted variant should be also_correct'
  },
  
  // --- DIACRITICS ---
  {
    name: 'diacritics_ignored',
    transcript: 'Hola',
    correctAnswers: ['Hóla'],
    expectedResultLabel: 'understood',
    description: 'Diacritics should be ignored in matching'
  },
  {
    name: 'diacritics_in_transcript',
    transcript: 'Buenos Días',
    correctAnswers: ['Buenos días'],
    expectedResultLabel: 'understood',
    description: 'Capitalisation and diacritics normalized'
  },
  
  // --- CAPITALISATION ---
  {
    name: 'case_insensitive',
    transcript: 'hola',
    correctAnswers: ['Hola'],
    expectedResultLabel: 'understood',
    description: 'Case should be ignored'
  },
  {
    name: 'mixed_case',
    transcript: 'HoLa',
    correctAnswers: ['Hola'],
    expectedResultLabel: 'understood',
    description: 'Mixed case normalized'
  },
  
  // --- PUNCTUATION ---
  {
    name: 'punctuation_ignored',
    transcript: '¡Hola!',
    correctAnswers: ['Hola'],
    expectedResultLabel: 'understood',
    description: 'Exclamation marks ignored'
  },
  {
    name: 'question_marks',
    transcript: '¿Cómo se llama?',
    correctAnswers: ['¿Cómo se llama?'],
    expectedResultLabel: 'understood',
    description: 'Question marks handled'
  },
  {
    name: 'extra_punctuation',
    transcript: 'Gracias.',
    correctAnswers: ['Gracias'],
    expectedResultLabel: 'understood',
    description: 'Trailing punctuation ignored'
  },
  
  // --- OPTIONAL WORDS ---
  {
    name: 'optional_subject',
    transcript: 'Yo me llamo Juan',
    correctAnswers: ['Me llamo Juan'],
    expectedResultLabel: 'minor_issue',
    description: 'Optional subject pronoun added'
  },
  
  // --- PARTIAL PHRASES ---
  {
    name: 'partial_response',
    transcript: 'Buenos',
    correctAnswers: ['Buenos días'],
    expectedResultLabel: 'unmatched',
    description: 'Incomplete phrase should not match'
  },
  
  // --- NEGATION (CRITICAL) ---
  {
    name: 'negation_missing',
    transcript: 'Hablo mucho español',
    correctAnswers: ['No hablo mucho español'],
    criticalConcepts: [{
      slotId: 'negation_present',
      slotType: 'negation',
      correctValue: 'no',
      commonConfusions: [''],
      errorMessage: 'Missing negation changes meaning'
    }],
    expectedResultLabel: 'meaning_changing_error',
    description: 'Missing negation is meaning-changing'
  },
  {
    name: 'negation_added',
    transcript: 'No hablo español',
    correctAnswers: ['Hablo español'],
    criticalConcepts: [{
      slotId: 'negation_absent',
      slotType: 'negation',
      correctValue: '',
      commonConfusions: ['no'],
      errorMessage: 'Added negation reverses meaning'
    }],
    expectedResultLabel: 'meaning_changing_error',
    description: 'Added negation reverses meaning'
  },
  
  // --- CRITICAL-WORD SUBSTITUTIONS ---
  {
    name: 'con_vs_sin',
    transcript: 'Sin permiso',
    correctAnswers: ['Con permiso'],
    criticalConcepts: [{
      slotId: 'con_vs_sin',
      slotType: 'preposition',
      correctValue: 'con',
      commonConfusions: ['sin'],
      errorMessage: '"Sin permiso" means without permission'
    }],
    expectedResultLabel: 'meaning_changing_error',
    description: 'Con/sin substitution is critical'
  },
  {
    name: 'mas_vs_menos',
    transcript: 'Menos despacio',
    correctAnswers: ['Más despacio'],
    criticalConcepts: [{
      slotId: 'mas_vs_menos',
      slotType: 'number',
      correctValue: 'más',
      commonConfusions: ['menos'],
      errorMessage: 'Más/menos are opposites'
    }],
    expectedResultLabel: 'meaning_changing_error',
    description: 'Más/menos substitution is critical'
  },
  
  // --- NUMBER DIFFERENCES ---
  {
    name: 'number_different',
    transcript: 'Son las tres',
    correctAnswers: ['Son las dos'],
    criticalConcepts: [{
      slotId: 'time_value',
      slotType: 'time',
      correctValue: 'dos',
      commonConfusions: ['tres', 'cuatro'],
      errorMessage: 'Different time stated'
    }],
    expectedResultLabel: 'meaning_changing_error',
    description: 'Number difference is meaning-changing'
  },
  
  // --- DESTINATIONS ---
  {
    name: 'destination_wrong',
    transcript: 'Voy a Guadalajara',
    correctAnswers: ['Voy a México City'],
    criticalConcepts: [{
      slotId: 'destination',
      slotType: 'destination',
      correctValue: 'México City',
      commonConfusions: ['Guadalajara', 'Monterrey'],
      errorMessage: 'Wrong destination'
    }],
    expectedResultLabel: 'meaning_changing_error',
    description: 'Wrong destination is critical'
  },
  
  // --- EMPTY TRANSCRIPTS ---
  {
    name: 'empty_transcript',
    transcript: '',
    correctAnswers: ['Hola'],
    expectedResultLabel: 'technical_failure',
    description: 'Empty transcript is technical failure'
  },
  {
    name: 'whitespace_only',
    transcript: '   ',
    correctAnswers: ['Hola'],
    expectedResultLabel: 'technical_failure',
    description: 'Whitespace-only is technical failure'
  },
  
  // --- NOISY TRANSCRIPTS ---
  {
    name: 'noise_only',
    transcript: 'um uh',
    correctAnswers: ['Hola'],
    expectedResultLabel: 'unmatched',
    description: 'Noise should not match'
  },
  {
    name: 'partial_with_noise',
    transcript: 'um hola um',
    correctAnswers: ['Hola'],
    expectedResultLabel: 'understood',
    description: 'Key word with noise can match'
  },
  
  // --- ALTERNATE VALID SPANISH ---
  {
    name: 'synonym_valid',
    transcript: 'Mucho gusto',
    correctAnswers: ['Encantado'],
    acceptedVariants: ['Mucho gusto', 'El gusto es mío'],
    expectedResultLabel: 'also_correct',
    description: 'Valid synonym via accepted variants'
  },
];

// ============================================================================
// TEST RUNNER
// ============================================================================

function runTests(): TestResult[] {
  const results: TestResult[] = [];

  for (const fixture of testFixtures) {
    const result = evaluateAnswer(
      fixture.transcript,
      fixture.correctAnswers,
      fixture.acceptedVariants || [],
      fixture.requiredConcepts || [],
      fixture.criticalConcepts || []
    );

    const passed = result.label === fixture.expectedResultLabel;
    
    results.push({
      name: fixture.name,
      passed,
      expected: fixture.expectedResultLabel,
      actual: result.label,
      details: fixture.description
    });
  }

  return results;
}

// ============================================================================
// NORMALISATION TESTS
// ============================================================================

function runNormalisationTests(): TestResult[] {
  const tests: Array<{ input: string; expected: string }> = [
    { input: '¡HOLA!', expected: 'hola' },
    { input: 'Buenos Días', expected: 'buenos dias' },
    { input: '  Gracias  ', expected: 'gracias' },
    { input: '¿Cómo está?', expected: 'como esta' },
    { input: 'Niño', expected: 'nino' },
  ];

  return tests.map(t => {
    const actual = normaliseText(t.input);
    return {
      name: `normalise_${t.input.replace(/\s+/g, '_')}`,
      passed: actual === t.expected,
      expected: t.expected,
      actual
    };
  });
}

// ============================================================================
// MAIN
// ============================================================================

export function runAllEvaluatorTests(): void {
  console.log('=== Answer Evaluator Test Fixtures ===\n');

  const evalResults = runTests();
  const normResults = runNormalisationTests();
  const allResults = [...evalResults, ...normResults];

  const passed = allResults.filter(r => r.passed).length;
  const failed = allResults.filter(r => !r.passed).length;

  console.log(`Total: ${allResults.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    for (const result of allResults) {
      if (!result.passed) {
        console.log(`  - ${result.name}: expected "${result.expected}", got "${result.actual}"`);
        if (result.details) {
          console.log(`    ${result.details}`);
        }
      }
    }
  } else {
    console.log('All tests passed!');
  }
}

// Run if executed directly
if (require.main === module) {
  runAllEvaluatorTests();
}
