/**
 * Versioned Content Model for Spanish Coach
 * 
 * Framework-independent TypeScript types for course content.
 * All content marked as requiring professional Mexican-Spanish human review.
 */

// ============================================================================
// CORE IDENTIFIERS AND METADATA
// ============================================================================

/**
 * Unique identifier for any content entity
 */
export type ContentId = string;

/**
 * Version string following semver convention
 */
export type ContentVersion = string;

/**
 * Linguistic review status - required before production publishing
 */
export type LinguisticReviewStatus = 
  | 'pending_review'      // Awaiting professional Mexican-Spanish review
  | 'review_in_progress'  // Currently being reviewed
  | 'approved'            // Approved by native speaker
  | 'requires_revision';  // Needs revision after review

/**
 * Offline availability status
 */
export type OfflineAvailability = 
  | 'not_available'       // Requires network
  | 'available_offline'   // Fully cached
  | 'partial_offline';    // Some features require network

// ============================================================================
// AUDIO REFERENCES
// ============================================================================

/**
 * Reference to audio file - deterministic path or manifest key
 * Do not store actual audio data in content model
 */
export interface AudioReference {
  /** Unique key for this audio asset */
  readonly audioKey: string;
  /** Deterministic filename pattern: `${phraseId}_${speed}.mp3` */
  readonly filename: string;
  /** Speed variant */
  readonly speed: 'slow' | 'normal';
  /** Voice ID used for generation */
  readonly voiceId: string;
  /** Duration in milliseconds (for validation) */
  readonly durationMs?: number;
  /** Content hash for cache invalidation */
  readonly contentHash?: string;
}

// ============================================================================
// PHRASE MODEL
// ============================================================================

/**
 * Formailty/register level for Mexican Spanish
 */
export type FormalityRegister = 
  | 'formal'        // Usted form, polite
  | 'informal'      // Tú form, casual
  | 'neutral'       // Works in both contexts
  | 'regional';     // Specifically Mexican colloquial

/**
 * Usage context where this phrase is appropriate
 */
export type UsageContext = 
  | 'greeting'
  | 'introduction'
  | 'politeness'
  | 'question'
  | 'statement'
  | 'request'
  | 'response'
  | 'emergency'
  | 'transaction'
  | 'direction_giving'
  | 'direction_receiving'
  | 'shopping'
  | 'restaurant'
  | 'accommodation'
  | 'transport'
  | 'health'
  | 'general';

/**
 * A single teachable phrase chunk
 */
export interface Phrase {
  /** Unique identifier across all content */
  readonly id: ContentId;
  
  /** Mexican Spanish text - the target language */
  readonly spanishText: string;
  
  /** Optional pronunciation aid using English approximations */
  readonly pronunciationAid?: string;
  
  /** English meaning/translation */
  readonly englishMeaning: string;
  
  /** Slow audio reference */
  readonly slowAudio: AudioReference;
  
  /** Normal speed audio reference */
  readonly normalAudio: AudioReference;
  
  /** Usage context(s) where this phrase applies */
  readonly usageContexts: UsageContext[];
  
  /** Formality level */
  readonly formality: FormalityRegister;
  
  /** Accepted alternative phrasings (synonyms that mean the same) */
  readonly acceptedAlternatives?: string[];
  
  /** Required semantic concepts that must be present for correct meaning */
  readonly requiredSemanticConcepts?: SemanticConcept[];
  
  /** Critical concepts that change meaning if wrong - protected from fuzzy matching */
  readonly criticalConcepts?: CriticalConcept[];
  
  /** Common learner errors for this phrase */
  readonly commonLearnerErrors?: LearnerError[];
  
  /** Feedback rules specific to this phrase */
  readonly feedbackRules?: FeedbackRule[];
  
  /** Likely replies when this phrase is used (for bidirectional learning) */
  readonly likelyReplies?: string[];
  
  /** Review metadata */
  readonly reviewMetadata?: ReviewMetadata;
  
