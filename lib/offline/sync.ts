import { getDb, type LocalMastery, type SyncStatus } from "./db";

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
      phraseMastery?: Array<{
        phrase_id: string;
        interval_step: number;
        due_at: string;
        consecutive_successes: number;
        independent_successes: number;
        assisted_successes: number;
        encounters: number;
        last_outcome: string | null;
        last_assistance: string | null;
        independent_days: string[] | null;
        updated_at: string;
      }>;
    };
    const profileId = events[0]!.profileId;
    await db.transaction(
      "rw",
      db.outbox,
      db.lessonProgress,
      db.phraseMastery,
      async () => {
        for (const row of result.phraseMastery ?? []) {
          const id = `${profileId}:${row.phrase_id}`;
          const local = await db.phraseMastery.get(id);
          // The device with the most recent attempt wins; a stale cloud row
          // must never overwrite work done offline since.
          if (local?.lastReviewedAt && local.lastReviewedAt >= row.updated_at)
            continue;
          await db.phraseMastery.put({
            id,
            profileId,
            phraseId: row.phrase_id,
            intervalStep: row.interval_step,
            dueAt: row.due_at,
            consecutiveSuccesses: row.consecutive_successes,
            independentSuccesses: row.independent_successes,
            assistedSuccesses: row.assisted_successes,
            encounters: row.encounters,
            lastOutcome:
              (row.last_outcome as LocalMastery["lastOutcome"]) ?? undefined,
            lastAssistance:
              (row.last_assistance as LocalMastery["lastAssistance"]) ??
              undefined,
            lastReviewedAt: row.updated_at,
            independentDays: row.independent_days ?? [],
          });
        }
        await db.outbox.bulkDelete(result.acknowledged);
        for (const row of result.lessonProgress ?? []) {
          const id = `${profileId}:${row.lesson_id}`;
          const local = await db.lessonProgress.get(id);
          const serverWins =
            row.status === "completed" || local?.status !== "completed";
          if (serverWins)
            await db.lessonProgress.put({
              id,
              profileId,
              lessonId: row.lesson_id,
              status: row.status,
              completedAt: row.completed_at ?? undefined,
              points: row.points,
              revision: Math.max(local?.revision ?? 0, row.revision),
            });
        }
      },
    );
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
