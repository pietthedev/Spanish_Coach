import { describe, expect, it } from "vitest";
import { course, phraseById } from "@/content/course";
import {
  DRIVE_PROFILES,
  buildConversationChain,
  newPhraseAllowanceForDrive,
  pickClosingPhrase,
  planDriveSession,
  responsePairs,
} from "@/lib/drive/planner";
import { INTRO_SECONDS, OUTRO_SECONDS, type DriveDuration } from "@/lib/drive/types";
import { emptyMastery, type PhraseMastery } from "@/lib/learning/types";

const now = new Date("2026-08-20T08:00:00.000Z");
const ALL_IDS = course.phrases.map((phrase) => phrase.id);

function record(overrides: Partial<PhraseMastery> = {}): PhraseMastery {
  return {
    ...emptyMastery("2026-08-19T08:00:00.000Z"),
    intervalStep: 2,
    encounters: 4,
    independentSuccesses: 1,
    independentDays: ["2026-08-18"],
    ...overrides,
  };
}

function masteryFor(ids: string[], overrides: Partial<PhraseMastery> = {}) {
  return new Map(ids.map((id) => [id, record(overrides)]));
}

const plan = (duration: DriveDuration, mastery: Map<string, PhraseMastery>, newIds: string[] = []) =>
  planDriveSession({
    duration,
    phrases: phraseById,
    mastery,
    scenarios: course.scenarios,
    newPhraseIds: newIds,
    now,
  });

describe("drive session budget", () => {
  it.each([10, 15, 20] as DriveDuration[])(
    "fills roughly the %i minute budget without overrunning it",
    (duration) => {
      const session = plan(duration, masteryFor(ALL_IDS));
      const seconds = session.activities.reduce(
        (total, activity) => total + activity.estimatedSeconds,
        0,
      );
      const budget = duration * 60 - INTRO_SECONDS - OUTRO_SECONDS;
      expect(seconds).toBeGreaterThan(budget * 0.6);
      // One activity may straddle the budget; the drive is never cut mid-answer.
      expect(seconds).toBeLessThanOrEqual(budget + 60);
      expect(session.targetMs).toBe(duration * 60_000);
    },
  );

  it("starts wrapping a minute before the target", () => {
    expect(plan(10, masteryFor(ALL_IDS)).wrapAfterMs).toBe(9 * 60_000);
    expect(plan(15, masteryFor(ALL_IDS)).wrapAfterMs).toBe(14 * 60_000);
    expect(plan(20, masteryFor(ALL_IDS)).wrapAfterMs).toBe(19 * 60_000);
  });

  it("gives longer drives more activities", () => {
    const mastery = masteryFor(ALL_IDS);
    expect(plan(20, mastery).activities.length).toBeGreaterThan(
      plan(10, mastery).activities.length,
    );
  });
});

describe("drive session composition", () => {
  const share = (duration: DriveDuration, kinds: string[]) => {
    const session = plan(duration, masteryFor(ALL_IDS), ["mx.polite.please"]);
    const total = session.activities.reduce((n, a) => n + a.estimatedSeconds, 0);
    const matched = session.activities
      .filter((a) => kinds.includes(a.kind))
      .reduce((n, a) => n + a.estimatedSeconds, 0);
    return matched / total;
  };

  it("weights the quick drive heavily towards retrieval", () => {
    expect(
      share(10, ["contextual-recall", "intent-recall", "listen-respond"]),
    ).toBeGreaterThan(0.7);
  });

  it("keeps a deep drive more balanced than a quick one", () => {
    const quick = share(10, ["listen-meaning", "conversation"]);
    const deep = share(20, ["listen-meaning", "conversation"]);
    expect(deep).toBeGreaterThan(quick);
  });

  it("always leaves retrieval as the majority of any drive", () => {
    for (const duration of [10, 15, 20] as DriveDuration[])
      expect(
        share(duration, ["contextual-recall", "intent-recall", "listen-respond"]),
      ).toBeGreaterThan(0.5);
  });
});

