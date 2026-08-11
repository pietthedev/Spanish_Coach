/**
 * Dependency-free content validation functions
 * 
 * Validates course content without external dependencies.
 * Detects common content errors before publishing.
 */

import type {
  Course,
  Phrase,
  Lesson,
  Day,
  ContentId,
  ContentValidationResult,
  ValidationError,
  ValidationWarning
} from './types';

/**
 * Validate entire course structure
 */
export function validateCourse(course: Course): ContentValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check for duplicate IDs across all entities
  const allIds = new Set<ContentId>();
  
  // Check phrases
  for (const [id, phrase] of Object.entries(course.phrases)) {
    if (allIds.has(id)) {
      errors.push({
        code: 'DUPLICATE_ID',
        entityId: id,
        entityType: 'Phrase',
        message: `Duplicate ID found: ${id}`
      });
    }
    allIds.add(id);
    
    // Validate individual phrase
    const phraseErrors = validatePhrase(phrase);
    errors.push(...phraseErrors);
  }

  // Check exercises
  for (const [id, exercise] of Object.entries(course.exercises)) {
    if (allIds.has(id)) {
      errors.push({
        code: 'DUPLICATE_ID',
        entityId: id,
        entityType: 'Exercise',
        message: `Duplicate ID found: ${id}`
      });
    }
    allIds.add(id);
  }

  // Check days
  for (const day of course.days) {
    const dayErrors = validateDay(day, course.phrases);
    errors.push(...dayErrors);
  }

  // Check lesson dates are correct
  const dateErrors = checkLessonDates(course.days);
  errors.push(...dateErrors);

  // Check linguistic review status
  const reviewWarnings = checkLinguisticReviewStatus(course);
  warnings.push(...reviewWarnings);

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate a single phrase
 */