  /** Whether this phrase should be available offline */
  readonly offlineAvailable: boolean;
  
  /** Linguistic review status - MUST be 'approved' for production */
  readonly linguisticReviewStatus: LinguisticReviewStatus;
  
  /** Content version for cache invalidation */
  readonly version: ContentVersion;
  
  /** Day number in curriculum (1-71) */
  readonly dayNumber: number;
  
  /** Lesson number within the day */
  readonly lessonNumber: number;
  
  /** Position within lesson (for ordering) */
  readonly positionInLesson: number;
  
  /** Whether this is a productive phrase (learner should say it) or receptive only */
  readonly isProductive: boolean;
  
  /** Maximum times this phrase can appear as new in one lesson (usually 1) */
  readonly maxNewPerLesson: number;
}

// ============================================================================
// SEMANTIC CONCEPTS
// ============================================================================

/**
 * A semantic concept that must be present for correct meaning
 */
export interface SemanticConcept {
  /** Identifier for this concept */
  readonly conceptId: string;
  /** Description of what must be expressed */
  readonly description: string;
  /** Keywords or patterns that express this concept */
  readonly expressions: string[];
  /** Whether absence makes the answer incomplete */
  readonly required: boolean;
}

/**
 * Critical concept that changes meaning if altered
 * These are protected from fuzzy matching tolerance
 */
export interface CriticalConcept {
  /** Identifier for this critical slot */
  readonly slotId: string;
  /** Type of critical value */
  readonly slotType: CriticalSlotType;
  /** The correct value */
  readonly correctValue: string;
  /** Common incorrect substitutions */
  readonly commonConfusions: string[];
  /** Error message if this concept is wrong */
  readonly errorMessage: string;
}

/**
 * Types of meaning-changing critical slots
 */
export type CriticalSlotType =
  | 'negation'           // sí vs no, con vs sin
  | 'number'             // quantities, prices
  | 'price'              // monetary amounts
  | 'time'               // times, dates
  | 'destination'        // locations, directions
  | 'preposition'        // con/sin, a/de, en/por
  | 'allergy_term'       // allergic to X
  | 'urgency'            // emergency level
  | 'person'            // first/second/third person
  | 'tense'             // past/present/future
  | 'gender_number';    // masculine/feminine, singular/plural

// ============================================================================
// LEARNER ERRORS AND FEEDBACK
// ============================================================================

/**
 * Common error learners make with a phrase
 */
export interface LearnerError {
  /** Error pattern or mistake */
  readonly errorPattern: string;
  /** Why it's wrong */
  readonly explanation: string;
  /** How to correct it */
  readonly correction: string;
  /** Severity level */
  readonly severity: 'minor' | 'meaning_changing';
}

/**
 * Rule for providing feedback on learner attempts
 */
export interface FeedbackRule {
  /** Condition trigger */
  readonly condition: FeedbackCondition;
  /** Feedback message to show */
  readonly feedback: string;
  /** Whether to show immediately or after completion */
  readonly timing: 'immediate' | 'after_completion';
  /** Feedback type */
  readonly feedbackType: 'encouragement' | 'correction' | 'hint' | 'explanation';
}

/**
 * Conditions that trigger feedback
 */
export type FeedbackCondition =
  | 'exact_match'
  | 'minor_pronunciation_issue'
  | 'missing_word'
  | 'extra_word'
  | 'wrong_word_order'
  | 'negation_error'
  | 'critical_substitution'
  | 'incomplete_response'
  | 'technical_failure';

// ============================================================================
// EXERCISES
// ============================================================================

/**
 * Exercise type for active practice
 */
export type ExerciseType =
  | 'listen_and_select'      // Hear audio, choose correct meaning
  | 'select_and_listen'      // See meaning, choose correct Spanish
  | 'active_retrieval'       // See situation, produce Spanish
  | 'listening_comprehension' // Hear Spanish, answer question
  | 'speaking_practice'      // Repeat or respond verbally
  | 'scenario_roleplay'      // Multi-turn dialogue
  | 'fill_blank'            // Complete the phrase
  | 'match_pairs';          // Match Spanish to English

