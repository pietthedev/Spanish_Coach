import type { Phrase } from "@/content/schema";
import type { Lesson } from "@/content/runtime-types";
import { cueForBand } from "./cue";
import { bandRank, memoryBand } from "./mastery";
import type { CueType, PhraseMastery, StepKind } from "./types";

export type StepOrigin = "due-review" | "new" | "practice" | "reinserted";

export interface PhraseStep {
  id: string;
  kind: Exclude<StepKind, "scenario">;
  phraseId: string;
  cueType: CueType;
  origin: StepOrigin;
  options?: string[];
  answer?: string;
}

export interface ScenarioStep {
  id: string;
  kind: "scenario";
  phraseIds: string[];
  prompt: string;
  cueType: "situation";
  origin: StepOrigin;
}

export type SessionStep = PhraseStep | ScenarioStep;

export interface SessionPlan {
  steps: SessionStep[];
  dueCount: number;
  newPhraseIds: string[];
  deferredNewPhraseIds: string[];
}

export interface PlannerInput {
  lesson: Lesson;
  phrases: ReadonlyMap<string, Phrase>;
  mastery: ReadonlyMap<string, PhraseMastery>;
  now: Date;
  /** Hard ceiling on due reviews in one session, keeping it to 5–10 minutes. */
  reviewLimit?: number;
}

const DEFAULT_REVIEW_LIMIT = 5;

/** Review load at which new material starts being held back. */
const HEAVY_REVIEW_LOAD = 8;
const MODERATE_REVIEW_LOAD = 5;

export interface DueCandidate {
  phraseId: string;
  mastery: PhraseMastery;
}

/**
 * Order due phrases by how much they need attention: recent failures first,
 * then hint-dependent phrases, then weak bands, then the most overdue.
 */
export function prioritiseDue(
  candidates: DueCandidate[],
  now: Date,
): DueCandidate[] {
  return [...candidates].sort((a, b) => {
    const urgency = urgencyScore(b.mastery) - urgencyScore(a.mastery);
    if (urgency !== 0) return urgency;
    const band = bandRank(memoryBand(a.mastery)) - bandRank(memoryBand(b.mastery));
    if (band !== 0) return band;
    const overdue =
      overdueMs(b.mastery, now) - overdueMs(a.mastery, now);
    if (overdue !== 0) return overdue;
    return a.phraseId.localeCompare(b.phraseId);
  });
}

function urgencyScore(mastery: PhraseMastery): number {
  let score = 0;
  if (mastery.lastOutcome === "meaning-error") score += 100;
  else if (mastery.lastOutcome === "incomplete") score += 80;
  if (mastery.lastAssistance === "revealed") score += 60;
  else if (mastery.lastAssistance === "hint-3") score += 40;
  else if (mastery.lastAssistance === "hint-2") score += 30;
  else if (mastery.lastAssistance === "hint-1") score += 15;
  return score;
}

function overdueMs(mastery: PhraseMastery, now: Date): number {
  return Math.max(0, now.getTime() - new Date(mastery.dueAt).getTime());
}

export function selectDuePhrases(
  mastery: ReadonlyMap<string, PhraseMastery>,
  now: Date,
  limit = DEFAULT_REVIEW_LIMIT,
): DueCandidate[] {
  const due: DueCandidate[] = [];
  for (const [phraseId, record] of mastery)
    if (new Date(record.dueAt) <= now) due.push({ phraseId, mastery: record });
  return prioritiseDue(due, now).slice(0, limit);
}

/**
 * Cognitive load control. A collapsing back catalogue takes precedence over
 * the course calendar, but the learner is never fully blocked from progress.
 */
export function newPhraseAllowance(dueCount: number, requested: number): number {
  if (requested === 0) return 0;
  if (dueCount >= HEAVY_REVIEW_LOAD) return 1;
  if (dueCount >= MODERATE_REVIEW_LOAD) return Math.min(2, requested);
  return requested;
}

