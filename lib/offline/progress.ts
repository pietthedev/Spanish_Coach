import { applyAttempt, memoryBand } from "@/lib/learning/mastery";
import type { PhraseMastery, RetrievalAttempt } from "@/lib/learning/types";
import { getDb, getDeviceId, type LocalMastery, type OutboxEvent } from "./db";

/** Transcripts are kept for feedback only, bounded and free of raw audio. */
const MAX_TRANSCRIPT_CHARS = 200;

export interface AttemptRecord {
  before?: PhraseMastery;
  after: PhraseMastery;
}

export async function loadMastery(
  profileId: string,
): Promise<Map<string, PhraseMastery>> {
  const db = getDb();
  const rows = await db.phraseMastery
    .where("profileId")
    .equals(profileId)
    .toArray();
  return new Map(rows.map((row) => [row.phraseId, row]));
}

/**
 * The single write path for phrase mastery. Every attempt updates the local
 * record first and queues an event, so learning works fully offline.
 */
export async function recordPhraseAttempt(
  profileId: string,
  attempt: RetrievalAttempt,
  now = new Date(),
): Promise<AttemptRecord> {
  const db = getDb();
  const id = `${profileId}:${attempt.phraseId}`;
  const existing = await db.phraseMastery.get(id);
  const after = applyAttempt(existing, attempt, now);
  const row: LocalMastery = {
    ...after,
    id,
    profileId,
    phraseId: attempt.phraseId,
  };
  const event: OutboxEvent = {
    id: crypto.randomUUID(),
    profileId,
    deviceId: getDeviceId(),
    type: "phrase_reviewed",
    entityId: attempt.phraseId,
    payload: {
      stepKind: attempt.stepKind,
      cueType: attempt.cueType,
      outcome: attempt.outcome,
      assistance: attempt.assistance,
      hintCount: attempt.hintCount,
      answerVisible: attempt.answerVisible,
      responseLatencyMs: attempt.responseLatencyMs,
      attemptNumber: attempt.attemptNumber,
      transcript: attempt.transcript?.slice(0, MAX_TRANSCRIPT_CHARS),
      bandBefore: memoryBand(existing),
      bandAfter: memoryBand(after),
      mastery: {
        intervalStep: after.intervalStep,
        dueAt: after.dueAt,
        consecutiveSuccesses: after.consecutiveSuccesses,
        independentSuccesses: after.independentSuccesses,
        assistedSuccesses: after.assistedSuccesses,
        encounters: after.encounters,
        lastOutcome: after.lastOutcome,
        lastAssistance: after.lastAssistance,
        independentDays: after.independentDays,
      },
    },
    clientCreatedAt: attempt.timestamp,
    attempts: 0,
    nextAttemptAt: now.toISOString(),
  };
  await db.transaction("rw", db.phraseMastery, db.outbox, async () => {
    await db.phraseMastery.put(row);
    await db.outbox.put(event);
  });
  window.dispatchEvent(new CustomEvent("rumbo-progress"));
  return { before: existing, after };
}

export async function recordLessonStarted(profileId: string, lessonId: string) {
  const db = getDb();
  const event: OutboxEvent = {
    id: crypto.randomUUID(),
    profileId,
    deviceId: getDeviceId(),
    type: "lesson_started",
    entityId: lessonId,
    payload: {},
    clientCreatedAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
  };
  await db.transaction("rw", db.lessonProgress, db.outbox, async () => {
    const existing = await db.lessonProgress.get(`${profileId}:${lessonId}`);
    if (!existing)
      await db.lessonProgress.put({
        id: `${profileId}:${lessonId}`,
        profileId,
        lessonId,
        status: "started",
        points: 0,
        revision: 1,
      });
    await db.outbox.put(event);
  });
  window.dispatchEvent(new CustomEvent("rumbo-progress"));
  return event.id;
}

export async function completeLesson(
  profileId: string,
  lessonId: string,
  points: number,
) {
  const db = getDb();
  const now = new Date().toISOString();
  const event: OutboxEvent = {
    id: crypto.randomUUID(),
    profileId,
    deviceId: getDeviceId(),
    type: "lesson_completed",
    entityId: lessonId,
    payload: { points },
    clientCreatedAt: now,
    attempts: 0,
    nextAttemptAt: now,
  };
  await db.transaction("rw", db.lessonProgress, db.outbox, async () => {
    const current = await db.lessonProgress.get(`${profileId}:${lessonId}`);
    await db.lessonProgress.put({
      id: `${profileId}:${lessonId}`,
      profileId,
      lessonId,
      status: "completed",
      completedAt: current?.completedAt ?? now,
      points,
      revision: (current?.revision ?? 0) + 1,
    });
    await db.outbox.put(event);
  });
  window.dispatchEvent(new CustomEvent("rumbo-progress"));
  return event.id;
}

export async function localProgress(profileId: string) {
  const db = getDb();
  return db.lessonProgress.where("profileId").equals(profileId).toArray();
}
