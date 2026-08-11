/**
 * Local Progress Types and IndexedDB Design
 * 
 * TypeScript types for learner data stored locally in IndexedDB.
 * Designed for Dexie compatibility but without importing it.
 * 
 * IMPORTANT: Every locally stored learner record MUST be partitioned by
 * authenticated Supabase user/profile ID - NOT by display name or email.
 */

import type { ContentId } from '../content/types';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Supabase Auth User ID - used as partition key
 * DO NOT use email or display name
 */
export type UserId = string;

/**
 * Device identifier for sync tracking
 */
export type DeviceId = string;

/**
 * Unique event UUID for idempotent sync
 */
export type EventUuid = string;

// ============================================================================
// LEARNER PROFILE
// ============================================================================

/**
 * Local learner profile (partitioned by userId)
 */
export interface LearnerProfile {
  /** Supabase user ID (partition key) */
  readonly userId: UserId;
  /** Display name chosen by learner */
  readonly displayName: string;
  /** Avatar identifier or color */
  readonly avatarId: string;
  /** Total Travel Points earned */
  readonly totalTravelPoints: number;
  /** Current streak count */
  readonly currentStreak: number;
  /** Longest streak achieved */
  readonly longestStreak: number;
  /** Last activity timestamp */
  readonly lastActivityAt: string;
  /** Created timestamp */
  readonly createdAt: string;
  /** Updated timestamp */
  readonly updatedAt: string;
}

// ============================================================================
// LESSON PROGRESS
// ============================================================================

/**
 * Lesson completion status
 */
export type LessonCompletionStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed';

/**
 * Lesson progress record
 */
export interface LessonProgress {
  /** Composite key: `${userId}_${lessonId}` */
  readonly id: string;
  /** User ID (partition key) */
  readonly userId: UserId;
  /** Lesson ID */
  readonly lessonId: ContentId;
  /** Day number */
  readonly dayNumber: number;
  /** Completion status */
  readonly status: LessonCompletionStatus;
  /** Current exercise index (if in progress) */
  readonly currentExerciseIndex?: number;
  /** Score achieved */
  readonly score: number;
  /** Travel Points earned */
  readonly travelPointsEarned: number;
  /** Completed at timestamp */
  readonly completedAt?: string;
  /** Created timestamp */
  readonly createdAt: string;
  /** Updated timestamp */
  readonly updatedAt: string;
}

// ============================================================================
// PHRASE MASTERY
// ============================================================================

/**
 * Phrase mastery record with spaced repetition data
 */
export interface PhraseMastery {
  /** Composite key: `${userId}_${phraseId}` */
  readonly id: string;
  /** User ID (partition key) */
  readonly userId: UserId;
  /** Phrase ID */
  readonly phraseId: ContentId;
  /** Mastery level (0-5) */
  readonly masteryLevel: number;
  /** Current review interval index */
  readonly intervalIndex: number;
  /** Ease factor */
  readonly easeFactor: number;
  /** Success count */
  readonly successCount: number;
  /** Failure count */
  readonly failureCount: number;
  /** Next review due date (ISO) */
  readonly nextReviewDate: string;
  /** Last reviewed date */
  readonly lastReviewedDate?: string;
  /** Created timestamp */
  readonly createdAt: string;
  /** Updated timestamp */
  readonly updatedAt: string;
}

// ============================================================================
// REVIEW SCHEDULE
// ============================================================================

/**
 * Scheduled review item
 */
export interface ReviewSchedule {
  /** Composite key: `${userId}_${contentId}` */
  readonly id: string;
  /** User ID (partition key) */
  readonly userId: UserId;
  /** Content/Phrase ID to review */
  readonly contentId: ContentId;
  /** Due date (ISO) */
  readonly dueDate: string;
  /** Whether already shown today */
  readonly shownToday: boolean;
  /** Priority score (for sorting) */
  readonly priority: number;
  /** Created timestamp */
  readonly createdAt: string;
  /** Updated timestamp */
  readonly updatedAt: string;
}

// ============================================================================
// ATTEMPTS AND RESULTS
// ============================================================================

/**
 * Attempt result type
 */
export type AttemptResultType =
  | 'correct'
  | 'incorrect'
  | 'partial'
  | 'technical_failure';

/**
 * Individual attempt record
 */
export interface Attempt {
  /** Auto-increment or UUID */
  readonly id: string;
  /** User ID (partition key) */
  readonly userId: UserId;
  /** Exercise or phrase ID */
  readonly contentId: ContentId;
  /** Type of attempt */
  readonly attemptType: 'exercise' | 'phrase' | 'mission_step';
  /** Result */
  readonly result: AttemptResultType;
  /** Confidence score if available */
  readonly confidence?: number;
  /** Transcript if speech was involved */
  readonly transcript?: string;
  /** Expected answer */
  readonly expectedAnswer?: string;
  /** Timestamp */
  readonly createdAt: string;
  /** Event UUID for sync deduplication */
  readonly eventUuid: EventUuid;
}

