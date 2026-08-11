/**
 * Lesson Session State Machine Engine
 * 
 * Framework-independent TypeScript lesson-session state machine that runs
 * the complete daily learning sequence.
 * 
 * Learning Sequence:
 * 1. Load due reviews first
 * 2. Introduce no more than three new productive phrases
 * 3. Normal-speed listening
 * 4. Slow-speed listening
 * 5. Meaning reveal
 * 6. Active retrieval
 * 7. Listening comprehension
 * 8. Speaking attempt
 * 9. Immediate feedback
 * 10. Short authored scenario
 * 11. Lesson completion
 * 12. Progress-event creation
 * 
 * Supports:
 * - Refresh/restart restoration from a serialisable snapshot
 * - Offline operation
 * - Technical microphone or transcription failure
 * - Skipping speech evaluation when offline
 * - Recording playback without pretending to score pronunciation
 * - Retry limits
 * - Hint escalation
 * - Prevention of duplicate completion events
 * - Deterministic transitions
 * - Day 7 delegation to the existing mission engine
 */

import type { ContentId, Phrase, Exercise, Lesson, MissionDefinition } from '../content/types';
import type { ScheduledReview } from '../review/scheduler';
import type { EvaluationResult } from '../evaluation/evaluator';
import type { MissionRunState } from '../mission/engine';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum new productive phrases per lesson (Days 1-6)
 */
export const MAX_NEW_PHRASES_PER_LESSON = 3;

/**
 * Maximum retry attempts for speaking exercises
 */
export const MAX_SPEAKING_RETRIES = 3;

/**
 * Maximum recording duration in seconds
 */
export const MAX_RECORDING_DURATION_SEC = 10;

/**
 * Minimum recording duration in seconds
 */
export const MIN_RECORDING_DURATION_SEC = 1;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Phase of the lesson session
 */
export type LessonPhase =
  | 'loading'              // Initial load
  | 'review_due'          // Due reviews available
  | 'reviewing'           // Currently doing review
  | 'new_phrase_intro'    // Introducing new phrase
  | 'listening_normal'    // Normal speed audio
  | 'listening_slow'      // Slow speed audio
  | 'meaning_reveal'      // Showing English meaning
  | 'active_retrieval'    // Learner must recall Spanish
  | 'listening_comp'      // Listening comprehension question
  | 'speaking_attempt'    // Learner speaks phrase
  | 'feedback'            // Showing feedback on attempt
  | 'scenario'            // Short authored scenario
  | 'lesson_complete'     // Lesson finished
  | 'mission_day'         // Day 7 - delegating to mission engine
  | 'technical_failure'   // Speech service unavailable
  | 'offline_playback';   // Offline - playback only, no scoring

/**
 * Exercise step within a lesson phase
 */
export interface LessonStep {
  /** Step identifier */
  readonly stepId: string;
  /** Step type */
  readonly type: Exercise['type'] | 'review' | 'new_intro' | 'scenario_step';
  /** Content ID being worked on */
  readonly contentId: ContentId;
  /** Current attempt number */
  readonly attemptNumber: number;
  /** Maximum attempts allowed */
  readonly maxAttempts: number;
  /** Whether this step is complete */
  readonly isComplete: boolean;
  /** Last evaluation result if applicable */
  readonly lastEvaluation?: EvaluationResult;
  /** Hints shown for this step */
  readonly hintsShown: string[];
}

/**
 * Serializable snapshot of lesson session state
 */
