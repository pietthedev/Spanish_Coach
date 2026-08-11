import { courseSchema, type Course } from "./schema.ts";
import { normalizeAnswer } from "../lib/evaluation/normalize.ts";

export function validateCourse(input: unknown): Course {
  const parsed = courseSchema.parse(input);
  const allIds = [
    ...parsed.phrases.map((p) => p.id),
    ...parsed.lessons.map((l) => l.id),
    ...parsed.scenarios.map((s) => s.id),
    ...parsed.lessons.flatMap((l) => l.exercises.map((e) => e.id)),
    ...parsed.scenarios.flatMap((s) => s.turns.map((t) => `${s.id}:${t.id}`)),
  ];
  const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index);
  if (duplicates.length)
    throw new Error(
      `Duplicate content IDs: ${[...new Set(duplicates)].join(", ")}`,
    );

  const phraseIds = new Set(parsed.phrases.map((p) => p.id));
  const expectedStart = Date.UTC(2026, 7, 10);
  for (const lesson of parsed.lessons) {
    const expectedDate = new Date(expectedStart + (lesson.day - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    if (lesson.date !== expectedDate)
      throw new Error(
        `${lesson.id} date ${lesson.date} must be ${expectedDate}`,
      );
    if (lesson.day !== 7 && lesson.newPhraseIds.length > 3)
      throw new Error(`${lesson.id} introduces more than three chunks`);
    for (const phraseId of [...lesson.newPhraseIds, ...lesson.reviewPhraseIds])
      if (!phraseIds.has(phraseId))
        throw new Error(`${lesson.id} references missing phrase ${phraseId}`);
  }
  for (const phrase of parsed.phrases) {
    if (!phrase.audio.normal.src || !phrase.audio.slow.src)
      throw new Error(`${phrase.id} is missing audio references`);
    if (
      phrase.reviewStatus.linguistic === undefined ||
      phrase.reviewStatus.mexicanUsage === undefined
    )
      throw new Error(`${phrase.id} lacks review status`);
    for (const answer of phrase.acceptedAnswers) {
      const normalized = normalizeAnswer(answer, phrase.optionalWords);
      for (const concept of phrase.requiredConcepts) {
        const aliases = phrase.conceptAliases[concept] ?? [];
        if (
          !aliases.some((alias) => normalized.includes(normalizeAnswer(alias)))
        )
          throw new Error(
            `${phrase.id} accepted answer “${answer}” lacks required concept ${concept}`,
          );
      }
    }
  }
  for (const scenario of parsed.scenarios) {
    const turnIds = new Set(scenario.turns.map((t) => t.id));
    if (!turnIds.has(scenario.startTurnId))
      throw new Error(`${scenario.id} has missing start turn`);
    for (const turn of scenario.turns) {
      if (turn.next && !turnIds.has(turn.next))
        throw new Error(
          `${scenario.id}:${turn.id} points to missing turn ${turn.next}`,
        );
      for (const phraseId of turn.acceptedPhraseIds)
        if (!phraseIds.has(phraseId))
          throw new Error(
            `${scenario.id}:${turn.id} references missing phrase ${phraseId}`,
          );
    }
  }
  return parsed;
}
