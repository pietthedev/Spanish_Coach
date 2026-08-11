import { getDb, getDeviceId, type OutboxEvent } from "./db";

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