function validatePhrase(phrase: Phrase): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for missing translations
  if (!phrase.spanishText || phrase.spanishText.trim() === '') {
    errors.push({
      code: 'MISSING_TRANSLATION',
      entityId: phrase.id,
      entityType: 'Phrase',
      message: 'Missing Spanish text',
      fieldPath: 'spanishText'
    });
  }

  if (!phrase.englishMeaning || phrase.englishMeaning.trim() === '') {
    errors.push({
      code: 'MISSING_TRANSLATION',
      entityId: phrase.id,
      entityType: 'Phrase',
      message: 'Missing English meaning',
      fieldPath: 'englishMeaning'
    });
  }

  // Check for missing audio references for publishable content
  if (phrase.linguisticReviewStatus === 'approved') {
    if (!phrase.slowAudio || !phrase.slowAudio.filename) {
      errors.push({
        code: 'MISSING_AUDIO',
        entityId: phrase.id,
        entityType: 'Phrase',
        message: 'Missing slow audio reference for approved content',
        fieldPath: 'slowAudio'
      });
    }
    if (!phrase.normalAudio || !phrase.normalAudio.filename) {
      errors.push({
        code: 'MISSING_AUDIO',
        entityId: phrase.id,
        entityType: 'Phrase',
        message: 'Missing normal audio reference for approved content',
        fieldPath: 'normalAudio'
      });
    }
  }

  // Check for conflicts between accepted answers and critical semantic rules
  if (phrase.acceptedAlternatives && phrase.criticalConcepts) {
    for (const alt of phrase.acceptedAlternatives) {
      for (const concept of phrase.criticalConcepts) {
        // Simple check: if alternative contains a critical confusion, it's a conflict
        if (concept.commonConfusions.some(confusion => 
          alt.toLowerCase().includes(confusion.toLowerCase())
        )) {
          errors.push({
            code: 'ACCEPTED_ANSWER_CONFLICT',
            entityId: phrase.id,
            entityType: 'Phrase',
            message: `Accepted alternative "${alt}" conflicts with critical concept "${concept.slotId}"`,
            fieldPath: 'acceptedAlternatives'
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validate a day's content
 */
function validateDay(day: Day, phrases: Record<ContentId, Phrase>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check each lesson
  for (const lesson of day.lessons) {
    const lessonErrors = validateLesson(lesson, phrases);
    errors.push(...lessonErrors);
  }

  return errors;
}

/**
 * Validate a lesson
 */
function validateLesson(lesson: Lesson, phrases: Record<ContentId, Phrase>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check that normal lessons have no more than 3 productive chunks
  const productiveNewPhrases = lesson.newPhrases.filter(phraseId => {
    const phrase = phrases[phraseId];
    return phrase && phrase.isProductive;
  });

  if (productiveNewPhrases.length > 3) {
    errors.push({
      code: 'TOO_MANY_PRODUCTIVE_CHUNKS',
      entityId: lesson.id,
      entityType: 'Lesson',
      message: `Lesson has ${productiveNewPhrases.length} productive chunks (max 3 allowed)`,
      fieldPath: 'newPhrases'
    });
  }

  // Validate referenced phrases exist
  for (const phraseId of lesson.newPhrases) {
    if (!phrases[phraseId]) {
      errors.push({
        code: 'MISSING_PHRASE_REFERENCE',
        entityId: lesson.id,
        entityType: 'Lesson',
        message: `Referenced phrase ${phraseId} not found in course phrases`,
        fieldPath: 'newPhrases'
      });
    }
  }

  for (const phraseId of lesson.reviewPhrases) {
    if (!phrases[phraseId]) {
      errors.push({
        code: 'MISSING_PHRASE_REFERENCE',
        entityId: lesson.id,
        entityType: 'Lesson',
        message: `Referenced review phrase ${phraseId} not found in course phrases`,
        fieldPath: 'reviewPhrases'
      });
    }
  }

  return errors;
}

/**
 * Check for incorrect lesson dates
 */
function checkLessonDates(days: Day[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Days should be sequential starting from 1
  for (let i = 0; i < days.length; i++) {
    const expectedDayNumber = i + 1;
    const day = days[i];

    if (day.dayNumber !== expectedDayNumber) {
      errors.push({
        code: 'INCORRECT_DAY_NUMBER',
        entityId: day.id,
        entityType: 'Day',
        message: `Day number mismatch: expected ${expectedDayNumber}, got ${day.dayNumber}`,
        fieldPath: 'dayNumber'
      });
    }
  }

  return errors;
}

/**
 * Check linguistic review status across course
 */
function checkLinguisticReviewStatus(course: Course): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Count phrases by review status
  const statusCounts: Record<string, number> = {};
  
  for (const phrase of Object.values(course.phrases)) {
    const status = phrase.linguisticReviewStatus;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  // Warn if any content is not approved
  const pendingCount = statusCounts['pending_review'] || 0;
  const inProgressCount = statusCounts['review_in_progress'] || 0;
  const requiresRevisionCount = statusCounts['requires_revision'] || 0;

  if (pendingCount > 0) {
    warnings.push({
      code: 'PENDING_REVIEW',
      entityId: course.id,
      message: `${pendingCount} phrase(s) are pending linguistic review`
    });
  }

  if (inProgressCount > 0) {
    warnings.push({
      code: 'REVIEW_IN_PROGRESS',
      entityId: course.id,
      message: `${inProgressCount} phrase(s) are currently under review`
    });
  }

  if (requiresRevisionCount > 0) {
    warnings.push({
      code: 'REQUIRES_REVISION',
      entityId: course.id,
      message: `${requiresRevisionCount} phrase(s) require revision after review`
    });
  }

  // Warn if AI-generated content warning applies
  warnings.push({
    code: 'AI_GENERATED_CONTENT',
    entityId: course.id,
    message: 'This course contains AI-generated content requiring human Mexican-Spanish review'
  });

  return warnings;
}

/**
 * Check for missing linguistic review status
 */
export function checkMissingLinguisticReviewStatus(course: Course): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const phrase of Object.values(course.phrases)) {
    if (!phrase.linguisticReviewStatus) {
      errors.push({
        code: 'MISSING_REVIEW_STATUS',
        entityId: phrase.id,
        entityType: 'Phrase',
        message: 'Missing linguistic review status',
        fieldPath: 'linguisticReviewStatus'
      });
    }
  }

  return errors;
}

/**
 * Get all phrase IDs that need linguistic review
 */
export function getPhrasesNeedingReview(course: Course): ContentId[] {
  const needsReview: ContentId[] = [];

  for (const [id, phrase] of Object.entries(course.phrases)) {
    if (phrase.linguisticReviewStatus !== 'approved') {
      needsReview.push(id);
    }
  }

  return needsReview;
}

/**
 * Validate that all exercises reference valid phrases
 */
export function validateExerciseReferences(course: Course): ValidationError[] {
  const errors: ValidationError[] = [];
  const phraseIds = new Set(Object.keys(course.phrases));

  for (const [exerciseId, exercise] of Object.entries(course.exercises)) {
    // Check correct answers reference known phrases
    for (const answer of exercise.correctAnswers) {
      // Simple heuristic: if answer looks like a phrase ID, validate it
      if (answer.startsWith('phrase_') && !phraseIds.has(answer)) {
        errors.push({
          code: 'INVALID_PHRASE_REFERENCE',
          entityId: exerciseId,
          entityType: 'Exercise',
          message: `Exercise references non-existent phrase: ${answer}`,
          fieldPath: 'correctAnswers'
        });
      }
    }
  }

  return errors;
}