// ============================================================================
// MISSION PROGRESS
// ============================================================================

/**
 * Mission run state
 */
export interface MissionRun {
  /** Composite key: `${userId}_${missionId}_${runNumber}` */
  readonly id: string;
  /** User ID (partition key) */
  readonly userId: UserId;
  /** Mission ID */
  readonly missionId: ContentId;
  /** Run number (for retries) */
  readonly runNumber: number;
  /** Current state ID */
  readonly currentStateId: string;
  /** States visited */
  readonly visitedStates: string[];
  /** Total failures */
  readonly totalFailures: number;
  /** Is complete */
  readonly isComplete: boolean;
  /** Is success */
  readonly isSuccess: boolean;
  /** Started at */
  readonly startedAt: string;
  /** Completed at */
  readonly completedAt?: string;
  /** Event UUID for sync */
  readonly eventUuid: EventUuid;
}

// ============================================================================
// ACHIEVEMENTS
// ============================================================================

/**
 * Achievement record
 */
export interface Achievement {
  /** Achievement ID */
  readonly achievementId: ContentId;
  /** User ID (partition key) */
  readonly userId: UserId;
  /** Name */
  readonly name: string;
  /** Description */
  readonly description: string;
  /** Icon identifier */
  readonly iconId: string;
  /** Unlocked at */
  readonly unlockedAt?: string;
  /** Progress towards unlock (0-100) */
  readonly progress: number;
  /** Is unlocked */
  readonly isUnlocked: boolean;
  /** Created timestamp */
  readonly createdAt: string;
  /** Updated timestamp */
  readonly updatedAt: string;
}

// ============================================================================
// CATEGORY READINESS
// ============================================================================

/**
 * Category readiness estimate
 */
export interface CategoryReadiness {
  /** Composite key: `${userId}_${categoryId}` */
  readonly id: string;
  /** User ID (partition key) */
  readonly userId: UserId;
  /** Category ID (e.g., 'greetings', 'restaurant') */
  readonly categoryId: string;
  /** Readiness score (0-100) */
  readonly readinessScore: number;
  /** Phrases mastered in category */
  readonly phrasesMastered: number;
  /** Total phrases in category */
  readonly totalPhrases: number;
  /** Confidence band */
  readonly confidenceBand: 'low' | 'medium' | 'high';
  /** Last assessed */
  readonly lastAssessed: string;
  /** Created timestamp */
  readonly createdAt: string;
  /** Updated timestamp */
  readonly updatedAt: string;
}

// ============================================================================
// DEVICES
// ============================================================================

/**
 * Registered device for sync
 */
export interface Device {
  /** Device ID */
  readonly deviceId: DeviceId;
  /** User ID */
  readonly userId: UserId;
  /** Device name */
  readonly deviceName: string;
  /** Device type */
  readonly deviceType: 'mobile' | 'tablet' | 'desktop';
  /** Last synced at */
  readonly lastSyncedAt?: string;
  /** Created timestamp */
  readonly createdAt: string;
}

// ============================================================================
// PROGRESS EVENTS (OUTBOX)
// ============================================================================

/**
 * Progress event type
 */
export type ProgressEventType =
  | 'lesson_completed'
  | 'phrase_reviewed'
  | 'achievement_unlocked'
  | 'points_earned'
  | 'mission_completed'
  | 'streak_updated';

/**
 * Immutable progress event for outbox
 */
export interface ProgressEvent {
  /** Event UUID (primary key) */
  readonly eventUuid: EventUuid;
  /** User ID */
  readonly userId: UserId;
  /** Event type */
  readonly eventType: ProgressEventType;
  /** Event payload (JSON) */
  readonly payload: Record<string, unknown>;
  /** Client timestamp */
  readonly clientTimestamp: string;
  /** Server timestamp (after sync) */
  readonly serverTimestamp?: string;
  /** Sync status */
  readonly syncStatus: 'pending' | 'syncing' | 'acknowledged' | 'failed';
  /** Retry count */
  readonly retryCount: number;
  /** Last error message */
  readonly lastError?: string;
  /** Created timestamp */
  readonly createdAt: string;
}

// ============================================================================
// INDEXEDDB SCHEMA DEFINITION
// ============================================================================

/**
 * Dexie-compatible database schema definition
 * 
 * NOTE: This is a schema definition, not an actual Dexie import.
 * When integrating, use this schema with Dexie:
 * 
 * ```typescript
 * const db = new Dexie('SpanishCoachDB') as EnhancedDatabase;
 * db.version(1).stores({
 *   profiles: 'userId, displayName',
 *   lessonProgress: '[userId+lessonId], userId, status, completedAt',
 *   phraseMastery: '[userId+phraseId], userId, nextReviewDate',
 *   reviewSchedules: '[userId+contentId], userId, dueDate, priority',
 *   attempts: '++id, userId, contentId, createdAt, eventUuid',
 *   missionRuns: 'id, userId, missionId, isComplete, eventUuid',
 *   achievements: '[userId+achievementId], userId, isUnlocked',
 *   categoryReadiness: '[userId+categoryId], userId, readinessScore',
 *   devices: 'deviceId, userId, lastSyncedAt',
 *   progressEvents: 'eventUuid, userId, syncStatus, createdAt'
 * });
 * ```
 */