/**
 * A single exercise instance
 */
export interface Exercise {
  /** Unique exercise identifier */
  readonly id: ContentId;
  /** Type of exercise */
  readonly type: ExerciseType;
  /** Prompt shown to learner */
  readonly prompt: string;
  /** Expected correct answer(s) */
  readonly correctAnswers: string[];
  /** Acceptable variants beyond exact answers */
  readonly acceptedVariants?: string[];
  /** Hints to show if struggling */
  readonly hints?: string[];
  /** Audio reference if listening is involved */
  readonly audioReference?: AudioReference;
  /** Scenario context if applicable */
  readonly scenarioContext?: ScenarioContext;
  /** Points awarded for correct answer */
  readonly points: number;
  /** Time limit in seconds (optional) */
  readonly timeLimitSec?: number;
}

// ============================================================================
// SCENARIOS
// ============================================================================

/**
 * Context for a role-play scenario
 */
export interface ScenarioContext {
  /** Setting description */
  readonly setting: string;
  /** Other character(s) in the scene */
  readonly characters: string[];
  /** Learner's goal in this scenario */
  readonly goal: string;
  /** Starting situation */
  readonly openingLine: string;
}

/**
 * Authored branching scenario node
 */
export interface ScenarioNode {
  /** Node identifier */
  readonly nodeId: string;
  /** What the other character says/does */
  readonly characterLine: string;
  /** Audio reference for character line */
  readonly audioReference?: AudioReference;
  /** Allowed learner intents at this point */
  readonly allowedIntents: ScenarioIntent[];
  /** Hint to show if learner is stuck */
  readonly hint?: string;
  /** Where to go on success */
  readonly successTransition: string;
  /** Where to go on partial success */
  readonly partialTransition?: string;
  /** Where to go on failure */
  readonly repairTransition?: string;
  /** Maximum retries before showing answer */
  readonly maxRetries: number;
}

/**
 * An intent the learner can express
 */
export interface ScenarioIntent {
  /** Intent identifier */
  readonly intentId: string;
  /** Description of what the learner wants to communicate */
  readonly description: string;
  /** Accepted Spanish variants expressing this intent */
  readonly acceptedVariants: string[];
  /** Required semantic concepts for this intent */
  readonly requiredConcepts: SemanticConcept[];
}

// ============================================================================
// LESSON MODEL
// ============================================================================

/**
 * A single lesson within a day
 */
export interface Lesson {
  /** Unique lesson identifier */
  readonly id: ContentId;
  /** Day number (1-71) */
  readonly dayNumber: number;
  /** Lesson number within day */
  readonly lessonNumber: number;
  /** Human-readable title */
  readonly title: string;
  /** Brief description of lesson goal */
  readonly goal: string;
  /** Estimated duration in minutes */
  readonly estimatedDurationMin: number;
  /** Phrases introduced as new in this lesson */
  readonly newPhrases: ContentId[];
  /** Phrases scheduled for review in this lesson */
  readonly reviewPhrases: ContentId[];
  /** Exercises in order */
  readonly exercises: Exercise[];
  /** Final scenario/mission step if applicable */
  readonly scenario?: ScenarioNode[];
  /** Success criteria for lesson completion */
  readonly completionCriteria: CompletionCriteria;
  /** Travel Points awarded on completion */
  readonly travelPoints: number;
  /** Achievement unlocked on completion (if any) */
  readonly achievementUnlocked?: ContentId;
  /** Offline availability */
  readonly offlineAvailable: boolean;
  /** Linguistic review status */
  readonly linguisticReviewStatus: LinguisticReviewStatus;
  /** Content version */
  readonly version: ContentVersion;
}

/**
 * Criteria for completing a lesson
 */
