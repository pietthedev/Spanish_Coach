import { describe, expect, it } from "vitest";
import { phraseById } from "@/content/course";
import { buildHintLadder, assistanceForHintCount } from "@/lib/learning/hints";
import {
  applyAttempt,
  evidenceStrength,
  memoryBand,
} from "@/lib/learning/mastery";
import { emptyMastery, type PhraseMastery, type RetrievalAttempt } from "@/lib/learning/types";

const now = new Date("2026-08-20T08:00:00.000Z");

function attempt(overrides: Partial<RetrievalAttempt> = {}): RetrievalAttempt {
  return {
    phraseId: "mx.greeting.buenos_dias",
    outcome: "understood",
    assistance: "none",
    cueType: "english",
    stepKind: "spoken-recall",
    hintCount: 0,
    answerVisible: false,
    attemptNumber: 1,
    timestamp: now.toISOString(),
    ...overrides,
  };
}

function seasoned(overrides: Partial<PhraseMastery> = {}): PhraseMastery {
  return {
    ...emptyMastery(now.toISOString()),
    intervalStep: 3,
    consecutiveSuccesses: 3,
    independentSuccesses: 2,
    encounters: 5,
    independentDays: ["2026-08-16", "2026-08-18"],
    ...overrides,
  };
}

describe("evidence strength", () => {
  it("rates unaided spoken retrieval as the strongest evidence", () => {
    expect(evidenceStrength(attempt())).toBe("very-strong");
  });

  it("downgrades slow but unaided retrieval without punishing it", () => {
    expect(evidenceStrength(attempt({ responseLatencyMs: 12_000 }))).toBe(
      "strong",
    );
  });

  it("weakens evidence as the hint ladder is climbed", () => {
    expect(evidenceStrength(attempt({ assistance: "hesitated" }))).toBe("strong");
    expect(evidenceStrength(attempt({ assistance: "hint-1" }))).toBe("moderate");
    expect(evidenceStrength(attempt({ assistance: "hint-2" }))).toBe("weak");
    expect(evidenceStrength(attempt({ assistance: "hint-3" }))).toBe("weak");
  });

  it("treats a correct answer read off the screen as pronunciation only", () => {
    expect(
      evidenceStrength(
        attempt({ assistance: "answer-visible", answerVisible: true }),
      ),
    ).toBe("pronunciation-only");
    expect(
      evidenceStrength(
        attempt({ stepKind: "pronunciation-rehearsal", assistance: "repeat-only" }),
      ),
    ).toBe("pronunciation-only");
  });

  it("gives a revealed answer no retrieval credit", () => {
    expect(evidenceStrength(attempt({ assistance: "revealed" }))).toBe("none");
  });

  it("never rates comprehension as strongly as production", () => {
    expect(evidenceStrength(attempt({ stepKind: "listen-understand" }))).toBe(
      "moderate",
    );
  });
});

