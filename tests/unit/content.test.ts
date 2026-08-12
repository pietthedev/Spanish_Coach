import { describe, expect, it } from "vitest";
import { course } from "@/content/course";
import { validateCourse } from "@/content/validate";

describe("course content", () => {
  it("validates all seven scheduled days", () => {
    const parsed = validateCourse(course);
    expect(parsed.lessons.map((lesson) => lesson.date)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
  });
  it("has at most three new productive chunks per normal lesson", () => {
    for (const lesson of course.lessons.slice(0, 6))
      expect(lesson.newPhraseIds.length).toBeLessThanOrEqual(3);
  });
  it("marks every phrase for Mexican-Spanish human review", () => {
    expect(
      course.phrases.every(
        (phrase) => phrase.reviewStatus.mexicanUsage === "required",
      ),
    ).toBe(true);
  });
  it("includes slow and normal audio references", () => {
    expect(
      course.phrases.every(
        (phrase) => phrase.audio.slow.src && phrase.audio.normal.src,
      ),
    ).toBe(true);
  });
  it("varies the correct choice position in listening exercises", () => {
    const listeningExercises = course.lessons
      .flatMap((lesson) => lesson.exercises)
      .filter((exercise) => exercise.type === "listen-choice");
    const answerPositions = listeningExercises.map((exercise) =>
      exercise.options.indexOf(exercise.answer),
    );

    expect(answerPositions).toContain(0);
    expect(answerPositions).toContain(1);
    expect(answerPositions).toContain(2);
    expect(answerPositions.every((position) => position >= 0)).toBe(true);
  });
});