export interface CompletionCriteria {
  /** Minimum exercises to complete correctly */
  readonly minCorrectExercises: number;
  /** Total exercises in lesson */
  readonly totalExercises: number;
  /** Whether speaking practice is required */
  readonly speakingRequired: boolean;
  /** Minimum scenario progress (0-100) */
  readonly minScenarioProgress: number;
}

// ============================================================================
// COURSE STRUCTURE
// ============================================================================

/**
 * A phase grouping multiple days
 */
export interface Phase {
  /** Phase identifier */
  readonly id: ContentId;
  /** Phase number (1-5) */
  readonly phaseNumber: number;
  /** Human-readable name */
  readonly name: string;
  /** Description of phase focus */
  readonly description: string;
  /** First day number in phase */
  readonly startDay: number;
  /** Last day number in phase */
  readonly endDay: number;
  /** Learning objectives for this phase */
  readonly objectives: string[];
}

/**
 * A day of learning content
 */
export interface Day {
  /** Day identifier */
  readonly id: ContentId;
  /** Day number (1-71) */
  readonly dayNumber: number;
  /** Human-readable date label */
  readonly dateLabel: string;
  /** Day theme/focus */
  readonly theme: string;
  /** Lessons in this day */
  readonly lessons: Lesson[];
  /** Whether this is a mission day */
  readonly isMissionDay: boolean;
  /** Whether this is a review/checkpoint day */
  readonly isReviewDay: boolean;
  /** Mission definition if applicable */
  readonly mission?: MissionDefinition;
  /** Offline availability */
  readonly offlineAvailable: boolean;
}

/**
 * Complete course structure
 */
export interface Course {
  /** Course identifier */
  readonly id: ContentId;
  /** Course name */
  readonly name: string;
  /** Content version */
  readonly version: ContentVersion;
  /** Target language */
  readonly targetLanguage: 'es-MX';
  /** Source language */
  readonly sourceLanguage: 'en-ZA';
  /** Phases in order */
  readonly phases: Phase[];
  /** Days in order (1-71) */
  readonly days: Day[];
  /** All phrases indexed by ID */
  readonly phrases: Record<ContentId, Phrase>;
  /** All exercises indexed by ID */
  readonly exercises: Record<ContentId, Exercise>;
  /** Metadata about content creation */
  readonly metadata: CourseMetadata;
}

/**
 * Course metadata
 */
export interface CourseMetadata {
  /** Date content was created */
  readonly createdDate: string;
  /** Date content was last updated */
  readonly lastUpdated: string;
  /** Linguistic review status for entire course */
  readonly linguisticReviewStatus: LinguisticReviewStatus;
  /** Names of reviewers */
  readonly reviewers?: string[];
  /** Content authoring tool version */
  readonly authoringVersion: string;
}

// ============================================================================
// REVIEW METADATA
// ============================================================================

/**
 * Spaced repetition scheduling metadata
 */
export interface ReviewMetadata {
  /** Initial interval in days */
  readonly initialIntervalDays: number;
  /** Interval multiplier on success */
  readonly successMultiplier: number;
  /** Interval reduction on failure */
  readonly failureReduction: number;
  /** Minimum interval in days */
  readonly minIntervalDays: number;
  /** Maximum interval in days */
  readonly maxIntervalDays: number;
  /** Ease factor (default 2.5) */
  readonly easeFactor: number;
}

// ============================================================================
// MISSION DEFINITION
// ============================================================================

/**
 * State machine definition for a mission
 */
export interface MissionDefinition {
  /** Mission identifier */
  readonly missionId: ContentId;
  /** Human-readable name */
  readonly name: string;
  /** Mission description/goal */
  readonly goal: string;
  /** Explicit states in the mission */
  readonly states: MissionState[];
  /** Initial state */
  readonly initialState: string;
  /** Success condition */
  readonly successCondition: MissionSuccessCondition;
  /** Failure recovery behavior */
  readonly failureRecovery: FailureRecovery;
  /** Maximum total retries */
  readonly maxTotalRetries: number;
  /** Hints available */
  readonly hints: MissionHint[];
}

