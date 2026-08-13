"use client";

import Link from "next/link";
import { ChevronLeft, Mic, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRumbo } from "./app-providers";
import { SessionScreen } from "./session-runner";
import { phraseById } from "@/content/course";
import type { Lesson } from "@/content/runtime-types";
import { stopPlayback } from "@/lib/audio/playback";
import type { BandChange } from "@/lib/learning/feedback";
import { planSession, type SessionStep } from "@/lib/learning/session-planner";
import type { PhraseMastery } from "@/lib/learning/types";
import {
  completeLesson,
  loadMastery,
  recordLessonStarted,
} from "@/lib/offline/progress";
import { syncOutbox } from "@/lib/offline/sync";

const NO_MASTERY: ReadonlyMap<string, PhraseMastery> = new Map();

export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const { profile } = useRumbo();
  const [stage, setStage] = useState<"loading" | "ready" | "running" | "complete">(
    "loading",
  );
  const [steps, setSteps] = useState<SessionStep[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [baseline, setBaseline] =
    useState<ReadonlyMap<string, PhraseMastery>>(NO_MASTERY);
  const [changes, setChanges] = useState<BandChange[]>([]);
  const started = useRef(false);

  useEffect(() => {
    setLessonActivity(true);
    return () => {
      setLessonActivity(false);
      stopPlayback();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // A late auth resolution must never restart a session the learner is
      // already part-way through.
      if (started.current) return;
      const mastery = profile
        ? await loadMastery(profile.id).catch(
            () => new Map<string, PhraseMastery>(),
          )
        : new Map<string, PhraseMastery>();
      if (cancelled || started.current) return;
      const plan = planSession({
        lesson,
        phrases: phraseById,
        mastery,
        now: new Date(),
      });
      setBaseline(mastery);
      setSteps(plan.steps);
      setDueCount(plan.dueCount);
      setStage("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [lesson, profile]);

  const finish = useCallback(() => {
    stopPlayback();
    void (async () => {
      if (profile) {
        await completeLesson(profile.id, lesson.id, lesson.travelPoints);
        void syncOutbox();
      }
    })();
    setStage("complete");
    setLessonActivity(false);
  }, [lesson.id, lesson.travelPoints, profile]);

  const onRecorded = useCallback((change: BandChange) => {
    setChanges((current) => [
      ...current.filter((item) => item.phraseId !== change.phraseId),
      change,
    ]);
  }, []);

  if (stage === "loading")
    return (
      <main className="grid min-h-dvh place-items-center px-6" aria-busy="true">
        <p className="text-ink/60 font-bold">Preparing today’s session…</p>
      </main>
    );

  if (stage === "complete")
    return <Completion lesson={lesson} changes={changes} />;

  if (stage === "ready")
    return (
      <SessionIntro
        lesson={lesson}
        dueCount={dueCount}
        stepCount={steps.length}
        onStart={() => {
          if (started.current) return;
          started.current = true;
          if (profile) void recordLessonStarted(profile.id, lesson.id);
          setStage("running");
        }}
      />
    );

  return (
    <SessionScreen
      profileId={profile?.id}
      steps={steps}
      baseline={baseline}
      onRecorded={onRecorded}
      onComplete={finish}
      header={
        <Link
          href="/"
          className="tap-target grid place-items-center rounded-full"
          aria-label="Exit lesson"
        >
          <ChevronLeft />
        </Link>
      }
    />
  );
}

function setLessonActivity(active: boolean) {
  if (active) document.body.dataset.lessonActive = "true";
  else delete document.body.dataset.lessonActive;
  window.dispatchEvent(
    new CustomEvent("rumbo-lesson-activity", { detail: active }),
  );
}

/**
 * The tap that starts the session is also the gesture that unlocks audio, so
 * automatic playback stays within mobile autoplay rules.
 */
function SessionIntro({
  lesson,
  dueCount,
  stepCount,
  onStart,
}: {
  lesson: Lesson;
  dueCount: number;
  stepCount: number;
  onStart: () => void;
}) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-[430px] place-items-center px-5 text-center">
      <div>
        <p className="text-agave text-sm font-black tracking-[.16em]">
          DAY {lesson.day}
        </p>
        <h1 className="mt-3 text-4xl font-black">{lesson.title}</h1>
        <p className="text-ink/75 mt-4 text-lg">{lesson.outcome}</p>
        <div className="card mt-7 grid grid-cols-2 gap-3 p-5">
          <div>
            <p className="text-2xl font-black">{dueCount}</p>
            <p className="text-ink/60 text-xs">Due to remember</p>
          </div>
          <div>
            <p className="text-2xl font-black">{stepCount}</p>
            <p className="text-ink/60 text-xs">Steps today</p>
          </div>
        </div>
        <p className="text-ink/65 mt-6 text-sm">
          You will hear each phrase and be asked to say it from memory. Some of
          it is meant to feel like an effort.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="tap-target bg-ink mt-7 w-full rounded-2xl px-6 font-black text-white"
        >
          Start session
        </button>
      </div>
    </main>
  );
}

function Completion({
  lesson,
  changes,
}: {
  lesson: Lesson;
  changes: BandChange[];
}) {
  const strengthened = changes.filter((change) => change.strengthened);
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] px-5 py-10">
      <div className="text-center">
        <div className="bg-marigold mx-auto grid h-20 w-20 place-items-center rounded-full">
          <Sparkles size={36} />
        </div>
        <p className="text-coral mt-5 text-sm font-black tracking-[.16em]">
          SESSION COMPLETE
        </p>
        <h1 className="mt-3 text-4xl font-black">¡Muy bien!</h1>
      </div>

      <section className="card mt-7 p-5">
        <h2 className="text-lg font-black">Today’s memory progress</h2>
        <p className="text-ink/60 mt-1 text-sm">
          {strengthened.length}{" "}
          {strengthened.length === 1 ? "phrase" : "phrases"} strengthened
        </p>
        <ul className="mt-4 space-y-3">
          {changes.map((change) => (
            <li key={change.phraseId} className="flex items-baseline gap-3">
              <Mic className="text-ink/35 shrink-0" size={16} />
              <span className="font-black">{change.esMX}</span>
              <span className="text-ink/60 ml-auto text-right text-xs">
                {change.summary}
              </span>
            </li>
          ))}
          {!changes.length && (
            <li className="text-ink/60 text-sm">
              No spoken attempts were recorded this session.
            </li>
          )}
        </ul>
      </section>

      <p className="text-ink/75 mt-6 text-center">{lesson.completionMessage}</p>
      <p className="mt-2 text-center text-2xl font-black">
        +{lesson.travelPoints} Travel Points
      </p>
      <Link
        href="/"
        className="tap-target bg-ink mt-7 flex items-center justify-center rounded-2xl px-6 font-black text-white"
      >
        Done for today
      </Link>
    </main>
  );
}
