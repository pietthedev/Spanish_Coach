import type { Phrase } from "@/content/schema";
import type { CueType, MemoryBand, StepKind } from "./types";

/**
 * English is a scaffold, not the destination. As a phrase strengthens, the
 * prompt moves from translation towards situation and finally to responding to
 * Spanish itself.
 */
export function cueForBand(band: MemoryBand, hasReplies: boolean): CueType {
  switch (band) {
    case "new":
    case "familiar":
    case "fragile":
      return "english";
    case "retrievable":
      return "situation";
    default:
      return hasReplies ? "conversation" : "situation";
  }
}

export interface CuePresentation {
  /** The visible instruction. Never contains the Spanish answer. */
  prompt: string;
  /** Optional supporting line under the prompt. */
  detail?: string;
  /** English text to speak aloud as the teaching cue, when the cue is English. */
  spokenEnglish?: string;
  /** Play the Spanish audio as the prompt (learner must respond, not repeat). */
  playsSpanish: boolean;
}

export function presentCue(
  phrase: Phrase,
  cueType: CueType,
  stepKind: StepKind,
): CuePresentation {
  if (stepKind === "listen-understand")
    return {
      prompt: "What did you hear?",
      playsSpanish: true,
    };
  switch (cueType) {
    case "english":
      return {
        prompt: phrase.english,
        detail: "Say it in Spanish.",
        spokenEnglish: phrase.english,
        playsSpanish: false,
      };
    case "situation":
      return {
        prompt: phrase.context,
        detail: "What do you say?",
        playsSpanish: false,
      };
    case "conversation":
      return {
        prompt: reply(phrase) ?? phrase.context,
        detail: "Respond in Spanish.",
        playsSpanish: false,
      };
    case "spanish-audio":
      return {
        prompt: "Listen, then respond.",
        playsSpanish: true,
      };
  }
}

function reply(phrase: Phrase): string | undefined {
  const first = phrase.likelyReplies[0];
  return first ? `Someone says: “${first.esMX}”` : undefined;
}
