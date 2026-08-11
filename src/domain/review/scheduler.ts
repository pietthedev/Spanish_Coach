/**
 * Spaced-Review Scheduler
 * 
 * Pure TypeScript deterministic review scheduling.
 * No external dependencies.
 * 
 * Review intervals:
 * - Later in same lesson
 * - 1 day
 * - 3 days
 * - 7 days
 * - 14 days
 * - 30 days
 */

import type { ContentId } from '../content/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Standard review intervals in days
 */
export const REVIEW_INTERVALS: number[] = [0, 1, 3, 7, 14, 30];

/**
 * Default ease factor (SM-2 inspired)
 */
export const DEFAULT_EASE_FACTOR = 2.5;

/**
 * Minimum interval in days
 */
export const MIN_INTERVAL_DAYS = 1;

/**
 * Maximum interval in days
 */
export const MAX_INTERVAL_DAYS = 60;

/**
 * Africa/Johannesburg timezone offset (UTC+2)
 */
export const LEARNING_TIMEZONE = 'Africa/Johannesburg';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of a review attempt
 */
export type ReviewResultQuality =
  | 'excellent'      // Perfect recall, fast
  | 'good'          // Correct with minor hesitation
  | 'minor_issue'   // Small error but meaning preserved
  | 'meaning_changing_error' // Critical concept wrong
  | 'technical_failure'; // Speech recognition failed

/**
 * Scheduled review item
 */
export interface ScheduledReview {
  /** Phrase/content ID to review */
  readonly contentId: ContentId;
  /** When this review is due (ISO date string) */
  readonly dueDate: string;
  /** Current interval number (index into REVIEW_INTERVALS) */
  readonly currentIntervalIndex: number;
  /** Ease factor for this item */
  readonly easeFactor: number;
  /** Number of successful completions */
  readonly successCount: number;
  /** Number of failures */
  readonly failureCount: number;
  /** Last reviewed date */
  readonly lastReviewedDate?: string;
  /** Whether this is overdue */
  readonly isOverdue: boolean;
}

/**
 * Scheduling decision
 */