describe("new material control", () => {
  it("keeps new vocabulary out of a quick drive under review load", () => {
    const session = plan(10, masteryFor(ALL_IDS, { dueAt: "2026-08-01T08:00:00.000Z" }), [
      "mx.polite.please",
    ]);
    expect(session.newPhraseIds).toHaveLength(0);
    expect(session.activities.some((a) => a.kind === "shadow")).toBe(false);
  });

  it("allows one new phrase on a quiet quick drive", () => {
    const quiet = masteryFor(
      ALL_IDS.filter((id) => id !== "mx.polite.please"),
      { dueAt: "2026-09-01T08:00:00.000Z" },
    );
    expect(plan(10, quiet, ["mx.polite.please"]).newPhraseIds).toHaveLength(1);
  });

  it("treats an already-seen phrase as review, never as new", () => {
    const seen = masteryFor(ALL_IDS, { dueAt: "2026-09-01T08:00:00.000Z" });
    expect(plan(15, seen, ["mx.polite.please"]).newPhraseIds).toHaveLength(0);
  });

  it("supports balanced review and new material on the daily drive", () => {
    const quiet = masteryFor(["mx.greeting.hola"], { dueAt: "2026-09-01T08:00:00.000Z" });
    const session = plan(15, quiet, ["mx.polite.please", "mx.polite.you_are_welcome"]);
    expect(session.newPhraseIds).toHaveLength(2);
  });

  it("does not add more vocabulary just because the drive is longer", () => {
    const quiet = masteryFor(["mx.greeting.hola"], { dueAt: "2026-09-01T08:00:00.000Z" });
    const fifteen = plan(15, quiet, ALL_IDS.slice(5)).newPhraseIds.length;
    const twenty = plan(20, quiet, ALL_IDS.slice(5)).newPhraseIds.length;
    expect(twenty).toBe(fifteen);
    expect(twenty).toBeLessThanOrEqual(2);
  });

  it("caps new material by review burden", () => {
    expect(newPhraseAllowanceForDrive(10, 9, 3)).toBe(0);
    expect(newPhraseAllowanceForDrive(15, 9, 3)).toBe(1);
    expect(newPhraseAllowanceForDrive(20, 2, 3)).toBe(2);
    expect(newPhraseAllowanceForDrive(15, 0, 0)).toBe(0);
  });

  it("never tests a new phrase immediately after teaching it", () => {
    const quiet = masteryFor(["mx.greeting.hola"], { dueAt: "2026-09-01T08:00:00.000Z" });
    for (const duration of [15, 20] as DriveDuration[]) {
      const session = plan(duration, quiet, ["mx.polite.please"]);
      const taught = session.activities.findIndex((a) => a.kind === "shadow");
      const recalled = session.activities.findIndex(
        (a, i) => i > taught && a.phraseId === "mx.polite.please" && a.kind !== "shadow",
      );
      expect(taught).toBeGreaterThanOrEqual(0);
      expect(recalled).toBeGreaterThan(taught + 1);
    }
  });

  it("spaces encoding and recall more widely on a deep drive", () => {
    const quiet = masteryFor(["mx.greeting.hola"], { dueAt: "2026-09-01T08:00:00.000Z" });
    const gapFor = (duration: DriveDuration) => {
      const session = plan(duration, quiet, ["mx.polite.please"]);
      const taught = session.activities.findIndex((a) => a.kind === "shadow");
      const recalled = session.activities.findIndex(
        (a, i) => i > taught && a.phraseId === "mx.polite.please" && a.kind !== "shadow",
      );
      return recalled - taught;
    };
    expect(gapFor(20)).toBeGreaterThan(gapFor(15));
    expect(DRIVE_PROFILES[20].newPhraseGap).toBeGreaterThan(
      DRIVE_PROFILES[15].newPhraseGap,
    );
  });
});

