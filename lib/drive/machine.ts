import type { EvaluationOutcome, EvaluationResult } from "@/lib/evaluation/evaluate";
import { assistanceForHintCount } from "@/lib/learning/hints";
import type { AssistanceLevel } from "@/lib/learning/types";
import type { DriveCommand } from "./commands";
import {
  ACTIVITY_SECONDS,
  type DriveActivity,
  type DriveAttemptRecord,
  type DriveSessionPlan,
  type DriveState,
  type FeedbackTone,
} from "./types";

export interface DriveContext {
  state: DriveState;
  /** State to return to after a pause. */
  resumeTo?: DriveState;
  plan?: DriveSessionPlan;
  activities: DriveActivity[];
  index: number;
  hintLevel: number;
  revealed: boolean;
  /** Attempts at the current activity, used to stop endless retry loops. */
  attempts: number;
  silences: number;
  elapsedMs: number;
  records: DriveAttemptRecord[];
  lastTone?: FeedbackTone;
  /** Set once the closing activity has been queued. */
  closing: boolean;
  reinserted: string[];
  /** Emitted for the runtime to act on, then cleared. */
  pending?: PendingEffect;
  endReason?: "completed" | "ended-early" | "interrupted";
  error?: string;
}

export type PendingEffect =
  | { type: "replay-prompt" }
  | { type: "speak-hint"; level: number }
  | { type: "teach-answer" };

export type DriveEvent =
  | { type: "PREPARED"; plan: DriveSessionPlan }
  | { type: "INTRO_DONE" }
  | { type: "PROMPT_DONE" }
  | { type: "THINK_ELAPSED" }
  | { type: "SPEECH_STARTED" }
  | { type: "NO_SPEECH" }
  | { type: "EVALUATED"; result: EvaluationResult; latencyMs?: number }
  | { type: "COMMAND"; command: DriveCommand }
  | { type: "FEEDBACK_DONE" }
  | { type: "TICK"; elapsedMs: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "END"; reason?: DriveContext["endReason"] }
  | { type: "ERROR"; message: string };

const MAX_ATTEMPTS = 2;
/** Silent windows tolerated before moving on; driving outranks pedagogy. */
const MAX_SILENCES = 2;
const CORRECT: EvaluationOutcome[] = ["understood", "different-valid"];

export function initialContext(): DriveContext {
  return {
    state: "idle",
    activities: [],
    index: 0,
    hintLevel: 0,
    revealed: false,
    attempts: 0,
    silences: 0,
    elapsedMs: 0,
    records: [],
    closing: false,
    reinserted: [],
  };
}

export function currentActivity(context: DriveContext): DriveActivity | undefined {
  return context.activities[context.index];
}

export function toneFor(outcome: EvaluationOutcome): FeedbackTone {
  if (outcome === "technical-failure") return "technical";
  if (outcome === "understood" || outcome === "different-valid") return "correct";
  if (outcome === "minor-issue") return "acceptable";
  return "retry";
}

/**
 * Same-drive spacing: a missed phrase returns later in a different context
 * rather than being drilled on the spot. One retry per phrase per drive.
 */
export function reinsertLater(
  activities: DriveActivity[],
  index: number,
  gap = 4,
): DriveActivity[] {
  const activity = activities[index];
  if (!activity) return activities;
  const retry: DriveActivity = {
    ...activity,
    id: `${activity.id}.retry`,
    kind: activity.kind === "shadow" ? "contextual-recall" : activity.kind,
    cueType: activity.cueType === "english" ? "situation" : "english",
    origin: "reinserted",
    estimatedSeconds:
      ACTIVITY_SECONDS[activity.kind === "shadow" ? "contextual-recall" : activity.kind],
    hostLine: undefined,
    chainId: undefined,
    chainIntro: undefined,
  };
  const target = Math.min(index + gap, activities.length);
  return [...activities.slice(0, target), retry, ...activities.slice(target)];
}

function advance(context: DriveContext): DriveContext {
  const next = context.index + 1;
  const outOfActivities = next >= context.activities.length;
  const timeUp = context.plan
    ? context.elapsedMs >= context.plan.wrapAfterMs
    : false;

  if (!context.closing && (timeUp || outOfActivities)) {
    const closing = closingActivity(context);
    if (closing)
      return {
        ...context,
        state: "prompting",
        closing: true,
        activities: [...context.activities.slice(0, next), closing],
        index: next,
        hintLevel: 0,
        revealed: false,
        attempts: 0,
        silences: 0,
        pending: undefined,
      };
    return { ...context, state: "completed", endReason: "completed", pending: undefined };
  }
  if (outOfActivities)
    return { ...context, state: "completed", endReason: "completed", pending: undefined };

  return {
    ...context,
    state: "prompting",
    index: next,
    hintLevel: 0,
    revealed: false,
    attempts: 0,
    silences: 0,
    pending: undefined,
  };
}

function closingActivity(context: DriveContext): DriveActivity | undefined {
  const phraseId = context.plan?.closingPhraseId;
  if (!phraseId) return undefined;
  return {
    id: `drive.closing.${phraseId}`,
    kind: "intent-recall",
    phraseId,
    cueType: "english",
    origin: "maintenance",
    estimatedSeconds: ACTIVITY_SECONDS["intent-recall"],
  };
}