export function planSession(input: PlannerInput): SessionPlan {
  const { lesson, phrases, mastery, now } = input;
  const reviewLimit =
    input.reviewLimit ?? dueReviewLimit(lesson) ?? DEFAULT_REVIEW_LIMIT;

  const allDue = selectDuePhrases(mastery, now, Number.MAX_SAFE_INTEGER).filter(
    (candidate) => phrases.has(candidate.phraseId),
  );
  const due = allDue.slice(0, reviewLimit);
  const requestedNew = lesson.newPhraseIds.filter((id) => phrases.has(id));
  const allowance = newPhraseAllowance(allDue.length, requestedNew.length);
  const newPhraseIds = requestedNew.slice(0, allowance);
  const deferredNewPhraseIds = requestedNew.slice(allowance);

  const steps: SessionStep[] = [];

  // Due material comes before new material, always.
  for (const candidate of due) {
    const phrase = phrases.get(candidate.phraseId)!;
    steps.push({
      id: `due.${candidate.phraseId}`,
      kind: "spoken-recall",
      phraseId: candidate.phraseId,
      cueType: cueForBand(
        memoryBand(candidate.mastery),
        phrase.likelyReplies.length > 0,
      ),
      origin: "due-review",
    });
  }

  // Introduce new phrases, always separating a phrase from its own recall.
  newPhraseIds.forEach((phraseId, index) => {
    steps.push({
      id: `new.${phraseId}.introduce`,
      kind: "introduce",
      phraseId,
      cueType: "english",
      origin: "new",
    });
    const earlier = newPhraseIds[index - 1];
    if (earlier)
      steps.push({
        id: `new.${earlier}.recall`,
        kind: "spoken-recall",
        phraseId: earlier,
        cueType: "english",
        origin: "new",
      });
  });

  // Interference between the last introduction and its delayed retrieval.
  const listen = listenStep(lesson, phrases, newPhraseIds, due);
  if (listen) steps.push(listen);

  const last = newPhraseIds.at(-1);
  if (last)
    steps.push({
      id: `new.${last}.recall`,
      kind: "spoken-recall",
      phraseId: last,
      cueType: "english",
      origin: "new",
    });

  const scenario = scenarioStep(lesson, phrases, newPhraseIds, due);
  if (scenario) steps.push(scenario);

  return {
    steps,
    dueCount: allDue.length,
    newPhraseIds,
    deferredNewPhraseIds,
  };
}

function dueReviewLimit(lesson: Lesson): number | undefined {
  const exercise = lesson.exercises.find((item) => item.type === "due-review");
  return exercise?.type === "due-review" ? exercise.limit : undefined;
}

function listenStep(
  lesson: Lesson,
  phrases: ReadonlyMap<string, Phrase>,
  newPhraseIds: string[],
  due: DueCandidate[],
): PhraseStep | undefined {
  const authored = lesson.exercises.find((item) => item.type === "listen-choice");
  if (authored?.type === "listen-choice" && phrases.has(authored.phraseId))
    return {
      id: authored.id,
      kind: "listen-understand",
      phraseId: authored.phraseId,
      cueType: "spanish-audio",
      origin: "practice",
      options: authored.options,
      answer: authored.answer,
    };
  const fallback = due[0]?.phraseId ?? newPhraseIds[0];
  if (!fallback) return undefined;
  const phrase = phrases.get(fallback);
  if (!phrase) return undefined;
  return {
    id: `listen.${fallback}`,
    kind: "listen-understand",
    phraseId: fallback,
    cueType: "spanish-audio",
    origin: "practice",
    options: buildOptions(phrase, phrases),
    answer: phrase.english,
  };
}

function buildOptions(
  answer: Phrase,
  phrases: ReadonlyMap<string, Phrase>,
): string[] {
  const others = [...phrases.values()]
    .filter((item) => item.id !== answer.id)
    .slice(0, 2)
    .map((item) => item.english);
  return [answer.english, ...others].sort((a, b) => a.localeCompare(b));
}

