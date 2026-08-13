import { beforeEach, describe, expect, it } from "vitest";
import { ACTIVITY_STEP_KIND, type DriveActivityKind } from "@/lib/drive/types";
import { toneFor } from "@/lib/drive/machine";
import { applyAttempt, evidenceStrength, memoryBand } from "@/lib/learning/mastery";
import { emptyMastery, type RetrievalAttempt } from "@/lib/learning/types";
import { getDb } from "@/lib/offline/db";
import {
  loadMastery,
  recordDriveSession,
  recordPhraseAttempt,
} from "@/lib/offline/progress";

const profileId = "driver-1";
const phraseId = "mx.repair.slower_full";
const now = new Date("2026-08-20T08:00:00.000Z");

function driveAttempt(
  kind: DriveActivityKind,
  overrides: Partial<RetrievalAttempt> = {},
): RetrievalAttempt {
  return {
    phraseId,
    outcome: "understood",
    assistance: "none",
    cueType: "situation",
    stepKind: ACTIVITY_STEP_KIND[kind],
    hintCount: 0,
    answerVisible: false,
    attemptNumber: 1,
    timestamp: now.toISOString(),
    ...overrides,
  };
}

beforeEach(async () => {
  const db = getDb();
  await db.phraseMastery.clear();
  await db.outbox.clear();
});

describe("drive activities map onto the shared mastery engine", () => {
  it("treats spoken production as the strongest evidence", () => {
    expect(evidenceStrength(driveAttempt("contextual-recall"))).toBe("very-strong");
    expect(evidenceStrength(driveAttempt("intent-recall"))).toBe("very-strong");
    expect(evidenceStrength(driveAttempt("conversation"))).toBe("very-strong");
    expect(evidenceStrength(driveAttempt("listen-respond"))).toBe("very-strong");
  });

  it("never lets comprehension score as highly as production", () => {
    expect(evidenceStrength(driveAttempt("listen-meaning"))).toBe("moderate");
  });

  it("scores repeating after hearing the answer as encoding only", () => {
    expect(
      evidenceStrength(driveAttempt("shadow", { assistance: "repeat-only" })),
    ).toBe("pronunciation-only");
  });

  it("weakens evidence as spoken hints are used", () => {
    expect(
      evidenceStrength(driveAttempt("contextual-recall", { assistance: "hint-1" })),
    ).toBe("moderate");
    expect(
      evidenceStrength(driveAttempt("contextual-recall", { assistance: "hint-3" })),
    ).toBe("weak");
  });

  it("does not advance the schedule for a shadowed repetition", () => {
    const before = { ...emptyMastery(now.toISOString()), intervalStep: 3, encounters: 2 };
    const after = applyAttempt(
      before,
      driveAttempt("shadow", { assistance: "repeat-only" }),
      now,
    );
    expect(after.dueAt).toBe(before.dueAt);
    expect(after.independentSuccesses).toBe(0);
  });
});

describe("drive attempts persist to the same records as lessons", () => {
  it("writes mastery and queues one phrase_reviewed event", async () => {
    await recordPhraseAttempt(profileId, driveAttempt("contextual-recall"), now);
    const stored = (await loadMastery(profileId)).get(phraseId)!;
    expect(stored.independentSuccesses).toBe(1);

    const events = await getDb().outbox.toArray();
    expect(events.map((event) => event.type)).toEqual(["phrase_reviewed"]);
  });

  it("continues a phrase the visual lesson already started", async () => {
    // A weak lesson attempt in the morning...
    await recordPhraseAttempt(
      profileId,
      driveAttempt("contextual-recall", {
        stepKind: "spoken-recall",
        outcome: "incomplete",
        assistance: "hint-2",
      }),
      now,
    );
    const midday = (await loadMastery(profileId)).get(phraseId)!;
    expect(memoryBand(midday)).toBe("familiar");

    // ...strengthened by an unaided drive retrieval that evening.
    const evening = new Date("2026-08-21T17:00:00.000Z");
    await recordPhraseAttempt(
      profileId,
      driveAttempt("contextual-recall", { timestamp: evening.toISOString() }),
      evening,
    );
    const after = (await loadMastery(profileId)).get(phraseId)!;
    expect(after.independentSuccesses).toBe(1);
    expect(after.encounters).toBe(2);
    expect(await getDb().phraseMastery.count()).toBe(1);
  });

  it("keeps drivers on separate profiles apart", async () => {
    await recordPhraseAttempt(profileId, driveAttempt("intent-recall"), now);
    await recordPhraseAttempt("driver-2", driveAttempt("intent-recall"), now);
    expect((await loadMastery(profileId)).size).toBe(1);
    expect((await loadMastery("driver-2")).size).toBe(1);
  });

  it("stores the drive summary without a second progress system", async () => {
    await recordDriveSession(
      profileId,
      {
        duration: 15,
        actualMs: 900_000,
        activitiesCompleted: 18,
        phrasesAttempted: 11,
        independentSuccesses: 6,
        hintAssistedSuccesses: 3,
        errors: 2,
        technicalFailures: 1,
        reason: "completed",
      },
      now,
    );
    const events = await getDb().outbox.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("drive_session_completed");
    expect(events[0]!.payload).toMatchObject({
      duration: 15,
      independentSuccesses: 6,
      reason: "completed",
    });
    // Drive sessions never masquerade as lesson progress.
    expect(await getDb().lessonProgress.count()).toBe(0);
  });
});

describe("feedback sounds", () => {
  it("uses a distinct neutral tone for technical trouble", () => {
    expect(toneFor("technical-failure")).toBe("technical");
    expect(toneFor("technical-failure")).not.toBe("retry");
  });

  it("separates a clean answer from a merely understandable one", () => {
    expect(toneFor("understood")).toBe("correct");
    expect(toneFor("different-valid")).toBe("correct");
    expect(toneFor("minor-issue")).toBe("acceptable");
  });

  it("reserves the retry sound for genuine language errors", () => {
    expect(toneFor("meaning-error")).toBe("retry");
    expect(toneFor("incomplete")).toBe("retry");
  });
});
