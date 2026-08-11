"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { syncOutbox } from "@/lib/offline/sync";
import { getDb, type SyncStatus } from "@/lib/offline/db";

type Profile = { id: string; displayName: string; isDemo: boolean };
const Context = createContext<{
  profile: Profile | null;
  loading: boolean;
  syncStatus: SyncStatus;
}>({ profile: null, loading: true, syncStatus: "local" });

export function AppProviders({ children }: { children: React.ReactNode }) {
  const configured = hasSupabaseConfig();
  const [profile, setProfile] = useState<Profile | null>(() =>
    configured
      ? null
      : { id: "demo-profile", displayName: "Traveller", isDemo: true },
  );
  const [loading, setLoading] = useState(configured);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    void supabase?.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setLoading(false);
        return;
      }
      const { data: row } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("auth_user_id", data.user.id)
        .single();
      if (row) {
        const { data: cloudProgress } = await supabase
          .from("lesson_progress")
          .select("lesson_id, status, completed_at, points, revision");
        const db = getDb();
        for (const cloud of cloudProgress ?? []) {
          const id = `${row.id}:${cloud.lesson_id}`;
          const local = await db.lessonProgress.get(id);
          if (cloud.status === "completed" || local?.status !== "completed")
            await db.lessonProgress.put({
              id,
              profileId: row.id,
              lessonId: cloud.lesson_id,
              status: cloud.status,
              completedAt: cloud.completed_at ?? undefined,
              points: cloud.points,
              revision: Math.max(local?.revision ?? 0, cloud.revision),
            });
        }
        setProfile({
          id: row.id,
          displayName: row.display_name,
          isDemo: false,
        });
      } else setProfile(null);
      setLoading(false);
    });
  }, [configured]);
  useEffect(() => {
    const onStatus = (event: Event) =>
      setSyncStatus((event as CustomEvent<SyncStatus>).detail);
    const sync = () =>
      void syncOutbox().then((result) => setSyncStatus(result.status));
    window.addEventListener("rumbo-sync", onStatus);
    window.addEventListener("online", sync);
    sync();
    const interval = window.setInterval(sync, 30_000);
    return () => {
      window.removeEventListener("rumbo-sync", onStatus);
      window.removeEventListener("online", sync);
      window.clearInterval(interval);
    };
  }, []);
  const value = useMemo(
    () => ({ profile, loading, syncStatus }),
    [profile, loading, syncStatus],
  );
  return (
    <Context.Provider value={value}>
      {children}
      <ServiceWorkerStatus />
    </Context.Provider>
  );
}

function ServiceWorkerStatus() {
  const [waiting, setWaiting] = useState<ServiceWorkerRegistration | null>(
    null,
  );
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return;
    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (registration.waiting) setWaiting(registration);
      registration.addEventListener("updatefound", () =>
        registration.installing?.addEventListener("statechange", () => {
          if (registration.waiting) setWaiting(registration);
        }),
      );
    });
  }, []);
  if (!waiting) return null;
  const apply = () => {
    if (document.body.dataset.lessonActive === "true") return;
    waiting.waiting?.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  };
  return (
    <aside
      className="bg-ink fixed right-3 bottom-24 left-3 z-50 mx-auto max-w-md rounded-2xl p-4 text-white shadow-xl"
      aria-live="polite"
    >
      <p className="font-semibold">A safe update is ready</p>
      <p className="mt-1 text-sm text-white/80">
        Finish any active lesson first.
      </p>
      <button
        className="tap-target bg-marigold text-ink mt-3 rounded-xl px-4 font-bold disabled:opacity-50"
        onClick={apply}
        disabled={document.body.dataset.lessonActive === "true"}
      >
        Update now
      </button>
    </aside>
  );
}

export const useRumbo = () => useContext(Context);