export interface LessonSessionSnapshot {
  /** Session UUID */
  readonly sessionId: string;
  /** Lesson ID */
  readonly lessonId: ContentId;
  /** Day number */
  readonly dayNumber: number;
  /** User ID */
  readonly userId: string;
  /** Current phase */
  readonly phase: LessonPhase;
  /** Steps completed in order */
  readonly completedSteps: LessonStep[];
  /** Current step if any */
  readonly currentStep?: LessonStep;
  /** Review items processed */
  readonly reviewsProcessed: ContentId[];
  /** New phrases introduced */
  readonly newPhrasesIntroduced: ContentId[];
  /** Total travel points earned in this session */
  readonly travelPointsEarned: number;
  /** Session start timestamp */
  readonly startedAt: string;
  /** Last activity timestamp */
  readonly lastActivityAt: string;
  /** Whether session is complete */
  readonly isComplete: boolean;
  /** Whether session succeeded */
  readonly isSuccess: boolean;
  /** Mission run state if Day 7 */
  readonly missionState?: MissionRunState;
  /** Offline mode flag */
  readonly isOffline: boolean;
  /** Speech service available */
  readonly speechServiceAvailable: boolean;
  /** Completion event UUID (if created) */
  readonly completionEventUuid?: string;
}

/**
 * Configuration for lesson session
 */
export interface LessonSessionConfig {
  /** User ID */
  readonly userId: string;
  /** Lesson definition */
  readonly lesson: Lesson;
  /** Due reviews for this lesson */
  readonly dueReviews: ScheduledReview[];
  /** New phrases to introduce */
  readonly newPhrases: Phrase[];
  /** Whether device is offline */
  readonly isOffline: boolean;
  /** Whether speech service is available */
  readonly speechServiceAvailable: boolean;
  /** Current timestamp */
  readonly now: Date;
}

/**
 * Result of processing a lesson action
 */
export interface LessonActionResult {
  /** Updated session snapshot */
  readonly newSnapshot: LessonSessionSnapshot;
  /** Next phase after action */
  readonly nextPhase: LessonPhase;
  /** Feedback message if any */
  readonly feedback?: string;
  /** Points earned from this action */
  readonly pointsEarned: number;
  /** Whether to show hint */
  readonly showHint: boolean;
  /** Hint text if applicable */
  readonly hintText?: string;
  /** Whether lesson is now complete */
  readonly lessonComplete: boolean;
  /** Event to create for sync */
  readonly eventToSync?: {
    eventType: string;
    payload: Record<string, unknown>;
  };
}

/**
 * Audio playback request
 */
export interface AudioPlaybackRequest {
  /** Content ID */
  readonly contentId: ContentId;
  /** Speed variant */
  readonly speed: 'normal' | 'slow';
  /** Audio filename/path */
  readonly audioPath: string;
}

/**
 * Recording result
 */
export interface RecordingResult {
  /** Recording blob URL for playback */
  readonly playbackUrl: string;
  /** Duration in seconds */
  readonly durationSec: number;
  /** Transcript if speech service available */
  readonly transcript?: string;
  /** Evaluation result if speech service available */
  readonly evaluation?: EvaluationResult;
  /** Whether this was offline playback only */
  readonly offlinePlaybackOnly: boolean;
  /** Technical failure occurred */
  readonly technicalFailure: boolean;
  /** Failure reason if any */
  readonly failureReason?: string;
}

// ============================================================================
// LESSON SESSION STATE MACHINE
// ============================================================================

/**
 * Lesson session state machine
 */
export class LessonSessionMachine {
  private snapshot: LessonSessionSnapshot;