function scenarioStep(
  lesson: Lesson,
  phrases: ReadonlyMap<string, Phrase>,
  newPhraseIds: string[],
  due: DueCandidate[],
): ScenarioStep | undefined {
  const authored = lesson.exercises.find(
    (item) => item.type === "micro-scenario",
  );
  const phraseIds = (
    authored?.type === "micro-scenario"
      ? authored.phraseIds
      : [...newPhraseIds, ...due.map((item) => item.phraseId)]
  ).filter((id) => phrases.has(id));
  if (!phraseIds.length) return undefined;
  return {
    id: authored?.id ?? `${lesson.id}.scenario`,
    kind: "scenario",
    phraseIds,
    prompt:
      authored?.type === "micro-scenario"
        ? authored.prompt
        : "Put today's phrases together out loud.",
    cueType: "situation",
    origin: "practice",
  };
}

export type PracticeMode = "quick" | "speaking" | "listening";

export interface PracticeInput {
  phrases: ReadonlyMap<string, Phrase>;
  mastery: ReadonlyMap<string, PhraseMastery>;
  now: Date;
  mode: PracticeMode;
  limit?: number;
}

/**
 * Phrases worth attention: due ones first, then the weakest seen phrases even
 * if they are not yet due, so Practice is never empty for an active learner.
 */
export function attentionOrder(
  mastery: ReadonlyMap<string, PhraseMastery>,
  phrases: ReadonlyMap<string, Phrase>,
  now: Date,
): DueCandidate[] {
  const seen = [...mastery.entries()]
    .filter(([phraseId]) => phrases.has(phraseId))
    .map(([phraseId, record]) => ({ phraseId, mastery: record }));
  const due = seen.filter((item) => new Date(item.mastery.dueAt) <= now);
  const rest = seen
    .filter((item) => new Date(item.mastery.dueAt) > now)
    .sort(
      (a, b) =>
        bandRank(memoryBand(a.mastery)) - bandRank(memoryBand(b.mastery)),
    );
  return [...prioritiseDue(due, now), ...rest];
}

export function planPracticeSession(input: PracticeInput): SessionPlan {
  const { phrases, mastery, now, mode } = input;
  const limit = input.limit ?? (mode === "quick" ? 3 : 5);
  const candidates = attentionOrder(mastery, phrases, now).slice(0, limit);
  const dueCount = [...mastery.values()].filter(
    (record) => new Date(record.dueAt) <= now,
  ).length;

  const steps: SessionStep[] = candidates.map((candidate) => {
    const phrase = phrases.get(candidate.phraseId)!;
    if (mode === "listening")
      return {
        id: `practice.listen.${candidate.phraseId}`,
        kind: "listen-understand",
        phraseId: candidate.phraseId,
        cueType: "spanish-audio",
        origin: "practice",
        options: buildOptions(phrase, phrases),
        answer: phrase.english,
      } satisfies PhraseStep;
    return {
      id: `practice.recall.${candidate.phraseId}`,
      kind: "spoken-recall",
      phraseId: candidate.phraseId,
      cueType: cueForBand(
        memoryBand(candidate.mastery),
        phrase.likelyReplies.length > 0,
      ),
      origin: "practice",
    } satisfies PhraseStep;
  });

  return { steps, dueCount, newPhraseIds: [], deferredNewPhraseIds: [] };
}

/**
 * Same-day spacing: a failed phrase comes back later in this session rather
 * than immediately, so the retry is a real retrieval and not an echo.
 */
export function reinsertForRetry(
  steps: SessionStep[],
  currentIndex: number,
  gap = 4,
): SessionStep[] {
  const step = steps[currentIndex];
  if (!step || step.kind === "scenario") return steps;
  // One retry per phrase per session. Without this cap a phrase the learner
  // keeps missing would extend the session indefinitely.
  const alreadyRetried = steps.some(
    (item) =>
      item.kind !== "scenario" &&
      item.phraseId === step.phraseId &&
      item.origin === "reinserted",
  );
  if (alreadyRetried) return steps;

  const retry: PhraseStep = {
    ...step,
    id: `${step.id}.retry`,
    kind: "spoken-recall",
    cueType: step.cueType === "english" ? "situation" : "english",
    origin: "reinserted",
  };
  const scenarioIndex = steps.findIndex((item) => item.kind === "scenario");
  const ceiling = scenarioIndex === -1 ? steps.length : scenarioIndex;
  const target = Math.min(Math.max(currentIndex + gap, currentIndex + 1), ceiling);
  return [...steps.slice(0, target), retry, ...steps.slice(target)];
}