describe("prioritisation", () => {
  it("opens on the phrase that failed most recently", () => {
    const mastery = masteryFor(ALL_IDS, { dueAt: "2026-08-19T08:00:00.000Z" });
    mastery.set(
      "mx.repair.slower_full",
      record({ dueAt: "2026-08-19T08:00:00.000Z", lastOutcome: "meaning-error" }),
    );
    const session = plan(15, mastery);
    expect(session.activities[0]!.phraseId).toBe("mx.repair.slower_full");
  });

  it("puts hint-dependent phrases ahead of clean ones", () => {
    const mastery = new Map([
      ["mx.greeting.hola", record({ dueAt: "2026-08-19T08:00:00.000Z" })],
      [
        "mx.polite.gracias",
        record({ dueAt: "2026-08-19T08:00:00.000Z", lastAssistance: "hint-3" }),
      ],
    ]);
    expect(plan(10, mastery).activities[0]!.phraseId).toBe("mx.polite.gracias");
  });

  it("does not drill automatic phrases at the expense of weak ones", () => {
    const mastery = new Map([
      [
        "mx.greeting.hola",
        record({
          dueAt: "2026-08-19T08:00:00.000Z",
          intervalStep: 5,
          independentSuccesses: 4,
          independentDays: ["a", "b", "c"],
        }),
      ],
      [
        "mx.polite.gracias",
        record({
          dueAt: "2026-08-19T08:00:00.000Z",
          intervalStep: 0,
          independentSuccesses: 0,
        }),
      ],
    ]);
    expect(plan(10, mastery).activities[0]!.phraseId).toBe("mx.polite.gracias");
  });

  it("reports the real due count even when the drive cannot cover it", () => {
    const session = plan(10, masteryFor(ALL_IDS, { dueAt: "2026-08-01T08:00:00.000Z" }));
    expect(session.dueCount).toBe(ALL_IDS.length);
  });
});

describe("conversation chains", () => {
  it("uses authored scenario turns and stays inside known vocabulary", () => {
    const chain = buildConversationChain(
      course.scenarios,
      phraseById,
      masteryFor(ALL_IDS),
      3,
    );
    expect(chain.length).toBeGreaterThan(0);
    expect(chain.length).toBeLessThanOrEqual(3);
    for (const turn of chain) {
      expect(phraseById.has(turn.phraseId)).toBe(true);
      expect(turn.kind).toBe("conversation");
    }
    expect(chain[0]!.chainIntro).toBeTruthy();
  });

  it("skips turns whose phrases the learner has never met", () => {
    const chain = buildConversationChain(
      course.scenarios,
      phraseById,
      new Map(),
      3,
    );
    expect(chain).toHaveLength(0);
  });

  it("appears in longer drives", () => {
    const session = plan(20, masteryFor(ALL_IDS));
    expect(session.activities.some((a) => a.kind === "conversation")).toBe(true);
  });
});

describe("response pairing", () => {
  it("pairs a spoken trigger with the course phrase that answers it", () => {
    const pairs = responsePairs(phraseById);
    expect(pairs.get("mx.polite.you_are_welcome")?.esMX).toBe("Gracias");
    expect(pairs.get("mx.intro.nice_to_meet")?.esMX).toBeTruthy();
  });

  it("never asks the learner to respond without something to respond to", () => {
    const session = plan(20, masteryFor(ALL_IDS, {
      intervalStep: 5,
      independentSuccesses: 4,
      independentDays: ["a", "b", "c"],
    }));
    for (const activity of session.activities)
      if (activity.kind === "listen-respond")
        expect(activity.hostLine?.esMX).toBeTruthy();
  });
});

describe("closing phrase", () => {
  it("ends on the learner's strongest independent phrase", () => {
    const mastery = new Map([
      ["mx.repair.slower_full", record({ independentSuccesses: 0, intervalStep: 0 })],
      [
        "mx.polite.gracias",
        record({
          intervalStep: 5,
          independentSuccesses: 4,
          independentDays: ["a", "b", "c"],
        }),
      ],
    ]);
    expect(pickClosingPhrase(mastery, phraseById, ALL_IDS)).toBe("mx.polite.gracias");
    expect(plan(10, mastery).closingPhraseId).toBe("mx.polite.gracias");
  });

  it("falls back when nothing has been retrieved independently yet", () => {
    expect(
      pickClosingPhrase(new Map(), phraseById, ["mx.greeting.hola"]),
    ).toBe("mx.greeting.hola");
  });
});

describe("offline planning", () => {
  it("plans entirely from local mastery with no server input", () => {
    const session = plan(15, masteryFor(ALL_IDS));
    expect(session.activities.length).toBeGreaterThan(0);
    expect(OUTRO_SECONDS).toBeGreaterThan(0);
  });

  it("still produces a drive for a learner with no history", () => {
    const session = plan(15, new Map(), ["mx.greeting.hola"]);
    expect(session.newPhraseIds).toEqual(["mx.greeting.hola"]);
    expect(session.activities.some((a) => a.kind === "shadow")).toBe(true);
  });
});
