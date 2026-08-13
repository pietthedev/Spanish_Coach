import type { EvaluationOutcome } from "@/lib/evaluation/evaluate";
import { REVIEW_INTERVALS_DAYS, dueAfterDays } from "@/lib/review/scheduler";
import {
  emptyMastery,
  type AssistanceLevel,
  type EvidenceStrength,
  type MemoryBand,
  type PhraseMastery,
  type RetrievalAttempt,
} from "./types";

const CORRECT: EvaluationOutcome[] = ["understood", "different-valid"];

/** Assistance that means the learner was looking at the answer as they spoke. */
const NON_RETRIEVAL: AssistanceLevel[] = ["answer-visible", "repeat-only"];

/** Beyond this, a correct answer is fluent recall rather than reconstruction. */
const SLOW_RESPONSE_MS = 8_000;

/** Steps that produce speech are the only strong evidence of production. */
const PRODUCTIVE_STEPS = new Set([
  "spoken-recall",
  "contextual-recall",
  "listen-respond",
  "scenario",
]);

export function evidenceStrength(attempt: RetrievalAttempt): EvidenceStrength {
  if (attempt.outcome === "technical-failure") return "none";
  if (NON_RETRIEVAL.includes(attempt.assistance)) return "pronunciation-only";
  if (attempt.outcome === "meaning-error") return "none";
  if (attempt.outcome === "incomplete") return "weak";
  if (attempt.assistance === "revealed") return "none";

  const correct = CORRECT.includes(attempt.outcome);
  if (!correct) return "moderate"; // minor-issue: meaning survived

  if (!PRODUCTIVE_STEPS.has(attempt.stepKind)) {
    // Comprehension proves recognition, never production.
    return attempt.assistance === "none" ? "moderate" : "weak";
  }
  const slow =
    attempt.responseLatencyMs !== undefined &&
    attempt.responseLatencyMs > SLOW_RESPONSE_MS;
  switch (attempt.assistance) {
    case "none":
      return slow ? "strong" : "very-strong";
    case "hesitated":
      return "strong";
    case "hint-1":
      return "moderate";
    default:
      return "weak"; // hint-2, hint-3
  }
}

interface Transition {
  stepDelta: number;
  /** Days until the next review, or undefined to keep the existing due date. */
  days?: number;
  keepDueDate?: boolean;
}

function transitionFor(
  attempt: RetrievalAttempt,
  strength: EvidenceStrength,
  currentStep: number,
): Transition {
  if (attempt.outcome === "technical-failure")
    return { stepDelta: 0, keepDueDate: true };
  if (strength === "pronunciation-only")
    return { stepDelta: 0, keepDueDate: true };
  if (attempt.outcome === "meaning-error") return { stepDelta: -currentStep - 1, days: 0 };
  if (attempt.assistance === "revealed") return { stepDelta: -currentStep - 1, days: 0 };
  if (attempt.outcome === "incomplete") return { stepDelta: -currentStep - 1, days: 1 };

  switch (strength) {
    case "very-strong":
    case "strong":
      return { stepDelta: 1 };
    case "moderate":
      // Hold position: the memory exists but needed support.
      return { stepDelta: 0, days: Math.min(1, REVIEW_INTERVALS_DAYS[Math.max(0, currentStep)]!) };
    default:
      // Heavy hints: bring it back today.
      return { stepDelta: -1, days: 0 };
  }
}

function dayOf(timestamp: string): string {
  return timestamp.slice(0, 10);
}

/**
 * Fold a single attempt into the phrase's mastery record. This is the only
 * place mastery changes, so the "assistance matters" rule cannot be bypassed.
 */
export function applyAttempt(
  previous: PhraseMastery | undefined,
  attempt: RetrievalAttempt,
  now: Date,
): PhraseMastery {
  const base = previous ?? emptyMastery(dueAfterDays(now, 0));
  const strength = evidenceStrength(attempt);

  if (attempt.outcome === "technical-failure")
    return { ...base, encounters: base.encounters + 1 };

  const currentStep = base.intervalStep;
  const transition = transitionFor(attempt, strength, Math.max(0, currentStep));
  // currentStep is -1 for a phrase that has never been reviewed, so the first
  // success lands on step 0 (same-day) rather than skipping it.
  const nextStep = Math.max(
    0,
    Math.min(
      REVIEW_INTERVALS_DAYS.length - 1,
      currentStep + transition.stepDelta,
    ),
  );
  const days = transition.days ?? REVIEW_INTERVALS_DAYS[nextStep]!;

  const correct = CORRECT.includes(attempt.outcome);
  const isIndependent =
    correct &&
    strength === "very-strong" &&
    PRODUCTIVE_STEPS.has(attempt.stepKind);
  const isAssistedSuccess =
    correct && !isIndependent && strength !== "pronunciation-only" && strength !== "none";

  const day = dayOf(attempt.timestamp);
  const independentDays =
    isIndependent && !base.independentDays.includes(day)
      ? [...base.independentDays, day]
      : base.independentDays;

  return {
    intervalStep: transition.keepDueDate ? currentStep : nextStep,
    dueAt: transition.keepDueDate ? base.dueAt : dueAfterDays(now, days),
    consecutiveSuccesses: correct ? base.consecutiveSuccesses + 1 : 0,
    lastOutcome: attempt.outcome,
    independentSuccesses: base.independentSuccesses + (isIndependent ? 1 : 0),
    assistedSuccesses: base.assistedSuccesses + (isAssistedSuccess ? 1 : 0),
    encounters: base.encounters + 1,
    lastAssistance: attempt.assistance,
    lastReviewedAt: attempt.timestamp,
    independentDays,
  };
}

/**
 * Derived, never stored. A phrase is only called "learned" once it has been
 * produced independently after a delay — not because a lesson containing it
 * was completed.
 */
export function memoryBand(mastery: PhraseMastery | undefined): MemoryBand {
  if (!mastery || mastery.encounters === 0) return "new";
  const { independentSuccesses, assistedSuccesses, intervalStep } = mastery;
  const days = mastery.independentDays.length;
  if (independentSuccesses === 0 && assistedSuccesses === 0) return "familiar";
  if (independentSuccesses === 0) return "fragile";
  if (intervalStep >= 4 && independentSuccesses >= 3 && days >= 3)
    return "automatic";
  if (intervalStep >= 3 && independentSuccesses >= 2 && days >= 2)
    return "stable";
  if (intervalStep >= 1) return "retrievable";
  return "fragile";
}

export const MEMORY_BAND_LABEL: Record<MemoryBand, string> = {
  new: "New",
  familiar: "Familiar",
  fragile: "Fragile",
  retrievable: "Retrievable",
  stable: "Stable",
  automatic: "Automatic",
};

export const MEMORY_BAND_ORDER: MemoryBand[] = [
  "new",
  "familiar",
  "fragile",
  "retrievable",
  "stable",
  "automatic",
];

export function bandRank(band: MemoryBand): number {
  return MEMORY_BAND_ORDER.indexOf(band);
}
