import type { CueType, StepKind } from "@/lib/learning/types";

export type DriveDuration = 10 | 15 | 20;

/**
 * Audio-native activities. Each maps onto an existing learning-engine StepKind
 * so Drive outcomes are scored by the same mastery rules as visual lessons.
 */
export type DriveActivityKind =
  | "contextual-recall"
  | "intent-recall"
  | "listen-meaning"
  | "listen-respond"
  | "conversation"
  | "shadow";

export type DriveOrigin = "due-review" | "new" | "maintenance" | "reinserted";

export interface DriveActivity {
  id: string;
  kind: DriveActivityKind;
  phraseId: string;
  cueType: CueType;
  origin: DriveOrigin;
  /** Planning budget only; the runtime measures real elapsed time. */
  estimatedSeconds: number;
  /** Spanish the coach speaks before the learner answers. */
  hostLine?: { esMX: string; english: string };
  /** Groups consecutive conversation turns under one spoken setup. */
  chainId?: string;
  chainIntro?: string;
}

export interface DriveSessionPlan {
  duration: DriveDuration;
  activities: DriveActivity[];
  /** Elapsed ms after which the session starts winding down. */
  wrapAfterMs: number;
  targetMs: number;
  dueCount: number;
  newPhraseIds: string[];
  /** Chosen up front so the drive can end on something likely to succeed. */
  closingPhraseId?: string;
}

/** How strongly each activity can testify about memory. */
export const ACTIVITY_STEP_KIND: Record<DriveActivityKind, StepKind> = {
  "contextual-recall": "contextual-recall",
  "intent-recall": "spoken-recall",
  "listen-meaning": "listen-understand",
  "listen-respond": "listen-respond",
  conversation: "scenario",
  shadow: "pronunciation-rehearsal",
};

/**
 * Budget estimates covering narration, a recall pause, speech, evaluation and
 * feedback. Deliberately generous: a drive that ends early is better than one
 * that overruns the commute.
 */
export const ACTIVITY_SECONDS: Record<DriveActivityKind, number> = {
  "contextual-recall": 42,
  "intent-recall": 40,
  "listen-meaning": 38,
  "listen-respond": 40,
  conversation: 34,
  shadow: 52,
};

export const INTRO_SECONDS = 12;
export const OUTRO_SECONDS = 16;

export type DriveState =
  | "idle"
  | "preparing"
  | "intro"
  | "prompting"
  | "thinking"
  | "listening"
  | "evaluating"
  | "feedback"
  | "coaching"
  | "paused"
  | "wrapping"
  | "completed"
  | "error";

export type FeedbackTone = "correct" | "acceptable" | "retry" | "technical";

export interface DriveAttemptRecord {
  phraseId: string;
  kind: DriveActivityKind;
  outcome: string;
  assistanceLevel: string;
  independent: boolean;
  hinted: boolean;
  technical: boolean;
  transcript?: string;
  latencyMs?: number;
}

export interface DriveSessionSummary {
  duration: DriveDuration;
  actualMs: number;
  activitiesCompleted: number;
  phrasesAttempted: number;
  independentSuccesses: number;
  hintAssistedSuccesses: number;
  errors: number;
  technicalFailures: number;
  reason: "completed" | "ended-early" | "interrupted";
}
