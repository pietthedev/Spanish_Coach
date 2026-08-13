import type { Phrase } from "@/content/schema";
import type { AssistanceLevel } from "./types";

export interface Hint {
  level: 1 | 2 | 3;
  text: string;
  support: string;
}

const HINT_SUPPORT = [
  "Here is how it starts. Try to build the rest.",
  "A little more of the shape. Keep going.",
  "Almost the whole phrase — finish it out loud.",
] as const;

function words(esMX: string): string[] {
  return esMX.trim().split(/\s+/).filter(Boolean);
}

/**
 * Reveal a growing prefix of the target. A three-level ladder never shows the
 * final word, so even hint 3 still requires the learner to produce something.
 */
export function buildHintLadder(phrase: Phrase): Hint[] {
  const parts = words(phrase.esMX);
  if (parts.length === 1) return singleWordLadder(parts[0]!);
  return [1, 2, 3].map((level) => {
    const revealed = Math.max(
      1,
      Math.min(parts.length - 1, Math.ceil((parts.length * level) / 4)),
    );
    return {
      level: level as 1 | 2 | 3,
      text: `${parts.slice(0, revealed).join(" ")} …`,
      support: HINT_SUPPORT[level - 1]!,
    };
  });
}

function singleWordLadder(word: string): Hint[] {
  const letters = [...word];
  return [1, 2, 3].map((level) => {
    const revealed = Math.max(
      1,
      Math.min(letters.length - 1, Math.ceil((letters.length * level) / 4)),
    );
    return {
      level: level as 1 | 2 | 3,
      text: `${letters.slice(0, revealed).join("")}…`,
      support: HINT_SUPPORT[level - 1]!,
    };
  });
}

/** A structural cue that costs less than a hint: how long the answer is. */
export function shapeCue(phrase: Phrase): string {
  const count = words(phrase.esMX).length;
  return count === 1 ? "One word." : `${count} words.`;
}

export function assistanceForHintCount(
  hintCount: number,
  revealed: boolean,
  answerVisible: boolean,
  hesitated: boolean,
): AssistanceLevel {
  if (answerVisible) return "answer-visible";
  if (revealed) return "revealed";
  if (hintCount >= 3) return "hint-3";
  if (hintCount === 2) return "hint-2";
  if (hintCount === 1) return "hint-1";
  return hesitated ? "hesitated" : "none";
}