function assistanceNow(context: DriveContext, hesitated: boolean): AssistanceLevel {
  const activity = currentActivity(context);
  if (activity?.kind === "shadow") return "repeat-only";
  return assistanceForHintCount(
    context.hintLevel,
    context.revealed,
    false,
    hesitated,
  );
}

export function driveReducer(
  context: DriveContext,
  event: DriveEvent,
): DriveContext {
  switch (event.type) {
    case "PREPARED":
      return {
        ...context,
        state: "intro",
        plan: event.plan,
        activities: event.plan.activities,
        index: 0,
      };

    case "INTRO_DONE":
      return context.activities.length
        ? { ...context, state: "prompting" }
        : { ...context, state: "completed", endReason: "completed" };

    case "PROMPT_DONE":
      return { ...context, state: "thinking", pending: undefined };

    case "THINK_ELAPSED":
    case "SPEECH_STARTED":
      return context.state === "thinking"
        ? { ...context, state: "listening" }
        : context;

    case "NO_SPEECH": {
      // Silence is not evidence of forgetting; the road may simply need
      // attention. Replay once, then move on without penalty.
      const silences = context.silences + 1;
      if (silences > MAX_SILENCES) return advance({ ...context, silences });
      return {
        ...context,
        state: "prompting",
        silences,
        pending: { type: "replay-prompt" },
      };
    }

    case "COMMAND":
      return handleCommand(context, event.command);

    case "EVALUATED": {
      const activity = currentActivity(context);
      if (!activity) return context;
      const hesitated =
        event.latencyMs !== undefined && event.latencyMs > 6_000;
      const assistance = assistanceNow(context, hesitated);
      const tone = toneFor(event.result.outcome);
      const correct = CORRECT.includes(event.result.outcome);

      const record: DriveAttemptRecord = {
        phraseId: activity.phraseId,
        kind: activity.kind,
        outcome: event.result.outcome,
        assistanceLevel: assistance,
        independent: correct && assistance === "none" && activity.kind !== "shadow",
        hinted: correct && assistance.startsWith("hint"),
        technical: event.result.outcome === "technical-failure",
        transcript: event.result.transcript,
        latencyMs: event.latencyMs,
      };

      const base: DriveContext = {
        ...context,
        records: [...context.records, record],
        lastTone: tone,
        pending: undefined,
      };

      // A technical failure is never the learner's fault: retry once, never
      // sound the retry dong, never touch mastery negatively.
      if (event.result.outcome === "technical-failure")
        return base.attempts < MAX_ATTEMPTS
          ? { ...base, state: "prompting", attempts: base.attempts + 1 }
          : advance(base);

      if (tone === "retry" && base.attempts < MAX_ATTEMPTS)
        return {
          ...base,
          state: "coaching",
          attempts: base.attempts + 1,
          activities: reinsertRetry(base, activity),
          reinserted: rememberRetry(base, activity),
        };

      return { ...base, state: "feedback" };
    }

    case "FEEDBACK_DONE":
      if (context.state === "coaching")
        return {
          ...context,
          state: "prompting",
          revealed: true,
          pending: undefined,
        };
      return advance(context);

    case "TICK": {
      const next = { ...context, elapsedMs: event.elapsedMs };
      if (
        next.plan &&
        !next.closing &&
        next.state === "wrapping" &&
        next.elapsedMs >= next.plan.targetMs
      )
        return { ...next, state: "completed", endReason: "completed" };
      return next;
    }

    case "PAUSE":
      return context.state === "paused"
        ? context
        : { ...context, state: "paused", resumeTo: context.state };

    case "RESUME":
      return context.state === "paused"
        ? { ...context, state: context.resumeTo ?? "prompting", resumeTo: undefined }
        : context;

    case "END":
      return {
        ...context,
        state: "completed",
        endReason: event.reason ?? "ended-early",
        pending: undefined,
      };

    case "ERROR":
      return { ...context, state: "error", error: event.message };

    default:
      return context;
  }
}

function handleCommand(
  context: DriveContext,
  command: DriveCommand,
): DriveContext {
  const activity = currentActivity(context);
  switch (command) {
    case "again":
      return { ...context, state: "prompting", pending: { type: "replay-prompt" } };
    case "hint":
      return {
        ...context,
        state: "prompting",
        hintLevel: Math.min(3, context.hintLevel + 1),
        pending: { type: "speak-hint", level: Math.min(3, context.hintLevel + 1) },
      };
    case "dont-know":
      return {
        ...context,
        state: "coaching",
        revealed: true,
        activities: activity ? reinsertRetry(context, activity) : context.activities,
        reinserted: activity ? rememberRetry(context, activity) : context.reinserted,
        pending: { type: "teach-answer" },
      };
    case "skip":
      // Skipping is not a failure; nothing is recorded against mastery.
      return advance({ ...context, pending: undefined });
    case "pause":
      return { ...context, state: "paused", resumeTo: "prompting" };
    case "resume":
      return context.state === "paused"
        ? { ...context, state: context.resumeTo ?? "prompting", resumeTo: undefined }
        : context;
    default:
      return context;
  }
}

function reinsertRetry(
  context: DriveContext,
  activity: DriveActivity,
): DriveActivity[] {
  if (context.reinserted.includes(activity.phraseId)) return context.activities;
  return reinsertLater(context.activities, context.index);
}

function rememberRetry(
  context: DriveContext,
  activity: DriveActivity,
): string[] {
  return context.reinserted.includes(activity.phraseId)
    ? context.reinserted
    : [...context.reinserted, activity.phraseId];
}
