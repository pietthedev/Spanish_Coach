import type { Phrase } from "@/content/schema";
import { normalizeAnswer, normalizeWithoutArticles } from "./normalize";

export type EvaluationOutcome =
  | "understood"
  | "minor-issue"
  | "meaning-error"
  | "incomplete"
  | "technical-failure"
  | "different-valid";

export interface EvaluationResult {
  outcome: EvaluationOutcome;
  label: string;
  message: string;
  transcript: string;
  matchedAnswer?: string;
  missingConcepts?: string[];
  criticalError?: string;
}

function includesAlias(normalized: string, aliases: string[]): boolean {
  return aliases.some((alias) => {
    const value = normalizeAnswer(alias);
    return (
      normalized === value ||
      normalized.startsWith(`${value} `) ||
      normalized.endsWith(` ${value}`) ||
      normalized.includes(` ${value} `)
    );
  });
}

function levenshtein(a: string, b: string): number {
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

export function evaluateAnswer(
  transcript: string,
  phrase: Phrase,
  technicalError?: string,
): EvaluationResult {
  if (technicalError)
    return {
      outcome: "technical-failure",
      label: "The microphone did not catch that",
      message: technicalError,
      transcript: "",
    };
  const normalized = normalizeAnswer(transcript, phrase.optionalWords);
  if (!normalized)
    return {
      outcome: "technical-failure",
      label: "The microphone did not catch that",
      message:
        "No clear speech was detected. Try again or continue without scoring.",
      transcript,
    };

  const accepted = phrase.acceptedAnswers.map((answer) => ({
    raw: answer,
    normalized: normalizeAnswer(answer, phrase.optionalWords),
    withoutArticles: normalizeWithoutArticles(answer, phrase.optionalWords),
  }));
  const exact = accepted.find(
    (answer) =>
      answer.normalized === normalized ||
      answer.withoutArticles ===
        normalizeWithoutArticles(transcript, phrase.optionalWords),
  );
  if (exact) {
    const isModel = exact.raw === phrase.esMX;
    return {
      outcome: isModel ? "understood" : "different-valid",
      label: isModel ? "Understood" : "Also correct",
      message: isModel
        ? "That was clear and matched the phrase."
        : "That works too. Here is the course phrase as another option.",
      transcript,
      matchedAnswer: exact.raw,
    };
  }

  for (const critical of phrase.criticalConcepts) {
    const allowed =
      phrase.criticalTerms[critical] ?? phrase.conceptAliases[critical] ?? [];
    if (!includesAlias(normalized, allowed))
      return {
        outcome: "meaning-error",
        label: "One word to fix",
        message: `The response changes the important ${critical.replaceAll("-", " ")} meaning.`,
        transcript,
        criticalError: critical,
      };
  }
  const missingConcepts = phrase.requiredConcepts.filter(
    (concept) =>
      !includesAlias(normalized, phrase.conceptAliases[concept] ?? []),
  );
  if (missingConcepts.length) {
    const heardRatio =
      (phrase.requiredConcepts.length - missingConcepts.length) /
      phrase.requiredConcepts.length;
    return {
      outcome: heardRatio >= 0.5 ? "incomplete" : "meaning-error",
      label: heardRatio >= 0.5 ? "Almost there" : "One word to fix",
      message: `Include the idea: ${missingConcepts.map((item) => item.replaceAll("-", " ")).join(", ")}.`,
      transcript,
      missingConcepts,
    };
  }

  const closest = accepted
    .map((answer) => ({
      answer,
      ratio:
        1 -
        levenshtein(normalized, answer.normalized) /
          Math.max(normalized.length, answer.normalized.length, 1),
    }))
    .sort((a, b) => b.ratio - a.ratio)[0];
  if (closest && closest.ratio >= 0.72)
    return {
      outcome: "minor-issue",
      label: "That works",
      message:
        "The important meaning was there. Listen once more and try matching the phrase rhythm.",
      transcript,
      matchedAnswer: closest.answer.raw,
    };
  return {
    outcome: "incomplete",
    label: "Almost there",
    message:
      "Part of the phrase was missing. Listen once more, then try again.",
    transcript,
  };
}