describe("mastery transitions", () => {
  it("advances the interval on independent retrieval", () => {
    const state = applyAttempt(seasoned(), attempt(), now);
    expect(state.intervalStep).toBe(4);
    expect(state.independentSuccesses).toBe(3);
    expect(state.dueAt).toBe("2026-09-03T08:00:00.000Z");
  });

  it("holds position when a hint was needed", () => {
    const state = applyAttempt(seasoned(), attempt({ assistance: "hint-1" }), now);
    expect(state.intervalStep).toBe(3);
    expect(state.independentSuccesses).toBe(2);
    expect(state.assistedSuccesses).toBe(1);
  });

  it("brings a heavily hinted phrase back the same day", () => {
    const state = applyAttempt(seasoned(), attempt({ assistance: "hint-3" }), now);
    expect(state.intervalStep).toBe(2);
    expect(state.dueAt).toBe("2026-08-20T08:10:00.000Z");
  });

  it("does not advance mastery for reading the answer aloud", () => {
    const before = seasoned();
    const state = applyAttempt(before, attempt({ assistance: "answer-visible" }), now);
    expect(state.intervalStep).toBe(before.intervalStep);
    expect(state.dueAt).toBe(before.dueAt);
    expect(state.independentSuccesses).toBe(before.independentSuccesses);
    expect(state.encounters).toBe(before.encounters + 1);
  });

  it("schedules a revealed phrase for immediate re-review", () => {
    const state = applyAttempt(seasoned(), attempt({ assistance: "revealed" }), now);
    expect(state.intervalStep).toBe(0);
    expect(state.dueAt).toBe("2026-08-20T08:10:00.000Z");
  });

  it("resets the interval on a meaning error", () => {
    const state = applyAttempt(seasoned(), attempt({ outcome: "meaning-error" }), now);
    expect(state.intervalStep).toBe(0);
    expect(state.consecutiveSuccesses).toBe(0);
    expect(state.dueAt).toBe("2026-08-20T08:10:00.000Z");
  });

  it("returns an incomplete answer tomorrow rather than today", () => {
    const state = applyAttempt(seasoned(), attempt({ outcome: "incomplete" }), now);
    expect(state.intervalStep).toBe(0);
    expect(state.dueAt).toBe("2026-08-21T08:00:00.000Z");
  });

  it("never penalises a technical failure", () => {
    const before = seasoned();
    const state = applyAttempt(before, attempt({ outcome: "technical-failure" }), now);
    expect(state.intervalStep).toBe(before.intervalStep);
    expect(state.dueAt).toBe(before.dueAt);
    expect(state.consecutiveSuccesses).toBe(before.consecutiveSuccesses);
    expect(state.independentSuccesses).toBe(before.independentSuccesses);
  });

  it("walks a new phrase through the full interval progression", () => {
    let state = applyAttempt(undefined, attempt(), new Date("2026-08-20T08:00:00Z"));
    expect(state.dueAt).toBe("2026-08-20T08:10:00.000Z");
    const days = ["2026-08-21", "2026-08-24", "2026-08-31", "2026-09-14", "2026-10-14"];
    let clock = new Date("2026-08-20T08:10:00Z");
    for (const expected of days) {
      state = applyAttempt(state, attempt({ timestamp: clock.toISOString() }), clock);
      expect(state.dueAt.slice(0, 10)).toBe(expected);
      clock = new Date(state.dueAt);
    }
    expect(state.intervalStep).toBe(5);
  });
});

describe("memory bands", () => {
  it("starts at new and becomes familiar after passive exposure", () => {
    expect(memoryBand(undefined)).toBe("new");
    const heard = applyAttempt(
      undefined,
      attempt({ stepKind: "introduce", assistance: "repeat-only" }),
      now,
    );
    expect(memoryBand(heard)).toBe("familiar");
  });

  it("calls an assisted success fragile, not learned", () => {
    const state = applyAttempt(undefined, attempt({ assistance: "hint-2" }), now);
    expect(memoryBand(state)).toBe("fragile");
  });

  it("reaches retrievable only after an independent delayed success", () => {
    const sameDay = applyAttempt(undefined, attempt(), now);
    expect(memoryBand(sameDay)).toBe("fragile");
    const later = applyAttempt(
      sameDay,
      attempt({ timestamp: "2026-08-21T08:00:00.000Z" }),
      new Date("2026-08-21T08:00:00Z"),
    );
    expect(memoryBand(later)).toBe("retrievable");
  });

  it("requires multiple independent days for stable and automatic", () => {
    expect(memoryBand(seasoned())).toBe("stable");
    expect(
      memoryBand(
        seasoned({
          intervalStep: 4,
          independentSuccesses: 3,
          independentDays: ["2026-08-14", "2026-08-16", "2026-08-18"],
        }),
      ),
    ).toBe("automatic");
  });
});

describe("hint ladder", () => {
  it("reveals a growing prefix without ever giving the last word", () => {
    const phrase = phraseById.get("mx.repair.slower_full")!;
    const ladder = buildHintLadder(phrase);
    expect(ladder).toHaveLength(3);
    expect(ladder[0]!.text.endsWith("…")).toBe(true);
    for (const hint of ladder) expect(hint.text).not.toContain(phrase.esMX);
    expect(ladder[0]!.text.length).toBeLessThan(ladder[2]!.text.length);
  });

  it("falls back to letters for single-word phrases", () => {
    const phrase = phraseById.get("mx.polite.gracias")!;
    const ladder = buildHintLadder(phrase);
    const revealed = ladder.map((hint) => hint.text.replace("…", ""));
    for (const text of revealed) {
      expect(phrase.esMX.startsWith(text)).toBe(true);
      expect(text).not.toBe(phrase.esMX);
    }
    expect(revealed[0]!.length).toBeLessThan(revealed[2]!.length);
  });

  it("maps interaction state onto an assistance level", () => {
    expect(assistanceForHintCount(0, false, false, false)).toBe("none");
    expect(assistanceForHintCount(0, false, false, true)).toBe("hesitated");
    expect(assistanceForHintCount(2, false, false, true)).toBe("hint-2");
    expect(assistanceForHintCount(3, true, false, false)).toBe("revealed");
    expect(assistanceForHintCount(0, false, true, false)).toBe("answer-visible");
  });
});
