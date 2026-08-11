"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Flame, Plane, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useRumbo } from "@/components/app-providers";
import { SyncChip } from "@/components/sync-chip";
import { course } from "@/content/course";
import { localProgress } from "@/lib/offline/progress";
import { calculateRhythm, departureCountdown } from "@/lib/progress/metrics";

export default function TodayPage() {
  const { profile, loading } = useRumbo();
  const [completed, setCompleted] = useState<string[]>([]);
  useEffect(() => {
    if (!profile) return;
    const load = () =>
      void localProgress(profile.id).then((rows) =>
        setCompleted(
          rows
            .filter((row) => row.status === "completed")
            .map((row) => row.lessonId),
        ),
      );
    load();
    window.addEventListener("rumbo-progress", load);
    return () => window.removeEventListener("rumbo-progress", load);
  }, [profile]);
  if (loading)
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="route-mark" aria-label="Loading Rumbo" />
      </main>
    );
  if (!profile)
    return (
      <main className="grid min-h-dvh place-items-center p-5">
        <div className="text-center">
          <div className="route-mark mx-auto" />
          <h1 className="mt-6 text-4xl font-black">Welcome to Rumbo</h1>
          <p className="text-ink/70 mt-3">
            Sign in with your invited email to keep progress separate and safe.
          </p>
          <Link
            href="/sign-in"
            className="tap-target bg-ink mt-6 flex items-center justify-center rounded-2xl px-6 font-black text-white"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  const nextLesson =
    course.lessons.find((lesson) => !completed.includes(lesson.id)) ??
    course.lessons.at(-1)!;
  const dates = completed
    .map((id) => course.lessons.find((lesson) => lesson.id === id)?.date)
    .filter((v): v is string => Boolean(v));
  const rhythm = calculateRhythm(dates, new Date().toISOString().slice(0, 10));
  const days = departureCountdown(new Date());
  return (
    <AppShell active="today">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-agave text-sm font-bold">
            Hola, {profile.displayName}
          </p>
          <h1 className="mt-1 text-4xl leading-[1.05] font-black">
            Ready for today?
          </h1>
        </div>
        <SyncChip />
      </div>
      {profile.isDemo && (
        <div className="bg-sky/10 mt-4 flex items-start gap-2 rounded-xl p-3 text-sm">
          <WifiOff className="mt-0.5 shrink-0" size={18} />
          <p>
            <strong>Demo mode:</strong> progress stays on this device until
            Supabase is configured.
          </p>
        </div>
      )}
      <div className="text-ink/65 mt-6 flex items-center gap-2 text-sm font-semibold">
        <Plane size={18} />
        <span>{days} days until Mexico · 20 Oct 2026</span>
      </div>
      <section className="card mt-5 overflow-hidden">
        <div className="from-coral via-marigold to-agave h-2 bg-gradient-to-r" />
        <div className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-coral text-xs font-black tracking-[.14em]">
              DAY {nextLesson.day} · {nextLesson.estimatedMinutes} MIN
            </span>
            <CalendarDays size={20} className="text-ink/45" />
          </div>
          <h2 className="mt-3 text-3xl font-black">{nextLesson.title}</h2>
          <p className="text-ink/70 mt-2">{nextLesson.outcome}</p>
          <p className="mt-4 text-sm font-semibold">
            Review up to 3 · Learn {nextLesson.newPhraseIds.length}
          </p>
          {nextLesson.day === 7 ? (
            <Link
              href="/mission/friendly-arrival"
              className="tap-target bg-coral mt-5 flex items-center justify-between rounded-2xl px-5 font-black text-white"
            >
              Start Mexico Mission <ArrowRight />
            </Link>
          ) : (
            <Link
              href={`/lesson/${nextLesson.id}`}
              className="tap-target bg-ink mt-5 flex items-center justify-between rounded-2xl px-5 font-black text-white"
            >
              Start today’s lesson <ArrowRight />
            </Link>
          )}
        </div>
      </section>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Metric value="0" label="Due now" />
        <Metric
          value={String(rhythm.current)}
          label="Rhythm"
          icon={<Flame size={16} />}
        />
        <Metric value={`${completed.length}/7`} label="Slice" />
      </div>
      <Link
        href="/travel-pack"
        className="tap-target border-ink/15 mt-5 flex items-center justify-between rounded-2xl border bg-white px-4 font-bold"
      >
        <span>Days 1–7 offline pack</span>
        <ArrowRight size={18} />
      </Link>
    </AppShell>
  );
}
function Metric({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center">
      <p className="flex items-center justify-center gap-1 text-lg font-black">
        {icon}
        {value}
      </p>
      <p className="text-ink/60 text-[11px]">{label}</p>
    </div>
  );
}
