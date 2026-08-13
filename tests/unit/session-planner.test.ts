import { describe, expect, it } from "vitest";
import { course, lessonById, phraseById } from "@/content/course";
import {
  attentionOrder,
  newPhraseAllowance,
  planPracticeSession,
  planSession,
  prioritiseDue,
  reinsertForRetry,
  type SessionStep,
} from "@/lib/learning/session-planner";
import { emptyMastery, type PhraseMastery } from "@/lib/learning/types";

const now = new Date("2026-08-20T08:00:00.000Z");
const lesson = lessonById.get("mx71.d03")!; // three new phrases

function mastery(overrides: Partial<PhraseMastery> = {}): PhraseMastery {
  return {
    ...emptyMastery("2026-08-19T08:00:00.000Z"),
    intervalStep: 2,
    encounters: 3,
    independentSuccesses: 1,
    independentDays: ["2026-08-18"],
    ...overrides,
  };
}

function due(ids: string[], overrides: Partial<PhraseMastery> = {}) {
  return new Map(ids.map((id) => [id, mastery(overrides)]));
}

const phraseIdOf = (step: SessionStep) =>
  step.kind === "scenario" ? undefined : step.phraseId;

describe("session planning", () => {
  it("runs due reviews before any new material", () => {
    const plan = planSession({
      lesson,
      phrases: phraseById,
      mastery: due(["mx.greeting.hola", "mx.polite.gracias"]),
      now,
    });
    const firstNew = plan.steps.findIndex((step) => step.origin === "new");
    const lastDue = plan.steps.findLastIndex(
      (step) => step.origin === "due-review",
    );
    expect(lastDue).toBeGreaterThanOrEqual(0);
    expect(lastDue).toBeLessThan(firstNew);
  });

  it("does not include phrases that are not yet due", () => {
    const plan = planSession({
      lesson,
      phrases: phraseById,
      mastery: new Map([
        ["mx.greeting.hola", mastery({ dueAt: "2026-09-01T08:00:00.000Z" })],
      ]),
      now,
    });
    expect(plan.steps.some((step) => step.origin === "due-review")).toBe(false);
    expect(plan.dueCount).toBe(0);
  });

  it("never tests a new phrase immediately after introducing it", () => {
    const plan = planSession({
      lesson,
      phrases: phraseById,
      mastery: new Map(),
      now,
    });
    plan.steps.forEach((step, index) => {
      if (step.kind !== "introduce") return;
      const next = plan.steps[index + 1];
      if (!next) return;
      expect(phraseIdOf(next)).not.toBe(phraseIdOf(step));
    });
  });

  it("still retrieves every introduced phrase later in the session", () => {
    const plan = planSession({
      lesson,
      phrases: phraseById,
      mastery: new Map(),
      now,
    });
    for (const phraseId of plan.newPhraseIds) {
      const introduced = plan.steps.findIndex(
        (step) => step.kind === "introduce" && step.phraseId === phraseId,
      );
      const recalled = plan.steps.findIndex(
        (step) => step.kind === "spoken-recall" && step.phraseId === phraseId,
      );
      expect(introduced).toBeGreaterThanOrEqual(0);
      expect(recalled).toBeGreaterThan(introduced);
    }
  });

  it("ends with a contextual scenario", () => {
    const plan = planSession({
      lesson,
      phrases: phraseById,
      mastery: new Map(),
      now,
    });
    expect(plan.steps.at(-1)?.kind).toBe("scenario");
  });

  it("holds back new material when the review backlog is heavy", () => {
    const backlog = due(
      course.phrases.slice(0, 9).map((phrase) => phrase.id),
      { dueAt: "2026-08-10T08:00:00.000Z" },
    );
    const plan = planSession({
      lesson,
      phrases: phraseById,
      mastery: backlog,
      now,
    });
    expect(plan.newPhraseIds).toHaveLength(1);
    expect(plan.deferredNewPhraseIds.length).toBeGreaterThan(0);
  });

  it("never blocks progress entirely, even at maximum load", () => {
    expect(newPhraseAllowance(50, 3)).toBe(1);
    expect(newPhraseAllowance(6, 3)).toBe(2);
    expect(newPhraseAllowance(0, 3)).toBe(3);
    expect(newPhraseAllowance(50, 0)).toBe(0);
  });

  it("caps the due queue so a session stays short", () => {
    const backlog = due(course.phrases.map((phrase) => phrase.id), {
      dueAt: "2026-08-10T08:00:00.000Z",
    });
    const plan = planSession({
      lesson,
      phrases: phraseById,
      mastery: backlog,
      now,
      reviewLimit: 4,
    });
    expect(plan.steps.filter((step) => step.origin === "due-review")).toHaveLength(4);
    expect(plan.dueCount).toBe(course.phrases.length);
  });

  it("uses a situation cue once a phrase is retrievable", () => {
    const plan = planSession({
      lesson,
      phrases: phraseById,
      mastery: new Map([
        [
          "mx.greeting.hola",
          mastery({ intervalStep: 2, independentSuccesses: 1 }),
        ],
      ]),
      now,
    });
    const step = plan.steps.find((item) => item.origin === "due-review");
    expect(step?.cueType).toBe("situation");
  });
});

