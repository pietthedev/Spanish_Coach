import type { EvaluationOutcome } from "@/lib/evaluation/evaluate";

export interface MasteryState {
  intervalStep: number;
  dueAt: string;
  consecutiveSuccesses: number;
  lastOutcome?: EvaluationOutcome;
}
export const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30] as const;

function addDays(now: Date, days: number): string {
  const next = new Date(now);
  if (days === 0) next.setMinutes(next.getMinutes() + 10);
  else next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

export function scheduleReview(
  previous: MasteryState | undefined,
  outcome: EvaluationOutcome,
  now: Date,
): MasteryState {
  const currentStep = previous?.intervalStep ?? -1;
  if (outcome === "technical-failure")
    return (
      previous ?? {
        intervalStep: 0,
        dueAt: addDays(now, 0),
        consecutiveSuccesses: 0,
        lastOutcome: outcome,
      }
    );
  if (outcome === "meaning-error" || outcome === "incomplete")
    return {
      intervalStep: 0,
      dueAt: addDays(now, outcome === "meaning-error" ? 0 : 1),
      consecutiveSuccesses: 0,
      lastOutcome: outcome,
    };
  const stepIncrease = outcome === "minor-issue" ? 0 : 1;
  const nextStep = Math.max(
    0,
    Math.min(REVIEW_INTERVALS_DAYS.length - 1, currentStep + stepIncrease),
  );
  const days = outcome === "minor-issue" ? 1 : REVIEW_INTERVALS_DAYS[nextStep]!;
  return {
    intervalStep: nextStep,
    dueAt: addDays(now, days),
    consecutiveSuccesses: (previous?.consecutiveSuccesses ?? 0) + 1,
    lastOutcome: outcome,
  };
}

export function selectDueReviews<T extends { dueAt: string }>(
  items: T[],
  now: Date,
  limit = 5,
): T[] {
  return items
    .filter((item) => new Date(item.dueAt) <= now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, limit);
}
