"use client";

import Link from "next/link";
import {
  Check,
  ChevronLeft,
  Eye,
  Headphones,
  MessageCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRumbo } from "./app-providers";
import { AudioButton } from "./audio-button";
import { MicRecorder } from "./mic-recorder";
import { phraseById } from "@/content/course";
import type { Exercise, Lesson } from "@/content/runtime-types";
import type { EvaluationResult } from "@/lib/evaluation/evaluate";
import { completeLesson, recordLessonStarted } from "@/lib/offline/progress";
import { syncOutbox } from "@/lib/offline/sync";

export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const { profile } = useRumbo();
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<EvaluationResult>();
  const [choice, setChoice] = useState<string>();
  const [complete, setComplete] = useState(false);
  const exercises = useMemo(
    () => lesson.exercises.filter((e) => e.type !== "due-review"),
    [lesson],
  );
  const exercise = exercises[step];
  useEffect(() => {
    setLessonActivity(true);
    if (profile) void recordLessonStarted(profile.id, lesson.id);
    return () => {
      setLessonActivity(false);
    };
  }, [lesson.id, profile]);
  const next = () => {
    setFeedback(undefined);
    setChoice(undefined);
    setRevealed(false);
    if (step < exercises.length - 1) setStep(step + 1);
    else void finish();
  };
  const finish = async () => {
    if (profile) {
      await completeLesson(profile.id, lesson.id, lesson.travelPoints);
      void syncOutbox();
    }
    setComplete(true);
    setLessonActivity(false);
  };
  if (complete) return <Completion lesson={lesson} />;
  if (!exercise)
    return <div className="p-6">Lesson content is unavailable.</div>;
  const progress = Math.round(((step + 1) / exercises.length) * 100);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-4 py-4">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          className="tap-target grid place-items-center rounded-full"
          aria-label="Exit lesson"
        >
          <ChevronLeft />
        </Link>
        <div
          className="bg-ink/10 h-2 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Lesson progress"
        >
          <div
            className="bg-agave h-full rounded-full transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm font-bold">
          {step + 1}/{exercises.length}
        </span>
      </header>
      <section className="flex flex-1 flex-col justify-center py-8">
        {renderExercise(exercise, {
          revealed,
          setRevealed,
          feedback,
          setFeedback,
          choice,
          setChoice,
        })}
      </section>
      <footer className="safe-bottom bg-canvas sticky bottom-0 pt-3">
        <button
          type="button"
          onClick={next}
          disabled={
            exercise.type === "listen-choice" && choice !== exercise.answer
          }
          className="tap-target bg-ink w-full rounded-2xl px-5 font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          {step === exercises.length - 1 ? "Complete lesson" : "Continue"}
        </button>
      </footer>
    </main>
  );
}

function setLessonActivity(active: boolean) {
  if (active) document.body.dataset.lessonActive = "true";
  else delete document.body.dataset.lessonActive;
  window.dispatchEvent(
    new CustomEvent("rumbo-lesson-activity", { detail: active }),
  );
}

