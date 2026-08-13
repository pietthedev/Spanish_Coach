import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/offline/db";
import { loadMastery, recordPhraseAttempt } from "@/lib/offline/progress";
import { memoryBand } from "@/lib/learning/mastery";
import type { RetrievalAttempt } from "@/lib/learning/types";

const profileId = "profile-1";
const phraseId = "mx.greeting.buenos_dias";
const now = new Date("2026-08-20T08:00:00.000Z");

function attempt(overrides: Partial<RetrievalAttempt> = {}): RetrievalAttempt {
  return {
    phraseId,
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

beforeEach(async () => {
  const db = getDb();
  await db.phraseMastery.clear();
  await db.outbox.clear();
});

describe("offline mastery persistence", () => {
  it("stores mastery locally and queues one event per attempt", async () => {
    const result = await recordPhraseAttempt(profileId, attempt(), now);
    expect(result.after.independentSuccesses).toBe(1);

    const db = getDb();
    const stored = await db.phraseMastery.get(`${profileId}:${phraseId}`);
    expect(stored?.dueAt).toBe("2026-08-20T08:10:00.000Z");
    expect(stored?.profileId).toBe(profileId);

    const events = await db.outbox.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("phrase_reviewed");
    expect(events[0]!.entityId).toBe(phraseId);
  });

  it("carries the evidence needed to project mastery on the server", async () => {
    await recordPhraseAttempt(
      profileId,
      attempt({ assistance: "hint-2", hintCount: 2, transcript: "buenos dias" }),
      now,
    );
    const [event] = await getDb().outbox.toArray();
    expect(event!.payload).toMatchObject({
      assistance: "hint-2",
      hintCount: 2,
      cueType: "english",
      stepKind: "spoken-recall",
      outcome: "understood",
      answerVisible: false,
    });
    expect(event!.payload.mastery).toMatchObject({ assistedSuccesses: 1 });
  });

  it("accumulates attempts into one mastery row", async () => {
    await recordPhraseAttempt(profileId, attempt(), now);
    const later = new Date("2026-08-21T08:00:00.000Z");
    await recordPhraseAttempt(
      profileId,
      attempt({ timestamp: later.toISOString() }),
      later,
    );

    const db = getDb();
    expect(await db.phraseMastery.count()).toBe(1);
    expect(await db.outbox.count()).toBe(2);

    const mastery = await loadMastery(profileId);
    const record = mastery.get(phraseId)!;
    expect(record.independentSuccesses).toBe(2);
    expect(record.independentDays).toEqual(["2026-08-20", "2026-08-21"]);
    expect(memoryBand(record)).toBe("retrievable");
  });

  it("keeps profiles separate", async () => {
    await recordPhraseAttempt(profileId, attempt(), now);
    await recordPhraseAttempt("profile-2", attempt(), now);
    expect((await loadMastery(profileId)).size).toBe(1);
    expect((await loadMastery("profile-2")).size).toBe(1);
    expect(await getDb().phraseMastery.count()).toBe(2);
  });

  it("does not weaken stored mastery when the microphone fails", async () => {
    await recordPhraseAttempt(profileId, attempt(), now);
    const before = (await loadMastery(profileId)).get(phraseId)!;
    const later = new Date("2026-08-21T08:00:00.000Z");
    await recordPhraseAttempt(
      profileId,
      attempt({ outcome: "technical-failure", timestamp: later.toISOString() }),
      later,
    );
    const after = (await loadMastery(profileId)).get(phraseId)!;
    expect(after.dueAt).toBe(before.dueAt);
    expect(after.intervalStep).toBe(before.intervalStep);
    expect(after.independentSuccesses).toBe(before.independentSuccesses);
  });

  it("does not advance mastery when the answer was on screen", async () => {
    await recordPhraseAttempt(profileId, attempt(), now);
    const before = (await loadMastery(profileId)).get(phraseId)!;
    await recordPhraseAttempt(
      profileId,
      attempt({ assistance: "answer-visible", answerVisible: true }),
      now,
    );
    const after = (await loadMastery(profileId)).get(phraseId)!;
    expect(after.dueAt).toBe(before.dueAt);
    expect(after.independentSuccesses).toBe(before.independentSuccesses);
    expect(after.encounters).toBe(before.encounters + 1);
  });
});