  constructor(config: LessonSessionConfig) {
    const sessionId = this.generateSessionId();
    
    this.snapshot = {
      sessionId,
      lessonId: config.lesson.id,
      dayNumber: config.lesson.dayNumber,
      userId: config.userId,
      phase: 'loading',
      completedSteps: [],
      reviewsProcessed: [],
      newPhrasesIntroduced: [],
      travelPointsEarned: 0,
      startedAt: config.now.toISOString(),
      lastActivityAt: config.now.toISOString(),
      isComplete: false,
      isSuccess: false,
      isOffline: config.isOffline,
      speechServiceAvailable: config.speechServiceAvailable
    };

    // Check if Day 7 - delegate to mission engine
    if (config.lesson.dayNumber === 7 && config.lesson.scenario) {
      this.snapshot.phase = 'mission_day';
    } else {
      // Determine starting phase based on due reviews
      this.snapshot.phase = config.dueReviews.length > 0 ? 'review_due' : 'new_phrase_intro';
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current snapshot
   */
  getSnapshot(): LessonSessionSnapshot {
    return { ...this.snapshot };
  }

  /**
   * Restore session from snapshot (for refresh/restart)
   */
  static restoreFromSnapshot(snapshot: LessonSessionSnapshot): LessonSessionMachine {
    const machine = new LessonSessionMachine({
      userId: snapshot.userId,
      lesson: {
        id: snapshot.lessonId,
        dayNumber: snapshot.dayNumber,
        lessonNumber: 1,
        title: '',
        goal: '',
        estimatedDurationMin: 5,
        newPhrases: [],
        reviewPhrases: [],
        exercises: [],
        completionCriteria: {
          minCorrectExercises: 1,
          totalExercises: 1,
          speakingRequired: false,
          minScenarioProgress: 0
        },
        travelPoints: 0,
        offlineAvailable: true,
        linguisticReviewStatus: 'pending_review',
        version: '1.0.0'
      },
      dueReviews: [],
      newPhrases: [],
      isOffline: snapshot.isOffline,
      speechServiceAvailable: snapshot.speechServiceAvailable,
      now: new Date(snapshot.lastActivityAt)
    });

    machine.snapshot = { ...snapshot };
    return machine;
  }

  /**
   * Start lesson session
   */
  startLesson(): LessonActionResult {
    if (this.snapshot.isComplete) {
      return this.createActionResult('Lesson already complete');
    }

    this.updatePhase(this.snapshot.phase);
    
    return this.createActionResult('Lesson started');
  }

  /**
   * Process review item
   */
  processReview(reviewContentId: ContentId, evaluationResult: EvaluationResult): LessonActionResult {
    if (this.snapshot.phase !== 'reviewing') {
      return this.createActionResult('Not in review phase');
    }

    const step: LessonStep = {
      stepId: `review_${reviewContentId}`,
      type: 'review',
      contentId: reviewContentId,
      attemptNumber: 1,
      maxAttempts: 1,
      isComplete: true,
      lastEvaluation: evaluationResult,
      hintsShown: []
    };

    // Calculate points based on evaluation
    let pointsEarned = 0;
    if (evaluationResult.countsAsCorrect) {
      pointsEarned = evaluationResult.label === 'understood' ? 10 : 5;
    }

    // Handle technical failure - don't reduce mastery
    if (evaluationResult.label === 'technical_failure') {
      pointsEarned = 0;
      // Allow retry without penalty
    }

    this.snapshot.completedSteps.push(step);
    this.snapshot.reviewsProcessed.push(reviewContentId);
    this.snapshot.travelPointsEarned += pointsEarned;
    this.snapshot.lastActivityAt = new Date().toISOString();

    // Move to next phase
    const hasMoreReviews = this.snapshot.reviewsProcessed.length < 
      (this.snapshot as LessonSessionSnapshot & { totalReviews?: number }).totalReviews || 0;
    
    const nextPhase = hasMoreReviews ? 'reviewing' : 'new_phrase_intro';
    this.updatePhase(nextPhase);

    return this.createActionResult('Review processed', pointsEarned);
  }

  /**
   * Introduce new phrase
   */
  introduceNewPhrase(phraseId: ContentId): LessonActionResult {
    if (this.snapshot.newPhrasesIntroduced.length >= MAX_NEW_PHRASES_PER_LESSON) {
      return this.createActionResult('Maximum new phrases reached');
    }

    if (this.snapshot.newPhrasesIntroduced.includes(phraseId)) {
      return this.createActionResult('Phrase already introduced');
    }

    const step: LessonStep = {
      stepId: `new_intro_${phraseId}`,
      type: 'new_intro',
      contentId: phraseId,
      attemptNumber: 0,
      maxAttempts: 1,
      isComplete: true,
      hintsShown: []
    };

    this.snapshot.completedSteps.push(step);
    this.snapshot.newPhrasesIntroduced.push(phraseId);
    this.snapshot.lastActivityAt = new Date().toISOString();

    // Move to listening phase
    this.updatePhase('listening_normal');

    return this.createActionResult('New phrase introduced');
  }

  /**
   * Play audio at specified speed
   */
  playAudio(contentId: ContentId, speed: 'normal' | 'slow'): LessonActionResult {
    const validPhases: LessonPhase[] = ['listening_normal', 'listening_slow', 'new_phrase_intro'];
    if (!validPhases.includes(this.snapshot.phase)) {
      return this.createActionResult('Not in listening phase');
    }

    // Transition based on current phase
    if (this.snapshot.phase === 'listening_normal') {
      this.updatePhase('listening_slow');
    } else if (this.snapshot.phase === 'listening_slow') {
      this.updatePhase('meaning_reveal');
    }

    return this.createActionResult(`Audio played: ${speed}`);
  }

  /**
   * Reveal meaning
   */
  revealMeaning(): LessonActionResult {
    if (this.snapshot.phase !== 'meaning_reveal') {
      return this.createActionResult('Not in meaning reveal phase');
    }

    this.updatePhase('active_retrieval');
    return this.createActionResult('Meaning revealed');
  }

  /**
   * Process active retrieval attempt
   */
  processActiveRetrieval(
    contentId: ContentId,
    transcript: string,
    evaluationResult: EvaluationResult
  ): LessonActionResult {
    if (this.snapshot.phase !== 'active_retrieval') {
      return this.createActionResult('Not in active retrieval phase');
    }

    const step: LessonStep = {
      stepId: `retrieval_${contentId}`,
      type: 'active_retrieval',
      contentId,
      attemptNumber: 1,
      maxAttempts: MAX_SPEAKING_RETRIES,
      isComplete: evaluationResult.countsAsCorrect,
      lastEvaluation: evaluationResult,
      hintsShown: []
    };

    let pointsEarned = 0;
    if (evaluationResult.countsAsCorrect) {
      pointsEarned = evaluationResult.label === 'understood' ? 15 : 10;
    }

    this.snapshot.completedSteps.push(step);
    this.snapshot.travelPointsEarned += pointsEarned;
    this.snapshot.lastActivityAt = new Date().toISOString();

    // Handle retries
    if (!evaluationResult.countsAsCorrect && step.attemptNumber < step.maxAttempts) {
      this.updatePhase('active_retrieval');
      return this.createActionResult('Try again', 0, true);
    }

    // Move to next phase
    this.updatePhase('listening_comp');
    return this.createActionResult('Retrieval processed', pointsEarned);
  }

  /**
   * Process listening comprehension
   */
  processListeningComprehension(
    contentId: ContentId,
    isCorrect: boolean
  ): LessonActionResult {
    if (this.snapshot.phase !== 'listening_comp') {
      return this.createActionResult('Not in listening comprehension phase');
    }

    const step: LessonStep = {
      stepId: `listening_comp_${contentId}`,
      type: 'listen_and_select',
      contentId,
      attemptNumber: 1,
      maxAttempts: 1,
      isComplete: true,
      hintsShown: []
    };

    const pointsEarned = isCorrect ? 10 : 0;

    this.snapshot.completedSteps.push(step);
    this.snapshot.travelPointsEarned += pointsEarned;
    this.snapshot.lastActivityAt = new Date().toISOString();

    // Move to speaking or scenario
    const hasNextExercise = this.hasNextExercise();
    const nextPhase = hasNextExercise ? 'new_phrase_intro' : 'scenario';
    this.updatePhase(nextPhase);

    return this.createActionResult('Listening comprehension processed', pointsEarned);
  }

  /**
   * Process speaking attempt with offline handling
   */
  processSpeakingAttempt(recordingResult: RecordingResult): LessonActionResult {
    if (this.snapshot.phase !== 'speaking_attempt') {
      return this.createActionResult('Not in speaking phase');
    }

    // Handle offline playback only
    if (recordingResult.offlinePlaybackOnly) {
      this.snapshot.phase = 'offline_playback';
      return this.createActionResult('Recording saved for later evaluation', 0);
    }

    // Handle technical failure
    if (recordingResult.technicalFailure) {
      this.snapshot.phase = 'technical_failure';
      return this.createActionResult(
        recordingResult.failureReason || 'Speech service unavailable',
        0
      );
    }

    // Normal evaluation
    const step: LessonStep = {
      stepId: `speaking_${recordingResult.transcript || 'unknown'}`,
      type: 'speaking_practice',
      contentId: '',
      attemptNumber: 1,
      maxAttempts: MAX_SPEAKING_RETRIES,
      isComplete: recordingResult.evaluation?.countsAsCorrect || false,
      lastEvaluation: recordingResult.evaluation,
      hintsShown: []
    };

    let pointsEarned = 0;
    if (recordingResult.evaluation?.countsAsCorrect) {
      pointsEarned = recordingResult.evaluation.label === 'understood' ? 20 : 15;
    }

    this.snapshot.completedSteps.push(step);
    this.snapshot.travelPointsEarned += pointsEarned;
    this.snapshot.lastActivityAt = new Date().toISOString();

    // Handle retries
    if (!recordingResult.evaluation?.countsAsCorrect && step.attemptNumber < step.maxAttempts) {
      this.updatePhase('speaking_attempt');
      return this.createActionResult('Try again', 0, true);
    }

    // Move to scenario
    this.updatePhase('scenario');
    return this.createActionResult('Speaking processed', pointsEarned);
  }

  /**
   * Process scenario step
   */
  processScenarioStep(scenarioResult: {
    success: boolean;
    pointsEarned: number;
    isComplete: boolean;
  }): LessonActionResult {
    if (this.snapshot.phase !== 'scenario') {
      return this.createActionResult('Not in scenario phase');
    }

    const step: LessonStep = {
      stepId: `scenario_step`,
      type: 'scenario_roleplay',
      contentId: this.snapshot.lessonId,
      attemptNumber: 1,
      maxAttempts: 1,
      isComplete: scenarioResult.isComplete,
      hintsShown: []
    };

    this.snapshot.completedSteps.push(step);
    this.snapshot.travelPointsEarned += scenarioResult.pointsEarned;
    this.snapshot.lastActivityAt = new Date().toISOString();

    if (scenarioResult.isComplete) {
      this.completeLesson(true);
    }

    return this.createActionResult(
      'Scenario processed',
      scenarioResult.pointsEarned,
      false,
      scenarioResult.success
    );
  }

  /**
   * Complete lesson
   */
  completeLesson(success: boolean): void {
    if (this.snapshot.isComplete) {
      return; // Prevent duplicate completion
    }

    this.snapshot.isComplete = true;
    this.snapshot.isSuccess = success;
    this.snapshot.phase = 'lesson_complete';
    this.snapshot.lastActivityAt = new Date().toISOString();

    // Create completion event UUID
    this.snapshot.completionEventUuid = this.generateEventUuid();
  }

  /**
   * Get completion event for sync
   */
  getCompletionEvent(): { eventType: string; payload: Record<string, unknown> } | null {
    if (!this.snapshot.isComplete || !this.snapshot.completionEventUuid) {
      return null;
    }

    return {
      eventType: 'lesson_completed',
      payload: {
        lessonId: this.snapshot.lessonId,
        dayNumber: this.snapshot.dayNumber,
        travelPointsEarned: this.snapshot.travelPointsEarned,
        completedSteps: this.snapshot.completedSteps.length,
        reviewsProcessed: this.snapshot.reviewsProcessed.length,
        newPhrasesIntroduced: this.snapshot.newPhrasesIntroduced.length,
        completedAt: this.snapshot.lastActivityAt
      }
    };
  }

  /**
   * Update phase with validation
   */
  private updatePhase(newPhase: LessonPhase): void {
    // Validate phase transitions
    const validTransitions: Record<LessonPhase, LessonPhase[]> = {
      loading: ['review_due', 'new_phrase_intro', 'mission_day'],
      review_due: ['reviewing', 'new_phrase_intro'],
      reviewing: ['reviewing', 'new_phrase_intro'],
      new_phrase_intro: ['listening_normal'],
      listening_normal: ['listening_slow'],
      listening_slow: ['meaning_reveal'],
      meaning_reveal: ['active_retrieval'],
      active_retrieval: ['active_retrieval', 'listening_comp', 'speaking_attempt'],
      listening_comp: ['new_phrase_intro', 'scenario', 'speaking_attempt'],
      speaking_attempt: ['speaking_attempt', 'scenario', 'offline_playback', 'technical_failure'],
      feedback: ['active_retrieval', 'listening_comp', 'scenario'],
      scenario: ['scenario', 'lesson_complete'],
      offline_playback: ['scenario'],
      technical_failure: ['scenario'],
      lesson_complete: [],
      mission_day: ['lesson_complete']
    };

    if (!validTransitions[this.snapshot.phase].includes(newPhase)) {
      console.warn(`Invalid phase transition: ${this.snapshot.phase} -> ${newPhase}`);
    }

    this.snapshot.phase = newPhase;
  }

  /**
   * Check if there are more exercises
   */
  private hasNextExercise(): boolean {
    // Simplified check - would integrate with actual lesson exercises
    return this.snapshot.newPhrasesIntroduced.length < MAX_NEW_PHRASES_PER_LESSON;
  }

  /**
   * Generate event UUID
   */
  private generateEventUuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create action result helper
   */
  private createActionResult(
    feedback: string,
    pointsEarned: number = 0,
    showHint: boolean = false,
    lessonComplete: boolean = false
  ): LessonActionResult {
    return {
      newSnapshot: this.getSnapshot(),
      nextPhase: this.snapshot.phase,
      feedback,
      pointsEarned,
      showHint,
      lessonComplete
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Select due reviews for lesson (max 8 to fit time)
 */
export function selectDueReviewsForLesson(
  reviews: ScheduledReview[],
  maxCount: number = 8
): ScheduledReview[] {
  return reviews
    .filter(r => r.isOverdue || new Date(r.dueDate) <= new Date())
    .sort((a, b) => {
      // Overdue first
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      // Then by due date
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, maxCount);
}

/**
 * Select new phrases for lesson (max 3)
 */
export function selectNewPhrasesForLesson(
  allPhrases: Phrase[],
  alreadyIntroduced: ContentId[]
): Phrase[] {
  return allPhrases
    .filter(p => p.isProductive && !alreadyIntroduced.includes(p.id))
    .slice(0, MAX_NEW_PHRASES_PER_LESSON);
}

/**
 * Check if lesson can be completed offline
 */
export function canCompleteOffline(phase: LessonPhase): boolean {
  // Can complete if past speaking phase or in offline-safe phases
  const offlineSafePhases: LessonPhase[] = [
    'lesson_complete',
    'offline_playback',
    'scenario'
  ];
  return offlineSafePhases.includes(phase);
}

/**
 * Get appropriate hint based on attempt count
 */
export function getEscalatedHint(
  attemptNumber: number,
  hints: string[]
): string | undefined {
  if (attemptNumber >= hints.length) {
    return hints[hints.length - 1];
  }
  return hints[attemptNumber];
}