describe("due prioritisation", () => {
  it("puts recent failures ahead of merely overdue phrases", () => {
    const ordered = prioritiseDue(
      [
        {
          phraseId: "old",
          mastery: mastery({ dueAt: "2026-08-01T08:00:00.000Z" }),
        },
        {
          phraseId: "failed",
          mastery: mastery({
            dueAt: "2026-08-19T08:00:00.000Z",
            lastOutcome: "meaning-error",
          }),
        },
      ],
      now,
    );
    expect(ordered[0]!.phraseId).toBe("failed");
  });

  it("puts hint-dependent phrases ahead of clean ones", () => {
    const ordered = prioritiseDue(
      [
        { phraseId: "clean", mastery: mastery({ lastAssistance: "none" }) },
        { phraseId: "hinted", mastery: mastery({ lastAssistance: "hint-3" }) },
      ],
      now,
    );
    expect(ordered[0]!.phraseId).toBe("hinted");
  });

  it("prefers weaker memory bands when urgency is equal", () => {
    const ordered = prioritiseDue(
      [
        {
          phraseId: "strong",
          mastery: mastery({
            intervalStep: 4,
            independentSuccesses: 3,
            independentDays: ["a", "b", "c"],
          }),
        },
        {
          phraseId: "weak",
          mastery: mastery({ intervalStep: 0, independentSuccesses: 0 }),
        },
      ],
      now,
    );
    expect(ordered[0]!.phraseId).toBe("weak");
  });
});

describe("same-day re-retrieval", () => {
  const plan = () =>
    planSession({ lesson, phrases: phraseById, mastery: due(["mx.greeting.hola"]), now });

  it("reinserts a failed phrase later rather than repeating it now", () => {
    const steps = plan().steps;
    const retried = reinsertForRetry(steps, 0, 4);
    const retryIndex = retried.findIndex((step) => step.origin === "reinserted");
    expect(retryIndex).toBeGreaterThan(1);
    expect(retried).toHaveLength(steps.length + 1);
  });

  it("changes the cue so the retry is a real retrieval", () => {
    const steps = plan().steps;
    const retried = reinsertForRetry(steps, 0, 4);
    const original = steps[0]!;
    const retry = retried.find((step) => step.origin === "reinserted")!;
    expect(retry.cueType).not.toBe(original.cueType);
  });

  it("keeps the retry before the closing scenario", () => {
    const steps = plan().steps;
    const retried = reinsertForRetry(steps, 0, 99);
    const retryIndex = retried.findIndex((step) => step.origin === "reinserted");
    const scenarioIndex = retried.findIndex((step) => step.kind === "scenario");
    expect(retryIndex).toBeLessThan(scenarioIndex);
  });

  it("does not queue the same phrase twice", () => {
    const steps = plan().steps;
    const once = reinsertForRetry(steps, 0, 4);
    const twice = reinsertForRetry(once, 0, 4);
    expect(twice).toHaveLength(once.length);
  });

  it("caps a phrase at one retry per session even after the retry is passed", () => {
    const steps = plan().steps;
    const once = reinsertForRetry(steps, 0, 2);
    const retryIndex = once.findIndex((step) => step.origin === "reinserted");
    // Failing again on the retry itself must not extend the session further.
    expect(reinsertForRetry(once, retryIndex, 2)).toHaveLength(once.length);
  });
});

describe("practice sessions", () => {
  it("builds a spoken session from due and weak phrases", () => {
    const session = planPracticeSession({
      phrases: phraseById,
      mastery: due(["mx.greeting.hola", "mx.polite.gracias"]),
      now,
      mode: "quick",
    });
    expect(session.steps.length).toBeGreaterThan(0);
    expect(session.steps.every((step) => step.kind === "spoken-recall")).toBe(true);
  });

  it("builds a comprehension session in listening mode", () => {
    const session = planPracticeSession({
      phrases: phraseById,
      mastery: due(["mx.greeting.hola"]),
      now,
      mode: "listening",
    });
    expect(session.steps[0]!.kind).toBe("listen-understand");
  });

  it("falls back to the weakest seen phrases when nothing is due", () => {
    const ordered = attentionOrder(
      new Map([
        ["mx.greeting.hola", mastery({ dueAt: "2026-09-01T08:00:00.000Z", independentSuccesses: 0 })],
        [
          "mx.polite.gracias",
          mastery({
            dueAt: "2026-09-01T08:00:00.000Z",
            intervalStep: 4,
            independentSuccesses: 3,
            independentDays: ["a", "b", "c"],
          }),
        ],
      ]),
      phraseById,
      now,
    );
    expect(ordered[0]!.phraseId).toBe("mx.greeting.hola");
  });

  it("returns nothing for a learner with no history", () => {
    const session = planPracticeSession({
      phrases: phraseById,
      mastery: new Map(),
      now,
      mode: "quick",
    });
    expect(session.steps).toHaveLength(0);
  });
});
