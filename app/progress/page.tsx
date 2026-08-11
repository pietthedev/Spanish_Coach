"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useRumbo } from "@/components/app-providers";
import { course } from "@/content/course";
import { localProgress } from "@/lib/offline/progress";
import {
  foundationsReadiness,
  readinessCategories,
} from "@/lib/progress/metrics";

export default function ProgressPage() {
  const { profile } = useRumbo();
  const [count, setCount] = useState(0);
  const [points, setPoints] = useState(0);
  useEffect(() => {
    if (profile)
      void localProgress(profile.id).then((rows) => {
        const done = rows.filter((r) => r.status === "completed");
        setCount(done.length);
        setPoints(done.reduce((sum, row) => sum + row.points, 0));
      });
  }, [profile]);
  const foundations = foundationsReadiness(count, count * 2, count >= 7);
  return (
    <AppShell active="progress">
      <p className="text-coral text-sm font-black tracking-[.15em]">
        READINESS
      </p>
      <h1 className="mt-2 text-4xl font-black">
        Trip confidence, backed by practice
      </h1>
      <div className="mt-6 grid grid-cols-3 gap-2">
        <Box value={points} label="Travel Points" />
        <Box value={count} label="Lessons" />
        <Box
          value={
            course.phrases.filter((p) =>
              course.lessons
                .slice(0, count)
                .some((l) => l.newPhraseIds.includes(p.id)),
            ).length
          }
          label="Phrases"
        />
      </div>
      <div className="mt-7 space-y-3">
        {readinessCategories.map((category) => {
          const state =
            category === "Foundations" ? foundations : "Not started";
          const width =
            state === "Trip-ready"
              ? "100%"
              : state === "Practised"
                ? "70%"
                : state === "Building"
                  ? "35%"
                  : "4%";
          return (
            <section key={category} className="rounded-2xl bg-white p-4">
              <div className="flex justify-between gap-3">
                <h2 className="font-black">{category}</h2>
                <span className="text-ink/60 text-xs font-bold">{state}</span>
              </div>
              <div className="bg-ink/10 mt-3 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-agave h-full rounded-full"
                  style={{ width }}
                />
              </div>
              <p className="text-ink/55 mt-2 text-xs">
                {category === "Foundations"
                  ? `${count} lessons completed · evidence grows through recall and missions`
                  : "Later course phase"}
              </p>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
function Box({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center">
      <p className="text-2xl font-black">{value}</p>
      <p className="text-ink/55 text-[11px]">{label}</p>
    </div>
  );
}
