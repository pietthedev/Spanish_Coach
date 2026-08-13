import type { EvaluationOutcome } from "@/lib/evaluation/evaluate";

/**
 * How much help the learner had at the moment of production. This is the
 * difference between "I recognise this" and "I can produce this", so it is
 * weighted at least as heavily as the evaluation outcome itself.
 */
export type AssistanceLevel =
  | "none"
  | "hesitated"
  | "hint-1"
  | "hint-2"
  | "hint-3"
  | "revealed"
  | "answer-visible"
  | "repeat-only";

/** The cognitive route used to reach the phrase. */
export type CueType =
  | "english"
  | "situation"
  | "spanish-audio"
  | "conversation";

/** User-facing memory strength, derived from mastery rather than stored. */
export type MemoryBand =
  | "new"
  | "familiar"
  | "fragile"
  | "retrievable"
  | "stable"
  | "automatic";

/** The learning purpose of a step, known to the planner and the player. */
export type StepKind =
  | "introduce"
  | "spoken-recall"
  | "listen-understand"
  | "listen-respond"
  | "contextual-recall"
  | "pronunciation-rehearsal"
  | "scenario";

export interface RetrievalAttempt {
  phraseId: string;
  outcome: EvaluationOutcome;
  assistance: AssistanceLevel;
  cueType: CueType;
  stepKind: StepKind;
  hintCount: number;
  answerVisible: boolean;
  responseLatencyMs?: number;
  transcript?: string;
  attemptNumber: number;
  timestamp: string;
}

export interface PhraseMastery {
  intervalStep: number;
  dueAt: string;
  consecutiveSuccesses: number;
  lastOutcome?: EvaluationOutcome;
  /** Correct productive retrievals with no hint and no visible answer. */
  independentSuccesses: number;
  /** Correct productive retrievals that needed a hint or hesitation. */
  assistedSuccesses: number;
  /** Any exposure at all, including pure listening or repetition. */
  encounters: number;
  lastAssistance?: AssistanceLevel;
  lastReviewedAt?: string;
  /** Distinct calendar days on which an independent retrieval happened. */
  independentDays: string[];
}

/**
 * Evidence tiers, strongest first. `pronunciation-only` means the learner said
 * it correctly while looking at it: useful for encoding, worthless as proof of
 * recall. `none` means the attempt tells us nothing about memory.
 */
export type EvidenceStrength =
  | "very-strong"
  | "strong"
  | "moderate"
  | "weak"
  | "pronunciation-only"
  | "none";

export function emptyMastery(dueAt: string): PhraseMastery {
  return {
    intervalStep: -1,
    dueAt,
    consecutiveSuccesses: 0,
    independentSuccesses: 0,
    assistedSuccesses: 0,
    encounters: 0,
    independentDays: [],
  };
}