export interface DatabaseSchema {
  /** Learner profiles */
  profiles: LearnerProfile;
  /** Lesson progress */
  lessonProgress: LessonProgress;
  /** Phrase mastery with SRS data */
  phraseMastery: PhraseMastery;
  /** Review schedules */
  reviewSchedules: ReviewSchedule;
  /** Attempt history */
  attempts: Attempt;
  /** Mission runs */
  missionRuns: MissionRun;
  /** Achievements */
  achievements: Achievement;
  /** Category readiness estimates */
  categoryReadiness: CategoryReadiness;
  /** Registered devices */
  devices: Device;
  /** Outbox for sync events */
  progressEvents: ProgressEvent;
}

// ============================================================================
// FUTURE DEXIE ADAPTER SPECIFICATION
// ============================================================================

/**
 * Future Dexie adapter interface
 * 
 * WHEN INTEGRATING:
 * 1. Install Dexie: `npm install dexie`
 * 2. Create adapter implementing this interface
 * 3. Use userId from Supabase auth for all queries
 * 4. Never query across userId boundaries
 * 
 * IMPORTANT BEHAVIOR:
 * - Pieter and Danè's data MUST remain separate
 * - Progress must survive refresh, browser restart, offline use, PWA relaunch
 * - Signing out must prevent another account from seeing previous user's progress
 * - Signing back in must restore that user's local history
 * - Do NOT erase valid local progress because Supabase is unavailable
 * - Document that clearing browser data or uninstalling PWA removes local data
 */
export interface LocalStorageAdapter {
  /** Initialize database connection */
  initialize(): Promise<void>;

  /** Close database connection */
  close(): Promise<void>;

  /** Clear all data for a user (on explicit logout) */
  clearUser(userId: UserId): Promise<void>;

  /** Get profile for user */
  getProfile(userId: UserId): Promise<LearnerProfile | undefined>;

  /** Save or update profile */
  saveProfile(profile: LearnerProfile): Promise<void>;

  /** Get lesson progress for user */
  getLessonProgress(userId: UserId, lessonId: ContentId): Promise<LessonProgress | undefined>;

  /** Save lesson progress */
  saveLessonProgress(progress: LessonProgress): Promise<void>;

  /** Get all due reviews for user */
  getDueReviews(userId: UserId, maxCount: number): Promise<ReviewSchedule[]>;

  /** Save review schedule */
  saveReviewSchedule(schedule: ReviewSchedule): Promise<void>;

  /** Add attempt record */
  addAttempt(attempt: Attempt): Promise<void>;

  /** Get phrase mastery */
  getPhraseMastery(userId: UserId, phraseId: ContentId): Promise<PhraseMastery | undefined>;

  /** Save phrase mastery */
  savePhraseMastery(mastery: PhraseMastery): Promise<void>;

  /** Add progress event to outbox */
  addProgressEvent(event: ProgressEvent): Promise<void>;

  /** Get pending events for sync */
  getPendingEvents(userId: UserId): Promise<ProgressEvent[]>;

  /** Mark event as acknowledged */
  markEventAcknowledged(eventUuid: EventUuid): Promise<void>;

  /** Remove acknowledged events */
  removeAcknowledgedEvents(): Promise<void>;
}

// ============================================================================
// WARNINGS AND DOCUMENTATION
// ============================================================================

/**
 * Important warnings about local storage
 */
export const LOCAL_STORAGE_WARNINGS = {
  /** Data loss scenarios */
  DATA_LOSS_WARNING: `
CLEARING BROWSER DATA WILL REMOVE LOCAL PROGRESS:
- Clearing browser cache/cookies
- Uninstalling the PWA
- Using incognito/private browsing mode
- Switching to a different browser or device

Supabase serves as the durable backup. Always ensure sync completes
before clearing any local data.
`,

  /** Account switching warning */
  ACCOUNT_SWITCHING_WARNING: `
SIGNING OUT PREVENTS DATA ACCESS:
- When a user signs out, their local data remains on device but is inaccessible
- Another user signing in will only see their own data (partitioned by userId)
- The original user signing back in will regain access to their local history
- DO NOT use email or display name as partition keys - only use Supabase userId
`,

  /** Offline limitations */
  OFFLINE_LIMITATIONS_WARNING: `
OFFLINE FUNCTIONALITY LIMITS:
- Days 1-7 lessons work offline when pre-downloaded
- Audio playback works offline for downloaded assets
- Learner can record their own voice offline
- Online speech evaluation is UNAVAILABLE offline
- App must NOT pretend to score offline speech
- Progress saves locally and syncs when reconnected
`
};
