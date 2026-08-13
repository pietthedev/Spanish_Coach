import type { Phrase } from "@/content/schema";
import type { EvaluationResult } from "@/lib/evaluation/evaluate";
import { MEMORY_BAND_LABEL, bandRank, memoryBand } from "./mastery";
import type { AssistanceLevel, MemoryBand, PhraseMastery } from "./types";

export interface StepFeedback {
  tone: "success" | "partial" | "rebuild" | "neutral";
  headline: string;
  detail: string;
  /** Whether the learner should hear the phrase again before moving on. */
  replay: boolean;
}

/**
 * Corrective rather than judgemental: name what survived, then say what to
 * rebuild. Meaning errors are treated more seriously than accent.
 */
export function stepFeedback(
  result: EvaluationResult,
  phrase: Phrase,
  assistance: AssistanceLevel,
): StepFeedback {
  if (result.outcome === "technical-failure")
    return {
      tone: "neutral",
      headline: "That did not reach the microphone",
      detail: `${result.message} This does not count against your progress.`,
      replay: false,
    };

  if (result.outcome === "understood" || result.outcome === "different-valid") {
    if (assistance === "answer-visible" || assistance === "repeat-only")
      return {
        tone: "success",
        headline: "Good pronunciation",
        detail:
          "That was clear. You will be asked to produce it from memory later.",
        replay: false,
      };
    if (assistance === "revealed")
      return {
        tone: "partial",
        headline: "Said well after seeing it",
        detail: "This one comes back shortly so you can find it unaided.",
        replay: false,
      };
    const hinted = assistance.startsWith("hint");
    return {
      tone: "success",
      headline: hinted ? "You got there" : "Straight from memory",
      detail: hinted
        ? "The memory is there but still needs a nudge. It will return sooner."
        : "That is the retrieval that makes it stick.",
      replay: false,
    };
  }

  if (result.outcome === "minor-issue")
    return {
      tone: "success",
      headline: "Understandable",
      detail:
        "The meaning came through. Listen once more and match the rhythm — being understood matters more than a perfect accent.",
      replay: true,
    };

  const kept = heardConcepts(result, phrase);
  if (result.outcome === "incomplete")
    return {
      tone: "partial",
      headline: "Nearly there",
      detail: kept
        ? `You had ${kept}. Listen again and rebuild the whole phrase.`
        : "Part of the phrase was missing. Listen again and rebuild it.",
      replay: true,
    };

  return {
    tone: "rebuild",
    headline: "The meaning changed",
    detail: result.criticalError
      ? `${result.message} Listen again — that part carries the meaning.`
      : `${result.message} Listen again and rebuild it.`,
    replay: true,
  };
}

function heardConcepts(result: EvaluationResult, phrase: Phrase): string {
  const missing = new Set(result.missingConcepts ?? []);
  const kept = phrase.requiredConcepts
    .filter((concept) => !missing.has(concept))
    .map((concept) => concept.replaceAll("-", " "));
  if (!kept.length) return "";
  return kept.map((item) => `“${item}”`).join(" and ");
}

export interface BandChange {
  phraseId: string;
  esMX: string;
  before: MemoryBand;
  after: MemoryBand;
  label: string;
  summary: string;
  /** Moved up a band on the back of a real retrieval, not just exposure. */
  strengthened: boolean;
}

/** The completion screen speaks in memory terms, not just points. */
export function describeBandChange(
  phrase: Phrase,
  before: PhraseMastery | undefined,
  after: PhraseMastery,
): BandChange {
  const from = memoryBand(before);
  const to = memoryBand(after);
  const needsWork =
    after.independentSuccesses === (before?.independentSuccesses ?? 0) &&
    after.assistedSuccesses === (before?.assistedSuccesses ?? 0);
  return {
    phraseId: phrase.id,
    esMX: phrase.esMX,
    before: from,
    after: to,
    label: MEMORY_BAND_LABEL[to],
    strengthened: bandRank(to) > bandRank(from) && !needsWork,
    summary: needsWork
      ? "needs another attempt"
      : from === to
        ? `still ${MEMORY_BAND_LABEL[to].toLowerCase()}`
        : `now ${MEMORY_BAND_LABEL[to].toLowerCase()}`,
  };
}
