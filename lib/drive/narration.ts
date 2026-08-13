import type { Phrase } from "@/content/schema";
import type { EvaluationResult } from "@/lib/evaluation/evaluate";
import { buildHintLadder } from "@/lib/learning/hints";
import { MEMORY_BAND_LABEL, memoryBand } from "@/lib/learning/mastery";
import type { PhraseMastery } from "@/lib/learning/types";
import type {
  DriveActivity,
  DriveSessionPlan,
  DriveSessionSummary,
} from "./types";

/** One unit of coach audio. The orchestrator plays these strictly in order. */
export type NarrationStep =
  | { kind: "speak"; text: string }
  | { kind: "phrase"; phraseId: string; speed: "normal" | "slow" }
  | { kind: "line"; esMX: string }
  | { kind: "wait"; ms: number };

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export function sessionIntro(plan: DriveSessionPlan): NarrationStep[] {
  const parts = [`${plan.duration}-minute drive lesson.`];
  if (plan.dueCount > 0 && plan.newPhraseIds.length > 0)
    parts.push(
      `${plural(plan.dueCount, "phrase needs", "phrases need")} strengthening and we'll learn ${plural(plan.newPhraseIds.length, "new expression", "new expressions")}.`,
    );
  else if (plan.dueCount > 0)
    parts.push("We're focusing on phrases that need strengthening today.");
  else if (plan.newPhraseIds.length > 0)
    parts.push(`We'll learn ${plural(plan.newPhraseIds.length, "new expression", "new expressions")}.`);
  else parts.push("Let's keep your Spanish warm.");
  parts.push("Let's go.");
  return [{ kind: "speak", text: parts.join(" ") }];
}

/**
 * Builds the audio for one activity. Nothing here reveals the Spanish the
 * learner is meant to produce.
 */
export function promptSteps(
  activity: DriveActivity,
  phrase: Phrase,
): NarrationStep[] {
  switch (activity.kind) {
    case "shadow":
      return [
        { kind: "speak", text: `${phrase.context} You want to say: ${phrase.english}.` },
        { kind: "wait", ms: 700 },
        { kind: "speak", text: "Listen." },
        { kind: "phrase", phraseId: phrase.id, speed: "normal" },
        { kind: "wait", ms: 500 },
        { kind: "speak", text: "Your turn." },
      ];

    case "intent-recall":
      return [{ kind: "speak", text: `Say: ${phrase.english}` }];

    case "contextual-recall":
      return [{ kind: "speak", text: `${phrase.context} What do you say?` }];

    case "listen-meaning":
      return [
        { kind: "speak", text: "Listen." },
        { kind: "phrase", phraseId: phrase.id, speed: "normal" },
        { kind: "wait", ms: 400 },
        { kind: "speak", text: "What does that mean?" },
      ];

    case "listen-respond":
      return [
        { kind: "speak", text: "Someone says:" },
        ...(activity.hostLine
          ? [{ kind: "line" as const, esMX: activity.hostLine.esMX }]
          : []),
        { kind: "wait", ms: 400 },
        { kind: "speak", text: "How do you reply?" },
      ];

    case "conversation":
      return [
        ...(activity.chainIntro
          ? [{ kind: "speak" as const, text: `Let's practise: ${activity.chainIntro}.` }]
          : []),
        ...(activity.hostLine
          ? [{ kind: "line" as const, esMX: activity.hostLine.esMX }]
          : []),
      ];
  }
}

export function hintSteps(phrase: Phrase, level: number): NarrationStep[] {
  const ladder = buildHintLadder(phrase);
  const hint = ladder[Math.min(level, ladder.length) - 1];
  if (!hint) return [{ kind: "speak", text: "Try the first word out loud." }];
  return [
    { kind: "speak", text: "Start with:" },
    { kind: "line", esMX: hint.text.replace("…", "") },
  ];
}

/**
 * Correct answers get a sound and the next prompt, not a speech. Errors get
 * the explanation, because that is where the learning happens.
 */
export function coachingSteps(
  result: EvaluationResult,
  phrase: Phrase,
): NarrationStep[] {
  const opener =
    result.outcome === "meaning-error"
      ? "Close, but the meaning changed. Listen."
      : "Nearly. Listen.";
  return [
    { kind: "speak", text: opener },
    { kind: "phrase", phraseId: phrase.id, speed: "normal" },
    { kind: "wait", ms: 400 },
    { kind: "speak", text: "Your turn." },
  ];
}

export function teachAnswerSteps(phrase: Phrase): NarrationStep[] {
  return [
    { kind: "speak", text: "No problem. Listen." },
    { kind: "phrase", phraseId: phrase.id, speed: "normal" },
    { kind: "wait", ms: 400 },
    { kind: "speak", text: "Your turn." },
  ];
}

export function sessionOutro(
  summary: DriveSessionSummary,
  strongest?: { phrase: Phrase; mastery: PhraseMastery },
): NarrationStep[] {
  const parts = ["Drive lesson complete."];
  if (summary.phrasesAttempted > 0)
    parts.push(`You practised ${plural(summary.phrasesAttempted, "phrase", "phrases")}.`);
  if (summary.independentSuccesses > 0)
    parts.push(
      `${summary.independentSuccesses} came back to you unaided.`,
    );
  if (summary.errors > 0)
    parts.push(`${plural(summary.errors, "phrase needs", "phrases need")} another review.`);
  if (strongest)
    parts.push(
      `${strongest.phrase.esMX} is now ${MEMORY_BAND_LABEL[memoryBand(strongest.mastery)].toLowerCase()}.`,
    );
  parts.push("Have a good drive.");
  return [{ kind: "speak", text: parts.join(" ") }];
}