type UI = {
  revealed: boolean;
  setRevealed: (v: boolean) => void;
  feedback?: EvaluationResult;
  setFeedback: (v: EvaluationResult) => void;
  choice?: string;
  setChoice: (v: string) => void;
};
function renderExercise(exercise: Exercise, ui: UI) {
  if (exercise.type === "present") {
    const phrase = phraseById.get(exercise.phraseId)!;
    return (
      <div>
        <p className="text-agave text-xs font-black tracking-[.18em]">
          LISTEN & NOTICE
        </p>
        <h1 className="mt-4 text-4xl leading-tight font-black">
          {phrase.esMX}
        </h1>
        <p className="text-ink/75 mt-3 text-xl">{phrase.english}</p>
        <p className="mt-5 rounded-2xl bg-white p-4 text-sm leading-relaxed">
          {phrase.context}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <AudioButton phrase={phrase} speed="normal" />
          <AudioButton phrase={phrase} speed="slow" />
        </div>
        <details className="mt-5">
          <summary className="tap-target flex cursor-pointer items-center gap-2 font-bold">
            <Eye size={20} />
            Approximate pronunciation
          </summary>
          <p className="bg-marigold/20 rounded-xl p-3">
            {phrase.pronunciationAid}{" "}
            <span className="text-ink/60 block text-xs">
              Audio is the authority; this aid is approximate.
            </span>
          </p>
        </details>
      </div>
    );
  }
  if (exercise.type === "retrieve") {
    const phrase = phraseById.get(exercise.phraseId)!;
    return (
      <div className="text-center">
        <RotateCcw className="text-sky mx-auto" size={36} />
        <p className="text-sky mt-4 text-sm font-black tracking-wider">
          ACTIVE RECALL
        </p>
        <h1 className="mt-4 text-3xl font-black">{phrase.english}</h1>
        <p className="text-ink/65 mt-3">Say it in Spanish before revealing.</p>
        {ui.revealed ? (
          <div className="card mt-7 p-6">
            <p className="text-3xl font-black">{phrase.esMX}</p>
            <div className="mt-5 flex justify-center gap-3">
              <AudioButton phrase={phrase} speed="normal" />
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="tap-target border-ink mt-7 rounded-2xl border-2 px-6 font-black"
            onClick={() => ui.setRevealed(true)}
          >
            Reveal phrase
          </button>
        )}
      </div>
    );
  }
  if (exercise.type === "listen-choice") {
    const phrase = phraseById.get(exercise.phraseId)!;
    return (
      <div>
        <Headphones className="text-sky" size={36} />
        <p className="text-sky mt-3 text-sm font-black tracking-wider">
          LISTEN & UNDERSTAND
        </p>
        <h1 className="mt-3 text-3xl font-black">What did you hear?</h1>
        <div className="mt-5">
          <AudioButton phrase={phrase} speed="normal" />
        </div>
        <div className="mt-6 grid gap-3">
          {exercise.options.map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => ui.setChoice(option)}
              className={`tap-target rounded-2xl border-2 p-4 text-left font-bold ${ui.choice === option ? (option === exercise.answer ? "border-agave bg-agave/10" : "border-coral bg-coral/10") : "border-ink/15 bg-white"}`}
            >
              {option}
              {ui.choice === option && option === exercise.answer && (
                <Check className="text-agave float-right" />
              )}
            </button>
          ))}
        </div>
        {ui.choice && ui.choice !== exercise.answer && (
          <p className="bg-coral/10 mt-4 rounded-xl p-3">
            Almost—listen once more. Mistakes are part of retrieval.
          </p>
        )}
      </div>
    );
  }
  if (exercise.type === "speak") {
    const phrase = phraseById.get(exercise.phraseId)!;
    return (
      <div>
        <p className="text-agave text-sm font-black tracking-wider">SPEAK</p>
        <h1 className="mt-3 text-3xl font-black">{exercise.prompt}</h1>
        <p className="text-ink/65 mt-2">
          Say: <strong>{phrase.esMX}</strong>
        </p>
        <div className="mt-6">
          <MicRecorder phrase={phrase} onResult={ui.setFeedback} />
        </div>
        {ui.feedback && (
          <div
            className={`mt-6 rounded-2xl p-4 ${["understood", "different-valid"].includes(ui.feedback.outcome) ? "bg-agave/10" : ui.feedback.outcome === "technical-failure" ? "bg-sky/10" : "bg-marigold/20"}`}
            role="status"
          >
            <p className="font-black">{ui.feedback.label}</p>
            <p className="mt-1 text-sm">{ui.feedback.message}</p>
            {ui.feedback.transcript && (
              <p className="text-ink/65 mt-2 text-sm">
                The service heard: “{ui.feedback.transcript}”
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
  if (exercise.type === "micro-scenario")
    return (
      <div className="text-center">
        <MessageCircle className="text-coral mx-auto" size={40} />
        <p className="text-coral mt-4 text-sm font-black tracking-wider">
          TRAVEL MOMENT
        </p>
        <h1 className="mt-4 text-3xl font-black">Use it in context</h1>
        <p className="card mt-5 p-5 text-left text-lg leading-relaxed">
          {exercise.prompt}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {exercise.phraseIds.map((id) => (
            <span
              key={id}
              className="rounded-full bg-white px-3 py-2 text-sm font-bold"
            >
              {phraseById.get(id)?.esMX}
            </span>
          ))}
        </div>
      </div>
    );
  return null;
}

function Completion({ lesson }: { lesson: Lesson }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-[430px] place-items-center px-5 text-center">
      <div>
        <div className="bg-marigold mx-auto grid h-24 w-24 place-items-center rounded-full">
          <Sparkles size={42} />
        </div>
        <p className="text-coral mt-6 text-sm font-black tracking-[.16em]">
          LESSON COMPLETE
        </p>
        <h1 className="mt-3 text-4xl font-black">¡Muy bien!</h1>
        <p className="text-ink/75 mt-4 text-lg">{lesson.completionMessage}</p>
        <div className="card mt-7 grid grid-cols-2 gap-3 p-5">
          <div>
            <p className="text-2xl font-black">+{lesson.travelPoints}</p>
            <p className="text-ink/60 text-xs">Travel Points</p>
          </div>
          <div>
            <p className="text-2xl font-black">Building</p>
            <p className="text-ink/60 text-xs">Foundations</p>
          </div>
        </div>
        <Link
          href="/"
          className="tap-target bg-ink mt-7 flex items-center justify-center rounded-2xl px-6 font-black text-white"
        >
          Done for today
        </Link>
      </div>
    </main>
  );
}
