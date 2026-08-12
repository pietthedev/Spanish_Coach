"use client";

import Link from "next/link";
import {
  ChevronLeft,
  Lightbulb,
  MessageCircle,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { course, phraseById } from "@/content/course";
import type { EvaluationResult } from "@/lib/evaluation/evaluate";
import {
  advanceHostTurn,
  startMission,
  submitMissionAnswer,
} from "@/lib/mission/state-machine";
import { completeLesson } from "@/lib/offline/progress";
import { syncOutbox } from "@/lib/offline/sync";
import { useRumbo } from "./app-providers";
import { AudioButton } from "./audio-button";
import { MicRecorder } from "./mic-recorder";

const scenario = course.scenarios[0]!;

export function MissionPlayer() {
  const { profile } = useRumbo();
  const [state, setState] = useState(() => startMission(scenario));
  const [feedback, setFeedback] = useState<EvaluationResult>();
  const [showHint, setShowHint] = useState(false);
  const [playingHost, setPlayingHost] = useState(false);
  const turn = scenario.turns.find((item) => item.id === state.currentTurnId)!;
  const acceptedPhrases = turn.acceptedPhraseIds.map((phraseId) =>
    phraseById.get(phraseId)!,
  );

  const advance = () => {
    setPlayingHost(false);
    const next = advanceHostTurn(state, scenario);
    setState(next);
    if (next.complete) void finish();
  };

  const submit = (result: EvaluationResult) => {
    setFeedback(result);
    const next = submitMissionAnswer(state, scenario, result);
    if (next.currentTurnId !== state.currentTurnId) {
      window.setTimeout(() => {
        setState(next);
        setFeedback(undefined);
        setShowHint(false);
      }, 2_500);
    } else {
      setState(next);
    }
  };

  const playHost = () => {
    if (!("speechSynthesis" in window)) return;
    setPlayingHost(true);
    const utterance = new SpeechSynthesisUtterance(turn.line);
    utterance.lang = "es-MX";
    utterance.rate = 0.88;
    utterance.onend = () => setPlayingHost(false);
    utterance.onerror = () => setPlayingHost(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const finish = async () => {
    if (profile) {
      await completeLesson(profile.id, "mx71.d07", 25);
      void syncOutbox();
    }
  };

  if (state.complete) return <MissionComplete />;

  const progress = Math.round(
    (state.completedIntents.length / scenario.requiredIntents.length) * 100,
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-4 py-4">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          className="tap-target grid place-items-center"
          aria-label="Exit mission"
        >
          <ChevronLeft />
        </Link>
        <div className="flex-1">
          <p className="text-coral text-xs font-black">MEXICO MISSION</p>
          <h1 className="font-black">Friendly arrival</h1>
        </div>
        <span className="text-sm font-bold">
          {state.completedIntents.length}/6
        </span>
      </header>

      <div className="bg-ink/10 mt-3 h-2 overflow-hidden rounded-full">
        <div className="bg-coral h-full" style={{ width: `${progress}%` }} />
      </div>

      <section className="flex flex-1 flex-col justify-center py-7">
        <div className="bg-marigold/20 mb-5 rounded-2xl p-4 text-sm">
          <strong>Goal:</strong> {scenario.goal}
        </div>

        {turn.speaker === "host" ? (
          <div className="card p-6">
            <div className="text-agave flex items-center gap-2 text-xs font-black tracking-wider">
              <MessageCircle size={18} />
              HOST
            </div>
            <p className="mt-4 text-3xl leading-tight font-black">
              {turn.line}
            </p>
            <p className="text-ink/60 mt-3">{turn.meaning}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={playHost}
                className="tap-target border-ink/15 flex items-center justify-center gap-2 rounded-2xl border bg-white font-bold"
              >
                <Volume2 size={20} />
                {playingHost ? "Playing…" : "Listen to host"}
              </button>
              <button
                type="button"
                onClick={advance}
                className="tap-target bg-ink rounded-2xl font-black text-white"
              >
                {turn.next ? "Your turn" : "Finish mission"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-coral text-xs font-black tracking-wider">
              YOUR TURN · {turn.expectedIntent?.replaceAll("-", " ")}
            </p>
            <h2 className="mt-3 text-3xl font-black">{turn.meaning}</h2>
            <p className="text-ink/65 mt-3 font-bold">
              Speak your answer—no typing.
            </p>

            <button
              type="button"
              onClick={() => setShowHint(true)}
              className="tap-target border-ink/20 mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border bg-white font-bold"
            >
              <Lightbulb size={18} />
              Need a phrase
            </button>

            {(showHint || state.attemptsForTurn > 0) && (
              <div className="bg-marigold/20 mt-4 rounded-2xl p-4">
                <p className="text-sm">
                  {state.attemptsForTurn >= 2 ? turn.repair : turn.hint}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {acceptedPhrases.map((phrase) => (
                    <div key={phrase.id}>
                      <p className="mb-2 font-black">{phrase.esMX}</p>
                      <AudioButton phrase={phrase} speed="normal" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <MicRecorder
                key={turn.id}
                phrase={acceptedPhrases[0]!}
                acceptedPhrases={acceptedPhrases}
                onResult={submit}
              />
            </div>

            {feedback && (
              <div
                className={`mt-4 rounded-xl p-3 ${["understood", "different-valid", "minor-issue"].includes(feedback.outcome) ? "bg-agave/10" : feedback.outcome === "technical-failure" ? "bg-sky/10" : "bg-marigold/20"}`}
                role="status"
                data-speech-feedback
              >
                <p className="font-black">{feedback.label}</p>
                <p className="mt-1 text-sm">{feedback.message}</p>
                {feedback.transcript && (
                  <p className="text-ink/65 mt-2 text-sm">
                    The service heard: &quot;{feedback.transcript}&quot;
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function MissionComplete() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-[430px] place-items-center p-5 text-center">
      <div>
        <div className="bg-marigold mx-auto grid h-24 w-24 place-items-center rounded-full">
          <Sparkles size={40} />
        </div>
        <p className="text-coral mt-6 text-sm font-black tracking-wider">
          MISSION COMPLETE
        </p>
        <h1 className="mt-3 text-4xl font-black">Friendly arrival</h1>
        <p className="text-ink/70 mt-3">
          You completed all six intents: greeting, name, origin, language level,
          slower speech and thanks.
        </p>
        <div className="card mt-6 p-5">
          <p className="text-3xl font-black">+25</p>
          <p className="text-ink/55 text-sm">
            Travel Points · Mission stamp earned
          </p>
        </div>
        <Link
          href="/"
          className="tap-target bg-ink mt-6 flex items-center justify-center rounded-2xl px-5 font-black text-white"
        >
          Done for today
        </Link>
      </div>
    </main>
  );
}
