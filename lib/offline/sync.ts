import { getDb, type SyncStatus } from "./db";

const statusEvent = (status: SyncStatus) =>
  window.dispatchEvent(new CustomEvent("rumbo-sync", { detail: status }));

export async function syncOutbox(): Promise<{
  acknowledged: number;
  status: SyncStatus;
}> {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return { acknowledged: 0, status: "local" };
  const db = getDb();
  const now = new Date().toISOString();
  const events = await db.outbox
    .where("nextAttemptAt")
    .belowOrEqual(now)
    .limit(25)
    .toArray();
  if (!events.length) return { acknowledged: 0, status: "synced" };
  statusEvent("syncing");
  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events }),
    });
    if (response.status === 503) return { acknowledged: 0, status: "local" };
    if (!response.ok) throw new Error("Sync request failed");
    const result = (await response.json()) as {
      acknowledged: string[];
      lessonProgress?: Array<{
        lesson_id: string;
        status: "started" | "completed";
        completed_at: string | null;
        points: number;
        revision: number;
      }>;
    };
    await db.transaction("rw", db.outbox, db.lessonProgress, async () => {
      await db.outbox.bulkDelete(result.acknowledged);
      for (const row of result.lessonProgress ?? []) {
        const local = await db.lessonProgress.get(
          `${events[0]!.profileId}:${row.lesson_id}`,
        );
        const serverWins =
          row.status === "completed" || local?.status !== "completed";
        if (serverWins)
          await db.lessonProgress.put({
            id: `${events[0]!.profileId}:${row.lesson_id}`,
            profileId: events[0]!.profileId,
            lessonId: row.lesson_id,
            status: row.status,
            completedAt: row.completed_at ?? undefined,
            points: row.points,
            revision: Math.max(local?.revision ?? 0, row.revision),
          });
      }
    });
    window.dispatchEvent(new CustomEvent("rumbo-progress"));
    statusEvent("synced");
    return { acknowledged: result.acknowledged.length, status: "synced" };
  } catch {
    await db.transaction("rw", db.outbox, async () => {
      for (const event of events) {
        const attempts = event.attempts + 1;
        const delay =
          Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6)) +
          Math.floor(Math.random() * 500);
        await db.outbox.update(event.id, {
          attempts,
          nextAttemptAt: new Date(Date.now() + delay).toISOString(),
        });
      }
    });
    statusEvent("error");
    return { acknowledged: 0, status: "error" };
  }
}
