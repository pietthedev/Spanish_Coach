import { normalizeAnswer } from "@/lib/evaluation/normalize";

export type DriveCommand =
  | "again"
  | "hint"
  | "dont-know"
  | "skip"
  | "pause"
  | "resume";

/**
 * Deliberately tiny. Speech-to-text runs with a Spanish language hint, so the
 * Spanish forms are the reliable path and the English ones are a convenience.
 */
const COMMAND_PHRASES: Record<DriveCommand, string[]> = {
  again: ["again", "repeat", "say it again", "say that again", "otra vez", "repite", "repitelo", "de nuevo"],
  hint: ["hint", "help", "a hint", "give me a hint", "pista", "ayuda", "una pista"],
  "dont-know": ["i dont know", "dont know", "no idea", "i give up", "no se", "no lo se", "ni idea"],
  skip: ["skip", "next", "pass", "move on", "saltar", "siguiente", "pasar"],
  pause: ["pause", "stop", "pausa", "para"],
  resume: ["resume", "continue", "carry on", "continuar", "sigue", "seguir"],
};

/** Longest command phrase, in words, that we will even consider. */
const MAX_COMMAND_WORDS = 4;

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0]!;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j]!;
      previous[j] = Math.min(
        previous[j]! + 1,
        previous[j - 1]! + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length]!;
}

/**
 * Matches only when the whole utterance is the command. A command word buried
 * inside a longer answer is treated as Spanish, so real answers are never
 * swallowed by the control vocabulary.
 */
export function matchCommand(transcript: string): DriveCommand | undefined {
  const normalized = normalizeAnswer(transcript);
  if (!normalized) return undefined;
  if (normalized.split(" ").length > MAX_COMMAND_WORDS) return undefined;

  for (const [command, phrases] of Object.entries(COMMAND_PHRASES)) {
    for (const phrase of phrases) {
      const target = normalizeAnswer(phrase);
      if (normalized === target) return command as DriveCommand;
      // Tolerate a single transcription slip on longer words only, so short
      // commands cannot absorb similar-sounding Spanish.
      if (target.length >= 5 && editDistance(normalized, target) <= 1)
        return command as DriveCommand;
    }
  }
  return undefined;
}

/** Commands never reach the mastery evaluator. */
export function isCommand(transcript: string): boolean {
  return matchCommand(transcript) !== undefined;
}
