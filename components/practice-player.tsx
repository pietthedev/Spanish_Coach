"use client";

import Link from "next/link";
import {
  ChevronLeft,
  Headphones,
  Mic,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRumbo } from "./app-providers";
import { SessionScreen } from "./session-runner";
import { AppShell } from "./app-shell";
import { course, phraseById } from "@/content/course";
import { stopPlayback } from "@/lib/audio/playback";
import type { BandChange } from "@/lib/learning/feedback";
import { MEMORY_BAND_LABEL, bandRank, memoryBand } from "@/lib/learning/mastery";
import {
  attentionOrder,
  planPracticeSession,
  type PracticeMode,
  type SessionStep,
} from "@/lib/learning/session-planner";
import type { PhraseMastery } from "@/lib/learning/types";
import { loadMastery } from "@/lib/offline/progress";
import { syncOutbox } from "@/lib/offline/sync";

const NO_MASTERY: ReadonlyMap<string, PhraseMastery> = new Map();

/** Bands that still need productive work before a trip. */
const WEAK_BANDS = new Set(["familiar", "fragile"]);

export function PracticePlayer() {
  const { profile } = useRumbo();
  const [snapshot, setSnapshot] = useState<{
    mastery: ReadonlyMap<string, PhraseMastery>;
    at: Date;
  }>();
  const [reloadToken, setReloadToken] = useState(0);
  const [session, setSession] = useState<SessionStep[]>();
  const [changes, setChanges] = useState<BandChange[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = profile
        ? await loadMastery(profile.id).catch(
            () => new Map<string, PhraseMastery>(),
          )
        : new Map<string, PhraseMastery>();
      if (cancelled) return;
      setSnapshot({ mastery: loaded, at: new Date() });
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, reloadToken]);

  const loading = !snapshot;
  const mastery = snapshot?.mastery ?? NO_MASTERY;
  const dueCount = useMemo(
    () =>
      snapshot
        ? [...snapshot.mastery.values()].filter(
            (record) => new Date(record.dueAt) <= snapshot.at,
          ).length
        : 0,
    [snapshot],
  );
  const weak = useMemo(
    () =>
      snapshot
        ? attentionOrder(snapshot.mastery, phraseById, snapshot.at)
            .filter((item) => WEAK_BANDS.has(memoryBand(item.mastery)))
            .slice(0, 6)
        : [],
    [snapshot],
  );

  const start = (mode: PracticeMode) => {
    const plan = planPracticeSession({
      phrases: phraseById,
      mastery,
      now: new Date(),
      mode,
    });
    if (!plan.steps.length) return;
    setChanges([]);
    setFinished(false);
    setSession(plan.steps);
  };

  const onRecorded = useCallback((change: BandChange) => {
    setChanges((current) => [
      ...current.filter((item) => item.phraseId !== change.phraseId),
      change,
    ]);
  }, []);

  const finish = useCallback(() => {
    stopPlayback();
    void syncOutbox();
    setReloadToken((value) => value + 1);
    setFinished(true);
  }, []);

  if (session && !finished)
    return (
      <SessionScreen
        profileId={profile?.id}
        steps={session}
        baseline={mastery}
        onRecorded={onRecorded}
        onComplete={finish}
        header={
          <button
            type="button"
            onClick={() => setSession(undefined)}
            className="tap-target grid place-items-center rounded-full"
            aria-label="Exit practice"
          >
            <ChevronLeft />
          </button>
        }
      />
    );

  const hasHistory = mastery.size > 0;

  return (
    <AppShell active="practice">
      <p className="text-sky text-sm font-black tracking-[.15em]">PRACTICE</p>
      <h1 className="mt-2 text-4xl font-black">Bring it back from memory</h1>

      {finished && (
        <section className="card border-agave mt-6 border-2 p-5" role="status">
          <div className="flex items-center gap-3">
            <Sparkles className="text-agave" />
            <h2 className="text-lg font-black">Practice complete</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {changes.map((change) => (
              <li key={change.phraseId} className="flex items-baseline gap-3">
                <span className="font-black">{change.esMX}</span>
                <span className="text-ink/60 ml-auto text-xs">
                  {change.summary}
                </span>
              </li>
            ))}
            {!changes.length && (
              <li className="text-ink/60 text-sm">
                No spoken attempts were recorded.
              </li>
            )}
          </ul>
        </section>
      )}

      <div className="card mt-6 p-5">
        <div className="flex items-center gap-3">
          <Repeat2 className="text-agave" />
          <div>
            <h2 className="text-xl font-black">
              {loading
                ? "Checking your memory…"
                : dueCount > 0
                  ? `${dueCount} due now`
                  : hasHistory
                    ? "Nothing due right now"
                    : "Nothing due yet"}
            </h2>
            <p className="text-ink/65 text-sm">
              {hasHistory
                ? "Reviews are chosen from what is weakest first."
                : "Finish a lesson and your phrases will appear here."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => start("quick")}
          disabled={!hasHistory}
          className="tap-target bg-ink mt-5 w-full rounded-2xl px-4 font-black text-white disabled:opacity-35"
        >
          Quick practice · 3 phrases
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => start("speaking")}
          disabled={!hasHistory}
          className="tap-target rounded-2xl bg-white p-4 text-left disabled:opacity-40"
        >
          <Mic className="text-coral" />
          <span className="mt-3 block font-black">Speaking</span>
          <span className="text-ink/55 text-xs">Say it without the text</span>
        </button>
        <button
          type="button"
          onClick={() => start("listening")}
          disabled={!hasHistory}
          className="tap-target rounded-2xl bg-white p-4 text-left disabled:opacity-40"
        >
          <Headphones className="text-sky" />
          <span className="mt-3 block font-black">Listening</span>
          <span className="text-ink/55 text-xs">Understand at full speed</span>
        </button>
      </div>

      {weak.length > 0 && (
        <>
          <h2 className="mt-7 text-lg font-black">Needs attention</h2>
          <ul className="mt-3 space-y-2">
            {weak.map((item) => {
              const phrase = phraseById.get(item.phraseId)!;
              return (
                <li
                  key={item.phraseId}
                  className="flex items-baseline gap-3 rounded-xl bg-white p-3"
                >
                  <span className="font-black">{phrase.esMX}</span>
                  <span className="text-ink/55 ml-auto text-xs">
                    {MEMORY_BAND_LABEL[memoryBand(item.mastery)]}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <details className="mt-7">
        <summary className="tap-target cursor-pointer text-lg font-black">
          Phrasebook
        </summary>
        <p className="text-ink/55 mt-1 text-xs">
          Reference only — looking a phrase up does not build recall.
        </p>
        <ul className="mt-3 space-y-2">
          {[...course.phrases]
            .sort(
              (a, b) =>
                bandRank(memoryBand(mastery.get(a.id))) -
                bandRank(memoryBand(mastery.get(b.id))),
            )
            .map((phrase) => (
              <li key={phrase.id} className="rounded-xl bg-white p-3">
                <span className="font-black">{phrase.esMX}</span>
                <span className="text-ink/55 float-right text-sm">
                  {phrase.english}
                </span>
              </li>
            ))}
        </ul>
      </details>

      <p className="mt-8 text-center">
        <Link href="/" className="text-ink/55 font-bold underline">
          Back to today
        </Link>
      </p>
    </AppShell>
  );
}