/**
 * A state in the mission state machine
 */
export interface MissionState {
  /** State identifier */
  readonly stateId: string;
  /** What happens in this state */
  readonly description: string;
  /** Character line or situation prompt */
  readonly prompt: string;
  /** Audio for the prompt */
  readonly promptAudio?: AudioReference;
  /** Allowed intents from learner */
  readonly allowedIntents: ScenarioIntent[];
  /** Transitions based on learner response */
  readonly transitions: MissionTransition[];
  /** Hint for this state */
  readonly hint?: string;
}

/**
 * Transition between mission states
 */
export interface MissionTransition {
  /** Trigger condition */
  readonly trigger: 'success' | 'partial' | 'failure' | 'timeout';
  /** Next state ID */
  readonly nextStateId: string;
  /** Response to show learner */
  readonly response?: string;
  /** Response audio */
  readonly responseAudio?: AudioReference;
}

/**
 * Success condition for mission completion
 */
export interface MissionSuccessCondition {
  /** Final state that indicates success */
  readonly finalStateId: string;
  /** Minimum states visited */
  readonly minStatesVisited: number;
  /** Maximum failures allowed */
  readonly maxFailures: number;
}

/**
 * Failure recovery configuration
 */
export interface FailureRecovery {
  /** Whether to allow continuing after repeated failures */
  readonly allowContinue: boolean;
  /** Number of failures before suggesting skip */
  readonly failuresBeforeSkip: number;
  /** Message to show on repeated failure */
  readonly retryMessage: string;
  /** Whether to show full solution after too many failures */
  readonly showSolution: boolean;
}

/**
 * Hint for mission
 */
export interface MissionHint {
  /** When to show this hint */
  readonly triggerState?: string;
  /** Number of failed attempts before showing */
  readonly attemptsBeforeShow: number;
  /** Hint text */
  readonly hintText: string;
  /** Hint audio */
  readonly hintAudio?: AudioReference;
}

// ============================================================================
// CONTENT VALIDATION
// ============================================================================

/**
 * Validation result for content
 */
export interface ContentValidationResult {
  /** Whether content passed validation */
  readonly isValid: boolean;
  /** List of validation errors */
  readonly errors: ValidationError[];
  /** List of warnings (non-blocking) */
  readonly warnings: ValidationWarning[];
}

/**
 * A validation error
 */
export interface ValidationError {
  /** Error code */
  readonly code: string;
  /** Entity ID where error occurred */
  readonly entityId: ContentId;
  /** Entity type */
  readonly entityType: string;
  /** Error message */
  readonly message: string;
  /** Field path if applicable */
  readonly fieldPath?: string;
}

/**
 * A validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  readonly code: string;
  /** Entity ID where warning occurred */
  readonly entityId: ContentId;
  /** Warning message */
  readonly message: string;
}

// ============================================================================
// WARNING: CODEX/QWEN CONTENT MARKER
// ============================================================================

/**
 * Marker indicating content was generated by AI and requires human review.
 * ALL Codex- or Qwen-authored Spanish MUST be marked as requiring
 * professional Mexican-Spanish human review before production publishing.
 */
export const AI_GENERATED_CONTENT_WARNING = `
================================================================================
IMPORTANT: This content was generated by AI (Codex/Qwen) and has NOT been
reviewed by a native Mexican Spanish speaker.

BEFORE PUBLISHING:
1. Have a professional Mexican Spanish linguist review ALL Spanish text
2. Verify cultural appropriateness for Mexican context
3. Confirm pronunciation aids are accurate for South African English speakers
4. Test audio recordings with native speakers
5. Update linguisticReviewStatus to 'approved' only after human review

DO NOT use this content in production without human linguistic review.
================================================================================
`;
