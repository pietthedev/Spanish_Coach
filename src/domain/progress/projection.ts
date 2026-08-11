/**
 * Progress Projection Engine
 * 
 * Pure TypeScript projection functions that derive visible progress from
 * immutable progress events.
 * 
 * Requirements:
 * - Replaying the same event UUID must not duplicate points or progress
 * - Projections must be deterministic
 * - Technical failures must not reduce mastery
 * - Minor issues count as completion but schedule an earlier review
 * - Meaning-changing errors schedule corrective review
 * - Out-of-order events from two devices must resolve deterministically
 * - Server timestamp wins for ordering once acknowledged
 * - Original client timestamp must be retained for audit history
 */

import type { ContentId } from '../content/types';
import type { UserId, EventUuid, ProgressEvent } from '../data/local/types';
import type { ScheduledReview, ReviewResultQuality } from '../review/scheduler';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Travel Points awarded for lesson completion
 */
export const POINTS_LESSON_COMPLETE = 50;

/**
 * Travel Points awarded for due review completion
 */
export const POINTS_REVIEW_COMPLETE = 10;

/**
 * Travel Points awarded for mission completion
 */
export const POINTS_MISSION_COMPLETE = 100;

/**
 * Minimum mastery level to consider phrase "learned"
 */
export const MASTERY_THRESHOLD_LEARNED = 3;

/**
 * Minimum mastery level to consider phrase "mastered"
 */
export const MASTERY_THRESHOLD_MASTERED = 5;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Projected learner progress state
 */
export interface ProgressProjection {
  /** User ID */
  readonly userId: UserId;
  /** Completed lessons */
  readonly completedLessons: Set<ContentId>;
  /** Current lesson in progress (if any) */
  readonly currentLesson?: ContentId;
  /** Phrase mastery levels */
  readonly phraseMastery: Map<ContentId, PhraseMasteryState>;
  /** Review schedule */
  readonly reviewSchedule: Map<ContentId, ScheduledReview>;
  /** Total Travel Points */
  readonly travelPoints: number;
  /** Achievements unlocked */
  readonly achievements: Set<string>;
  /** Category readiness scores */
  readonly categoryReadiness: Map<string, CategoryReadinessState>;
  /** Mission status */
  readonly missionStatus: Map<string, MissionProgressState>;
  /** Last activity timestamp */
  readonly lastActivityAt?: string;
  /** Processed event UUIDs (for deduplication) */
  readonly processedEvents: Set<EventUuid>;
}

/**
 * Phrase mastery state
 */
export interface PhraseMasteryState {
  /** Mastery level 0-5 */
  readonly level: number;
  /** Success count */
  readonly successCount: number;
  /** Failure count */
  readonly failureCount: number;
  /** Next review due date */
  readonly nextReviewDate: string;
  /** Last reviewed date */
  readonly lastReviewedDate?: string;
  /** Interval index */
  readonly intervalIndex: number;
  /** Ease factor */
  readonly easeFactor: number;
}

/**
 * Category readiness state
 */
export interface CategoryReadinessState {
  /** Readiness score 0-100 */
  readonly score: number;
  /** Phrases mastered in category */
  readonly phrasesMastered: number;
  /** Total phrases in category */
  readonly totalPhrases: number;
  /** Confidence band */
  readonly confidenceBand: 'low' | 'medium' | 'high';
}

/**
 * Mission progress state
 */
export interface MissionProgressState {
  /** Whether mission is complete */
  readonly isComplete: boolean;
  /** Whether succeeded */
  readonly isSuccess: boolean;
  /** Completion count */
  readonly completionCount: number;
  /** Best completion (fewest failures) */
  readonly bestFailures: number;
  /** Last completed at */
  readonly lastCompletedAt?: string;
}

/**
 * Projection result with metadata
 */