export interface SchedulingDecision {
  /** Next review date */
  readonly nextReviewDate: string;
  /** New interval index */
  readonly newIntervalIndex: number;
  /** Updated ease factor */
  readonly newEaseFactor: number;
  /** Whether mastery increased */
  readonly masteryIncreased: boolean;
  /** Whether mastery decreased */
  readonly masteryDecreased: boolean;
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Get current date in Africa/Johannesburg timezone
 */
export function getLearningDayDate(): Date {
  return new Date();
}

/**
 * Convert date to ISO date string (YYYY-MM-DD) in learning timezone
 */
export function toLearningDate(date: Date): string {
  // Use UTC to avoid timezone issues for storage
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse ISO date string to Date
 */
export function parseLearningDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Check if a date is before today (overdue)
 */
export function isOverdue(dueDate: string): boolean {
  const today = toLearningDayDate(getLearningDayDate());
  return dueDate < today;
}

/**
 * Check if a date is today or before
 */
export function isDue(dueDate: string): boolean {
  const today = toLearningDayDate(getLearningDayDate());
  return dueDate <= today;
}

// ============================================================================
// SCHEDULING LOGIC
// ============================================================================

/**
 * Calculate next review date based on performance
 */
export function scheduleNextReview(
  currentIntervalIndex: number,
  easeFactor: number,
  quality: ReviewResultQuality,
  lastReviewDate?: string
): SchedulingDecision {
  const today = getLearningDayDate();
  let newIntervalIndex = currentIntervalIndex;
  let newEaseFactor = easeFactor;
  let masteryIncreased = false;
  let masteryDecreased = false;

  switch (quality) {
    case 'excellent':
    case 'good':
      // Success - move to next interval
      newIntervalIndex = Math.min(currentIntervalIndex + 1, REVIEW_INTERVALS.length - 1);
      newEaseFactor = Math.min(easeFactor + 0.1, 3.0);
      masteryIncreased = true;
      break;

    case 'minor_issue':
      // Minor issue - count as completion but return sooner
      // Stay at current interval or go back one if at end
      if (currentIntervalIndex >= REVIEW_INTERVALS.length - 1) {
        newIntervalIndex = REVIEW_INTERVALS.length - 2;
      }
      newEaseFactor = Math.max(easeFactor - 0.05, 1.5);
      // Count as correct but no mastery increase
      break;

    case 'meaning_changing_error':
      // Meaning-changing error - return much sooner
      newIntervalIndex = 0; // Back to first interval
      newEaseFactor = Math.max(easeFactor - 0.2, 1.3);
      masteryDecreased = true;
      break;

    case 'technical_failure':
      // Technical failure - don't reduce mastery, just retry
      // Keep same interval, allow retry without penalty
      newIntervalIndex = currentIntervalIndex;
      newEaseFactor = easeFactor;
      break;
  }

  // Calculate next review date
  const intervalDays = REVIEW_INTERVALS[newIntervalIndex];
  const nextReviewDate = toLearningDayDate(addDays(today, intervalDays));

  return {
    nextReviewDate,
    newIntervalIndex,
    newEaseFactor,
    masteryIncreased,
    masteryDecreased
  };
}

/**
 * Create initial review schedule for new phrase
 */
export function createInitialReview(contentId: ContentId): ScheduledReview {
  const today = toLearningDayDate(getLearningDayDate());
  
  return {
    contentId,
    dueDate: today, // Due immediately for first learning
    currentIntervalIndex: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    successCount: 0,
    failureCount: 0,
    isOverdue: false
  };
}

/**
 * Update review schedule after an attempt
 */
export function updateReview(
  review: ScheduledReview,
  quality: ReviewResultQuality
): { updatedReview: ScheduledReview; decision: SchedulingDecision } {
  const decision = scheduleNextReview(
    review.currentIntervalIndex,
    review.easeFactor,
    quality,
    review.lastReviewedDate
  );

  const today = toLearningDayDate(getLearningDayDate());

  const updatedReview: ScheduledReview = {
    ...review,
    currentIntervalIndex: decision.newIntervalIndex,
    easeFactor: decision.newEaseFactor,
    dueDate: decision.nextReviewDate,
    lastReviewedDate: today,
    successCount: quality === 'excellent' || quality === 'good' || quality === 'minor_issue'
      ? review.successCount + 1
      : review.successCount,
    failureCount: quality === 'meaning_changing_error'
      ? review.failureCount + 1
      : review.failureCount,
    isOverdue: false
  };

  return { updatedReview, decision };
}

/**
 * Schedule a review for later in the same lesson
 */
export function scheduleLaterInLesson(
  contentId: ContentId,
  minutesFromNow: number = 5
): ScheduledReview {
  const now = new Date();
  const dueDate = new Date(now.getTime() + minutesFromNow * 60 * 1000);
  
  return {
    contentId,
    dueDate: dueDate.toISOString(),
    currentIntervalIndex: -1, // Negative indicates intra-lesson
    easeFactor: DEFAULT_EASE_FACTOR,
    successCount: 0,
    failureCount: 0,
    isOverdue: false
  };
}

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Select reviews due for today, limited to fit lesson time
 * 
 * Requirements:
 * - Due reviews come before new material
 * - Learner must not be trapped in endless queue
 * - Daily review volume fits 5-10 minute lesson
 */
export function selectDueReviews(
  reviews: ScheduledReview[],
  maxReviews: number = 8
): ScheduledReview[] {
  // Filter to only due reviews
  const dueReviews = reviews.filter(r => isDue(r.dueDate));

  // Sort by: overdue first, then by oldest last reviewed
  dueReviews.sort((a, b) => {
    // Overdue items first
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;

    // Then by due date (oldest first)
    const dateCompare = a.dueDate.localeCompare(b.dueDate);
    if (dateCompare !== 0) return dateCompare;

    // Tie-breaker: fewer successes = higher priority
    return a.successCount - b.successCount;
  });

  // Return limited set
  return dueReviews.slice(0, maxReviews);
}

/**
 * Check if review queue is manageable
 */
export function isQueueManageable(reviews: ScheduledReview[]): boolean {
  const dueCount = reviews.filter(r => isDue(r.dueDate)).length;
  // More than 15 due reviews suggests queue is getting large
  return dueCount <= 15;
}

/**
 * Get queue statistics
 */
export function getQueueStats(reviews: ScheduledReview[]): {
  totalReviews: number;
  dueToday: number;
  overdue: number;
  dueTomorrow: number;
  dueThisWeek: number;
} {
  const today = toLearningDayDate(getLearningDayDate());
  const tomorrow = toLearningDayDate(addDays(getLearningDayDate(), 1));
  const nextWeek = toLearningDayDate(addDays(getLearningDayDate(), 7));

  return {
    totalReviews: reviews.length,
    dueToday: reviews.filter(r => r.dueDate <= today).length,
    overdue: reviews.filter(r => isOverdue(r.dueDate)).length,
    dueTomorrow: reviews.filter(r => r.dueDate > today && r.dueDate <= tomorrow).length,
    dueThisWeek: reviews.filter(r => r.dueDate > today && r.dueDate <= nextWeek).length
  };
}

// ============================================================================
// MASTERY CALCULATION
// ============================================================================

/**
 * Calculate mastery level for a phrase (0-5 scale)
 */
export function calculateMasteryLevel(review: ScheduledReview): number {
  // Based on interval index and success rate
  const intervalScore = review.currentIntervalIndex;
  
  const totalAttempts = review.successCount + review.failureCount;
  const successRate = totalAttempts > 0 
    ? review.successCount / totalAttempts 
    : 0;

  // Weighted combination
  const rawScore = (intervalScore * 0.6) + (successRate * 5 * 0.4);
  
  // Clamp to 0-5
  return Math.min(5, Math.max(0, Math.round(rawScore)));
}

/**
 * Check if phrase is "mastered" (ready for long-term maintenance)
 */
export function isMastered(review: ScheduledReview): boolean {
  return review.currentIntervalIndex >= 4 && // At least 14-day interval
         review.successCount >= 3 &&
         review.failureCount === 0;
}
