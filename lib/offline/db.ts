import Dexie, { type EntityTable } from "dexie";

export type SyncStatus = "local" | "syncing" | "synced" | "error";
export interface LocalLessonProgress {
  id: string;
  profileId: string;
  lessonId: string;
  status: "started" | "completed";
  completedAt?: string;
  points: number;
  revision: number;
}
export interface LocalMastery {
  id: string;
  profileId: string;
  phraseId: string;
  intervalStep: number;
  dueAt: string;
  consecutiveSuccesses: number;
  lastOutcome: string;
}
export interface OutboxEvent {
  id: string;
  profileId: string;
  deviceId: string;
  type:
    | "lesson_started"
    | "lesson_completed"
    | "phrase_reviewed"
    | "mission_completed";
  entityId: string;
  payload: Record<string, unknown>;
  clientCreatedAt: string;
  attempts: number;
  nextAttemptAt: string;
}
export interface LocalSetting {
  key: string;
  value: unknown;
}

export class RumboDatabase extends Dexie {
  lessonProgress!: EntityTable<LocalLessonProgress, "id">;
  phraseMastery!: EntityTable<LocalMastery, "id">;
  outbox!: EntityTable<OutboxEvent, "id">;
  settings!: EntityTable<LocalSetting, "key">;
  constructor(name = "rumbo-2026-1") {
    super(name);
    this.version(1).stores({
      lessonProgress:
        "id, [profileId+lessonId], profileId, status, completedAt",
      phraseMastery: "id, [profileId+phraseId], profileId, dueAt",
      outbox: "id, profileId, nextAttemptAt, clientCreatedAt",
      settings: "key",
    });
  }
}

let instance: RumboDatabase | undefined;
export function getDb() {
  if (typeof indexedDB === "undefined")
    throw new Error("IndexedDB is unavailable");
  instance ??= new RumboDatabase();
  return instance;
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const key = "rumbo-device-id";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    window.localStorage.setItem(key, value);
  }
  return value;
}
