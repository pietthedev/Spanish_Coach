"use client";

import Link from "next/link";
import {
  Check,
  ChevronLeft,
  Lightbulb,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { course, phraseById } from "@/content/course";
import {
  evaluateAnswer,
  type EvaluationResult,
} from "@/lib/evaluation/evaluate";
import {
  advanceHostTurn,
  startMission,
  submitMissionAnswer,
} from "@/lib/mission/state-machine";
import { completeLesson } from "@/lib/offline/progress";
import { syncOutbox } from "@/lib/offline/sync";
import { useRumbo } from "./app-providers";

const scenario = course.scenarios[0]!;
export function MissionPlayer() {
  const { profile } = useRumbo();
  const [state, setState] = useState(() => startMission(scenario));
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<EvaluationResult>();
  const turn = scenario.turns.find((item) => item.id === state.currentTurnId)!;
  const advance = () => {
    const next = advanceHostTurn(state, scenario);
    setState(next);
    if (next.complete) void finish();
  };
  const submit = () => {
    let best: EvaluationResult | undefined;
    for (const phraseId of turn.acceptedPhraseIds) {
      const phrase = phraseById.get(phraseId)!;
      const result = evaluateAnswer(answer, phrase);
      if (
        ["understood", "different-valid", "minor-issue"].includes(
          result.outcome,
        )
      ) {
        best = result;
        break;
      }
      best ??= result;
    }
    if (!best) return;
    setFeedback(best);
    const next = submitMissionAnswer(state, scenario, best);
    if (next.currentTurnId !== state.currentTurnId) {
      window.setTimeout(() => {
        setState(next);
        setAnswer("");
        setFeedback(undefined);
      }, 650);
    } else setState(next);
  };
  const useHint = () => {
    const model = phraseById.get(turn.acceptedPhraseIds[0]!)?.esMX ?? "";
    setAnswer(model.replace("…", " Alex"));
  };
  const finish = async () => {
    if (profile) {
      await completeLesson(profile.id, "mx71.d07", 25);
      void syncOutbox();
    }
  };
  if (state.complete)
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
            You completed all six intents: greeting, name, origin, language
            level, slower speech and thanks.
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
            <button
              onClick={advance}
              className="tap-target bg-ink mt-6 w-full rounded-2xl font-black text-white"
            >
              {turn.next ? "Respond" : "Finish mission"}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-coral text-xs font-black tracking-wider">
              YOUR TURN · {turn.expectedIntent?.replaceAll("-", " ")}
            </p>
            <h2 className="mt-3 text-3xl font-black">{turn.meaning}</h2>
            <label className="mt-5 block font-bold" htmlFor="mission-answer">
              Type what you would say{" "}
              <span className="text-ink/50 text-sm font-normal">
                (voice input can use your keyboard mic)
              </span>
            </label>
            <input
              id="mission-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              className="tap-target border-ink/20 mt-2 w-full rounded-2xl border-2 bg-white px-4 text-lg"
              lang="es-MX"
              autoComplete="off"
            />
            <div className="mt-3 flex gap-3">
              <button
                onClick={useHint}
                className="tap-target border-ink/20 flex flex-1 items-center justify-center gap-2 rounded-2xl border font-bold"
              >
                <Lightbulb size={18} />
                Need a phrase
              </button>
              <button
                onClick={submit}
                disabled={!answer.trim()}
                className="tap-target bg-agave flex flex-1 items-center justify-center gap-2 rounded-2xl font-black text-white disabled:opacity-40"
              >
                <Check size={18} />
                Check
              </button>
            </div>
            {state.attemptsForTurn > 0 && (
              <p className="bg-marigold/20 mt-4 rounded-xl p-3 text-sm">
                {state.attemptsForTurn >= 2 ? turn.repair : turn.hint}
              </p>
            )}
            {feedback && (
              <p
                className="mt-4 rounded-xl bg-white p-3 font-bold"
                role="status"
              >
                {feedback.label} · {feedback.message}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