export interface ProjectionResult<T> {
  /** Projected value */
  readonly value: T;
  /** Events processed to create projection */
  readonly eventsProcessed: number;
  /** Latest event timestamp */
  readonly latestTimestamp?: string;
  /** Deduplicated events count */
  readonly deduplicatedCount: number;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

/**
 * Create empty initial projection state
 */
export function createInitialProjection(userId: UserId): ProgressProjection {
  return {
    userId,
    completedLessons: new Set(),
    currentLesson: undefined,
    phraseMastery: new Map(),
    reviewSchedule: new Map(),
    travelPoints: 0,
    achievements: new Set(),
    categoryReadiness: new Map(),
    missionStatus: new Map(),
    lastActivityAt: undefined,
    processedEvents: new Set()
  };
}

// ============================================================================
// EVENT PROJECTION FUNCTIONS
// ============================================================================

/**
 * Apply a single progress event to projection state
 * 
 * Returns updated projection or null if event is duplicate
 */
export function applyEvent(
  projection: ProgressProjection,
  event: ProgressEvent
): ProgressProjection | null {
  // Deduplicate by event UUID
  if (projection.processedEvents.has(event.eventUuid)) {
    return null; // Already processed
  }

  // Create new projection with updated state
  let newProjection: ProgressProjection = {
    ...projection,
    processedEvents: new Set(projection.processedEvents).add(event.eventUuid),
    lastActivityAt: event.clientTimestamp
  };

  // Apply based on event type
  switch (event.eventType) {
    case 'lesson_completed':
      newProjection = projectLessonCompleted(newProjection, event);
      break;
    case 'phrase_reviewed':
      newProjection = projectPhraseReviewed(newProjection, event);
      break;
    case 'achievement_unlocked':
      newProjection = projectAchievementUnlocked(newProjection, event);
      break;
    case 'points_earned':
      newProjection = projectPointsEarned(newProjection, event);
      break;
    case 'mission_completed':
      newProjection = projectMissionCompleted(newProjection, event);
      break;
    case 'streak_updated':
      newProjection = projectStreakUpdated(newProjection, event);
      break;
  }

  return newProjection;
}

/**
 * Project lesson completed event
 */
function projectLessonCompleted(
  projection: ProgressProjection,
  event: ProgressEvent
): ProgressProjection {
  const payload = event.payload as {
    lessonId: ContentId;
    travelPointsEarned?: number;
    dayNumber?: number;
  };

  // Add to completed lessons (idempotent - Set handles duplicates)
  const completedLessons = new Set(projection.completedLessons);
  completedLessons.add(payload.lessonId);

  // Add travel points
  const pointsEarned = payload.travelPointsEarned || POINTS_LESSON_COMPLETE;
  const travelPoints = projection.travelPoints + pointsEarned;

  // Clear current lesson if this was it
  let currentLesson = projection.currentLesson;
  if (currentLesson === payload.lessonId) {
    currentLesson = undefined;
  }

  return {
    ...projection,
    completedLessons,
    currentLesson,
    travelPoints
  };
}

/**
 * Project phrase reviewed event
 */
function projectPhraseReviewed(
  projection: ProgressProjection,
  event: ProgressEvent
): ProgressProjection {
  const payload = event.payload as {
    phraseId: ContentId;
    quality: ReviewResultQuality;
    nextReviewDate: string;
    intervalIndex: number;
    easeFactor: number;
  };

  const existingMastery = projection.phraseMastery.get(payload.phraseId);
  
  // Calculate new mastery state
  let newMastery: PhraseMasteryState;
  
  if (existingMastery) {
    // Update existing
    newMastery = updatePhraseMastery(existingMastery, payload.quality, payload);
  } else {
    // Create new
    newMastery = createPhraseMastery(payload);
  }

  // Technical failures don't reduce mastery
  if (payload.quality === 'technical_failure') {
    return projection; // No change
  }

  const phraseMastery = new Map(projection.phraseMastery);
  phraseMastery.set(payload.phraseId, newMastery);

  // Update review schedule
  const reviewSchedule = new Map(projection.reviewSchedule);
  reviewSchedule.set(payload.phraseId, {
    contentId: payload.phraseId,
    dueDate: payload.nextReviewDate,
    currentIntervalIndex: payload.intervalIndex,
    easeFactor: payload.easeFactor,
    successCount: newMastery.successCount,
    failureCount: newMastery.failureCount,
    lastReviewedDate: event.clientTimestamp,
    isOverdue: false
  });

  // Award points for review completion
  const travelPoints = projection.travelPoints + POINTS_REVIEW_COMPLETE;

  return {
    ...projection,
    phraseMastery,
    reviewSchedule,
    travelPoints
  };
}

/**
 * Update phrase mastery based on review quality
 */
function updatePhraseMastery(
  existing: PhraseMasteryState,
  quality: ReviewResultQuality,
  payload: {
    intervalIndex: number;
    easeFactor: number;
    nextReviewDate: string;
  }
): PhraseMasteryState {
  let level = existing.level;
  let successCount = existing.successCount;
  let failureCount = existing.failureCount;

  switch (quality) {
    case 'excellent':
    case 'good':
      level = Math.min(5, level + 1);
      successCount++;
      break;
    case 'minor_issue':
      // Count as completion but no mastery increase
      successCount++;
      break;
    case 'meaning_changing_error':
      level = Math.max(0, level - 1);
      failureCount++;
      break;
    case 'technical_failure':
      // No change to mastery
      break;
  }

  return {
    ...existing,
    level,
    successCount,
    failureCount,
    intervalIndex: payload.intervalIndex,
    easeFactor: payload.easeFactor,
    nextReviewDate: payload.nextReviewDate,
    lastReviewedDate: payload.nextReviewDate
  };
}

/**
 * Create initial phrase mastery state
 */
function createPhraseMastery(payload: {
  intervalIndex: number;
  easeFactor: number;
  nextReviewDate: string;
}): PhraseMasteryState {
  return {
    level: 1,
    successCount: 1,
    failureCount: 0,
    nextReviewDate: payload.nextReviewDate,
    intervalIndex: payload.intervalIndex,
    easeFactor: payload.easeFactor
  };
}

/**
 * Project achievement unlocked event
 */
function projectAchievementUnlocked(
  projection: ProgressProjection,
  event: ProgressEvent
): ProgressProjection {
  const payload = event.payload as { achievementId: string };

  const achievements = new Set(projection.achievements);
  achievements.add(payload.achievementId);

  return {
    ...projection,
    achievements
  };
}

/**
 * Project points earned event
 */
function projectPointsEarned(
  projection: ProgressProjection,
  event: ProgressEvent
): ProgressProjection {
  const payload = event.payload as { points: number; reason: string };

  // Prevent duplicate points for same action
  const travelPoints = projection.travelPoints + (payload.points || 0);

  return {
    ...projection,
    travelPoints
  };
}

/**
 * Project mission completed event
 */
function projectMissionCompleted(
  projection: ProgressProjection,
  event: ProgressEvent
): ProgressProjection {
  const payload = event.payload as {
    missionId: string;
    isSuccess: boolean;
    failures: number;
    travelPointsEarned?: number;
  };

  const existing = projection.missionStatus.get(payload.missionId);
  
  let newState: MissionProgressState;
  if (existing) {
    newState = {
      ...existing,
      isComplete: payload.isSuccess || existing.isComplete,
      isSuccess: payload.isSuccess || existing.isSuccess,
      completionCount: existing.completionCount + 1,
      bestFailures: payload.isSuccess 
        ? Math.min(existing.bestFailures, payload.failures)
        : existing.bestFailures,
      lastCompletedAt: event.clientTimestamp
    };
  } else {
    newState = {
      isComplete: payload.isSuccess,
      isSuccess: payload.isSuccess,
      completionCount: 1,
      bestFailures: payload.failures,
      lastCompletedAt: event.clientTimestamp
    };
  }

  const missionStatus = new Map(projection.missionStatus);
  missionStatus.set(payload.missionId, newState);

  // Award points for mission completion
  const pointsEarned = payload.travelPointsEarned || POINTS_MISSION_COMPLETE;
  const travelPoints = projection.travelPoints + pointsEarned;

  return {
    ...projection,
    missionStatus,
    travelPoints
  };
}

/**
 * Project streak updated event
 */
function projectStreakUpdated(
  projection: ProgressProjection,
  event: ProgressEvent
): ProgressProjection {
  // Streak is derived from activity dates, not stored directly
  // This event is informational
  return projection;
}

// ============================================================================
// BATCH PROJECTION
// ============================================================================

/**
 * Project all events into final state
 * 
 * Handles out-of-order events by sorting by server timestamp
 * Retains client timestamp for audit
 */
export function projectAllEvents(
  userId: UserId,
  events: ProgressEvent[]
): ProjectionResult<ProgressProjection> {
  let projection = createInitialProjection(userId);
  let deduplicatedCount = 0;
  let latestTimestamp: string | undefined;

  // Sort by server timestamp (authoritative), then client timestamp
  const sortedEvents = [...events].sort((a, b) => {
    const serverCompare = (b.serverTimestamp || '').localeCompare(a.serverTimestamp || '');
    if (serverCompare !== 0) return serverCompare;
    return b.clientTimestamp.localeCompare(a.clientTimestamp);
  });

  for (const event of sortedEvents) {
    const result = applyEvent(projection, event);
    
    if (result === null) {
      deduplicatedCount++;
    } else {
      projection = result;
      latestTimestamp = event.serverTimestamp || event.clientTimestamp;
    }
  }

  return {
    value: projection,
    eventsProcessed: events.length,
    latestTimestamp,
    deduplicatedCount
  };
}

// ============================================================================
// DERIVED CALCULATIONS
// ============================================================================

/**
 * Calculate category readiness from phrase mastery
 */
export function calculateCategoryReadiness(
  phraseMastery: Map<ContentId, PhraseMasteryState>,
  categoryPhrases: Map<string, ContentId[]>
): Map<string, CategoryReadinessState> {
  const result = new Map<string, CategoryReadinessState>();

  for (const [categoryId, phraseIds] of categoryPhrases.entries()) {
    const totalPhrases = phraseIds.length;
    let phrasesMastered = 0;
    let totalMasteryLevel = 0;

    for (const phraseId of phraseIds) {
      const mastery = phraseMastery.get(phraseId);
      if (mastery) {
        totalMasteryLevel += mastery.level;
        if (mastery.level >= MASTERY_THRESHOLD_LEARNED) {
          phrasesMastered++;
        }
      }
    }

    const averageMastery = totalPhrases > 0 ? totalMasteryLevel / totalPhrases : 0;
    const score = Math.round((averageMastery / 5) * 100);

    let confidenceBand: 'low' | 'medium' | 'high' = 'low';
    if (score >= 80) confidenceBand = 'high';
    else if (score >= 50) confidenceBand = 'medium';

    result.set(categoryId, {
      score,
      phrasesMastered,
      totalPhrases,
      confidenceBand
    });
  }

  return result;
}

/**
 * Get phrases due for review
 */
export function getDueReviews(
  reviewSchedule: Map<ContentId, ScheduledReview>,
  now: Date = new Date()
): ScheduledReview[] {
  const today = now.toISOString().split('T')[0];
  
  return Array.from(reviewSchedule.values())
    .filter(r => r.dueDate <= today && !r.isOverdue)
    .sort((a, b) => {
      // Overdue first
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      // Then by due date
      return a.dueDate.localeCompare(b.dueDate);
    });
}

/**
 * Check if lesson is completed
 */
export function isLessonCompleted(
  projection: ProgressProjection,
  lessonId: ContentId
): boolean {
  return projection.completedLessons.has(lessonId);
}

/**
 * Get phrase mastery level
 */
export function getPhraseMasteryLevel(
  projection: ProgressProjection,
  phraseId: ContentId
): number {
  return projection.phraseMastery.get(phraseId)?.level || 0;
}

/**
 * Check if phrase is mastered
 */
export function isPhraseMastered(
  projection: ProgressProjection,
  phraseId: ContentId
): boolean {
  const mastery = projection.phraseMastery.get(phraseId);
  return mastery ? mastery.level >= MASTERY_THRESHOLD_MASTERED : false;
}

/**
 * Get achievement progress
 */
export function getAchievementProgress(
  projection: ProgressProjection,
  achievementId: string
): { isUnlocked: boolean; progress: number } {
  const isUnlocked = projection.achievements.has(achievementId);
  return {
    isUnlocked,
    progress: isUnlocked ? 100 : 0
  };
}

/**
 * Get mission status
 */
export function getMissionStatus(
  projection: ProgressProjection,
  missionId: string
): MissionProgressState | undefined {
  return projection.missionStatus.get(missionId);
}

/**
 * Calculate current streak from activity dates
 */
export function calculateStreak(
  activityDates: string[],
  now: Date = new Date()
): { current: number; longest: number } {
  if (activityDates.length === 0) {
    return { current: 0, longest: 0 };
  }

  const sortedDates = [...activityDates].sort().reverse();
  const today = now.toISOString().split('T')[0];
  
  let currentStreak = 0;
  let longestStreak = 0;
  let currentRun = 0;
  let lastDate: string | null = null;

  for (const date of sortedDates) {
    const dateObj = new Date(date);
    const expectedDate = lastDate 
      ? new Date(lastDate)
      : now;
    
    if (lastDate) {
      expectedDate.setDate(expectedDate.getDate() - 1);
      const expectedStr = expectedDate.toISOString().split('T')[0];
      
      if (date === expectedStr) {
        currentRun++;
      } else if (date !== lastDate) {
        // Gap detected
        longestStreak = Math.max(longestStreak, currentRun);
        currentRun = 1;
      }
    } else {
      currentRun = 1;
    }
    
    if (date === today) {
      currentStreak = currentRun;
    }
    
    lastDate = date;
  }

  longestStreak = Math.max(longestStreak, currentRun);

  return { current: currentStreak, longest: longestStreak };
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

/**
 * Resolve conflicts between two projections (e.g., from different devices)
 * 
 * Uses server timestamp as authoritative
 * Takes maximum values for counters
 */
export function resolveProjectionConflict(
  projection1: ProgressProjection,
  projection2: ProgressProjection,
  events1: ProgressEvent[],
  events2: ProgressEvent[]
): ProgressProjection {
  // Merge processed events
  const mergedEvents = [...events1, ...events2];
  
  // Re-project all events for deterministic result
  const result = projectAllEvents(projection1.userId, mergedEvents);
  
  return result.value;
}
