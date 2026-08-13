"use client";

import Link from "next/link";
import { Car, Ear, Mic, Pause, Play, Square, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRumbo } from "./app-providers";
import { course, phraseById } from "@/content/course";
import { AudioOrchestrator } from "@/lib/audio/orchestrator";
import { SpeechListener } from "@/lib/audio/listener";
import { stopPlayback } from "@/lib/audio/playback";
import { closeTones } from "@/lib/audio/tones";
import { matchCommand } from "@/lib/drive/commands";
import {
  currentActivity,
  driveReducer,
  initialContext,
  type DriveContext,
  type DriveEvent,
} from "@/lib/drive/machine";
import {
  coachingSteps,
  hintSteps,
  promptSteps,
  sessionIntro,
  sessionOutro,
  teachAnswerSteps,
} from "@/lib/drive/narration";
import { planDriveSession } from "@/lib/drive/planner";
import {
  ACTIVITY_STEP_KIND,
  type DriveDuration,
  type DriveSessionSummary,
} from "@/lib/drive/types";
import { WakeLockHandle } from "@/lib/drive/wake-lock";
import type { PhraseMastery } from "@/lib/learning/types";
import { MEMORY_BAND_LABEL, memoryBand } from "@/lib/learning/mastery";
import { loadMastery, recordDriveSession, recordPhraseAttempt } from "@/lib/offline/progress";
import { syncOutbox } from "@/lib/offline/sync";
import { transcribeAttempt } from "@/lib/speech/transcribe-client";

/** Recall effort before the state moves on from thinking. */
const THINKING_MS = 4_000;

type RuntimeContext = DriveContext & { seq: number };

/**
 * Events that update what is displayed without starting new work. The clock
 * tick in particular fires every second: if it bumped the sequence it would
 * restart whatever audio was playing before it could ever finish.
 */
const PASSIVE_EVENTS: ReadonlySet<DriveEvent["type"]> = new Set([
  "TICK",
  "THINK_ELAPSED",
  "SPEECH_STARTED",
]);

const runtimeReducer = (
  context: RuntimeContext,
  event: DriveEvent,
): RuntimeContext => ({
  ...driveReducer(context, event),
  seq: PASSIVE_EVENTS.has(event.type) ? context.seq : context.seq + 1,
});

const DURATIONS: { value: DriveDuration; label: string; blurb: string }[] = [
  { value: 10, label: "Quick Drive", blurb: "Fast reinforcement of what is slipping." },
  { value: 15, label: "Daily Drive", blurb: "A complete commute lesson." },
  { value: 20, label: "Deep Drive", blurb: "Wider spacing and more conversation." },
];

export function DrivePlayer() {
  const { profile } = useRumbo();
  const [duration, setDuration] = useState<DriveDuration>(15);
  const [phase, setPhase] = useState<"picking" | "driving" | "done">("picking");
  const [summary, setSummary] = useState<DriveSessionSummary>();
  const [baseline, setBaseline] = useState<ReadonlyMap<string, PhraseMastery>>(new Map());
  const [context, dispatch] = useReducer(runtimeReducer, {
    ...initialContext(),
    seq: 0,
  });

  const orchestrator = useRef<AudioOrchestrator>(undefined);
  const listener = useRef<SpeechListener>(undefined);
  const wakeLock = useRef<WakeLockHandle>(undefined);
  const startedAt = useRef(0);
  const listening = useRef(false);
  const recorded = useRef(0);
  const finished = useRef(false);

  orchestrator.current ??= new AudioOrchestrator();
  listener.current ??= new SpeechListener();
  wakeLock.current ??= new WakeLockHandle();

  const cleanup = useCallback(() => {
    orchestrator.current?.stop();
    listener.current?.cancel();
    void wakeLock.current?.release();
    stopPlayback();
    closeTones();
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // Re-acquire the wake lock when the driver returns to the tab.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible")
        void wakeLock.current?.reacquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const start = useCallback(async () => {
    // This tap is the gesture that unlocks audio for the whole drive.
    await orchestrator.current?.unlock();
    await wakeLock.current?.acquire();
    const mastery = profile
      ? await loadMastery(profile.id).catch(() => new Map<string, PhraseMastery>())
      : new Map<string, PhraseMastery>();
    setBaseline(mastery);
    const plan = planDriveSession({
      duration,
      phrases: phraseById,
      mastery,
      scenarios: course.scenarios,
      newPhraseIds: course.lessons.flatMap((lesson) => lesson.newPhraseIds),
      now: new Date(),
    });
    startedAt.current = Date.now();
    setPhase("driving");
    dispatch({ type: "PREPARED", plan });
  }, [duration, profile]);

  // Elapsed-time ticker; the machine decides when to start wrapping up.
  useEffect(() => {
    if (phase !== "driving") return;
    const timer = window.setInterval(
      () => dispatch({ type: "TICK", elapsedMs: Date.now() - startedAt.current }),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [phase]);

  // Persist every new attempt into the same mastery records lessons use.
  useEffect(() => {
    if (!profile) return;
    const fresh = context.records.slice(recorded.current);
    if (!fresh.length) return;
    recorded.current = context.records.length;
    for (const record of fresh) {
      if (record.outcome === "technical-failure") continue;
      void recordPhraseAttempt(profile.id, {
        phraseId: record.phraseId,
        outcome: record.outcome as never,
        assistance: record.assistanceLevel as never,
        cueType: record.kind === "intent-recall" ? "english" : "situation",
        stepKind: ACTIVITY_STEP_KIND[record.kind],
        hintCount: Number(record.assistanceLevel.replace("hint-", "")) || 0,
        answerVisible: false,
        responseLatencyMs: record.latencyMs,
        transcript: record.transcript,
        attemptNumber: 1,
        timestamp: new Date().toISOString(),
      }).catch(() => undefined);
    }
  }, [context.records, profile]);

  const finish = useCallback(
    async (ctx: RuntimeContext) => {
      if (finished.current) return;
      finished.current = true;
      const result: DriveSessionSummary = {
        duration,
        actualMs: Date.now() - startedAt.current,
        activitiesCompleted: ctx.index + 1,
        phrasesAttempted: new Set(ctx.records.map((r) => r.phraseId)).size,
        independentSuccesses: ctx.records.filter((r) => r.independent).length,
        hintAssistedSuccesses: ctx.records.filter((r) => r.hinted).length,
        errors: ctx.records.filter(
          (r) => !r.technical && !r.independent && !r.hinted,
        ).length,
        technicalFailures: ctx.records.filter((r) => r.technical).length,
        reason: ctx.endReason ?? "completed",
      };
      setSummary(result);
      const strongestId = ctx.records.find((r) => r.independent)?.phraseId;
      const strongestPhrase = strongestId ? phraseById.get(strongestId) : undefined;
      const latest = profile
        ? await loadMastery(profile.id).catch(() => new Map<string, PhraseMastery>())
        : new Map<string, PhraseMastery>();
      const strongestMastery = strongestId ? latest.get(strongestId) : undefined;
      await orchestrator.current?.play(
        sessionOutro(
          result,
          strongestPhrase && strongestMastery
            ? { phrase: strongestPhrase, mastery: strongestMastery }
            : undefined,
        ),
      );
      if (profile) {
        await recordDriveSession(profile.id, result);
        void syncOutbox();
      }
      void wakeLock.current?.release();
      setPhase("done");
    },
    [duration, profile],
  );

  // One effect owns every side effect, keyed on the machine's step counter so
  // repeating a state (a replay, another hint) still re-runs.
  useEffect(() => {
    if (phase !== "driving") return;
    const orch = orchestrator.current!;
    const activity = currentActivity(context);
    const phrase = activity ? phraseById.get(activity.phraseId) : undefined;
    let cancelled = false;

    const run = async () => {
      switch (context.state) {
        case "intro": {
          if (!context.plan) return;
          await orch.play(sessionIntro(context.plan));
          if (!cancelled) dispatch({ type: "INTRO_DONE" });
          return;
        }
        case "prompting": {
          if (!activity || !phrase) return;
          const steps =
            context.pending?.type === "speak-hint"
              ? hintSteps(phrase, context.pending.level)
              : context.pending?.type === "teach-answer"
                ? teachAnswerSteps(phrase)
                : promptSteps(activity, phrase);
          const completed = await orch.play(steps);
          if (!cancelled && completed) dispatch({ type: "PROMPT_DONE" });
          return;
        }
        case "thinking": {
          if (listening.current || !activity || !phrase) return;
          listening.current = true;
          window.setTimeout(() => {
            if (!cancelled) dispatch({ type: "THINK_ELAPSED" });
          }, THINKING_MS);
          const heard = await listener.current!.listen({
            onSpeechStart: () => dispatch({ type: "SPEECH_STARTED" }),
          });
          listening.current = false;
          if (cancelled) return;
          if (heard.status === "silence") return dispatch({ type: "NO_SPEECH" });
          if (heard.status === "cancelled") return;
          if (heard.status === "technical")
            return dispatch({
              type: "EVALUATED",
              result: {
                outcome: "technical-failure",
                label: "Microphone",
                message: heard.error,
                transcript: "",
              },
            });

          const evaluation = await transcribeAttempt({
            blob: heard.blob,
            mimeType: heard.mimeType,
            phraseIds: [phrase.id],
            durationMs: heard.durationMs,
          });
          if (cancelled) return;
          // Control words never reach the mastery evaluator.
          const command = matchCommand(evaluation.transcript);
          if (command) return dispatch({ type: "COMMAND", command });
          dispatch({
            type: "EVALUATED",
            result: evaluation,
            latencyMs: Date.now() - heard.startedAt,
          });
          return;
        }
        case "feedback": {
          if (context.lastTone) await orch.tone(context.lastTone);
          if (!cancelled) dispatch({ type: "FEEDBACK_DONE" });
          return;
        }
        case "coaching": {
          if (context.lastTone) await orch.tone(context.lastTone);
          if (!phrase) return;
          const steps =
            context.pending?.type === "teach-answer"
              ? teachAnswerSteps(phrase)
              : coachingSteps(
                  { outcome: "incomplete", label: "", message: "", transcript: "" },
                  phrase,
                );
          await orch.play(steps);
          if (!cancelled) dispatch({ type: "FEEDBACK_DONE" });
          return;
        }
        case "completed": {
          listener.current?.cancel();
          await finish(context);
          return;
        }
        case "paused": {
          orch.stop();
          listener.current?.cancel();
          listening.current = false;
          return;
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.seq, phase]);

  if (phase === "done" && summary)
    return <DriveSummary summary={summary} baseline={baseline} profileId={profile?.id} />;

  if (phase === "driving")
    return (
      <DriveScreen
        duration={duration}
        state={context.state}
        elapsedMs={context.elapsedMs}
        debug={`${context.state} · step ${context.index + 1}/${context.activities.length} · seq ${context.seq} · ${currentActivity(context)?.id ?? "—"}`}
        onPause={() => dispatch({ type: "PAUSE" })}
        onResume={() => dispatch({ type: "RESUME" })}
        onEnd={() => {
          cleanup();
          dispatch({ type: "END", reason: "ended-early" });
        }}
      />
    );

  return (
    <DrivePicker
      duration={duration}
      onSelect={setDuration}
      onStart={() => void start()}
    />
  );
}

function DrivePicker({
  duration,
  onSelect,
  onStart,
}: {
  duration: DriveDuration;
  onSelect: (value: DriveDuration) => void;
  onStart: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-5 py-8">
      <div className="flex items-center gap-3">
        <Car className="text-coral" size={32} aria-hidden="true" />
        <h1 className="text-4xl font-black">Drive Mode</h1>
      </div>
      <p className="text-ink/70 mt-3 text-lg">
        Learn hands-free on your commute. Rumbo speaks, you answer out loud.
      </p>

      <fieldset className="mt-7">
        <legend className="sr-only">Choose how long you are driving</legend>
        <div className="grid gap-3">
          {DURATIONS.map((option) => {
            const selected = option.value === duration;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSelect(option.value)}
                aria-pressed={selected}
                className={`tap-target rounded-2xl border-2 p-5 text-left ${
                  selected ? "border-ink bg-white" : "border-ink/15 bg-white/60"
                }`}
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-2xl font-black">{option.value} min</span>
                  <span className="font-black">· {option.label}</span>
                  {option.value === 15 && (
                    <span className="bg-agave/15 text-agave ml-auto rounded-full px-2 py-1 text-[11px] font-black">
                      RECOMMENDED
                    </span>
                  )}
                </span>
                <span className="text-ink/65 mt-1 block text-sm">{option.blurb}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="bg-marigold/20 mt-6 rounded-2xl p-4 text-sm">
        Start your lesson before you begin driving. Once started, Rumbo is
        hands-free — you will not need to look at or touch your phone.
      </p>

      <div className="mt-auto pt-7">
        <button
          type="button"
          onClick={onStart}
          className="tap-target bg-ink w-full rounded-2xl px-6 py-2 text-lg font-black text-white"
        >
          Start Drive Lesson
        </button>
        <p className="mt-4 text-center">
          <Link href="/practice" className="text-ink/55 font-bold underline">
            Back to practice
          </Link>
        </p>
      </div>
    </main>
  );
}

const STATE_HINT: Partial<Record<DriveContext["state"], { text: string; Icon: typeof Ear }>> = {
  intro: { text: "Starting…", Icon: Volume2 },
  prompting: { text: "Listen", Icon: Volume2 },
  thinking: { text: "Your turn", Icon: Mic },
  listening: { text: "Listening", Icon: Mic },
  evaluating: { text: "Checking", Icon: Ear },
  feedback: { text: "", Icon: Ear },
  coaching: { text: "Listen", Icon: Volume2 },
  paused: { text: "Paused", Icon: Pause },
  wrapping: { text: "Wrapping up", Icon: Ear },
};

function DriveScreen({
  duration,
  state,
  elapsedMs,
  debug,
  onPause,
  onResume,
  onEnd,
}: {
  duration: DriveDuration;
  state: DriveContext["state"];
  elapsedMs: number;
  debug?: string;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}) {
  const remaining = Math.max(0, duration * 60_000 - elapsedMs);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const hint = STATE_HINT[state];
  const paused = state === "paused";

  return (
    <main className="bg-ink mx-auto flex min-h-dvh max-w-[430px] flex-col px-6 py-10 text-white">
      <p className="text-marigold text-sm font-black tracking-[.2em]">RUMBO DRIVE</p>
      <p className="mt-1 text-white/60">{duration}-minute session</p>

      <div className="flex flex-1 flex-col justify-center">
        <p className="text-5xl leading-[1.1] font-black">Eyes on the road</p>
        <p
          className="mt-6 flex items-center gap-3 text-2xl font-bold text-white/70"
          aria-live="polite"
        >
          {hint?.Icon && <hint.Icon size={28} aria-hidden="true" />}
          {hint?.text}
        </p>
        <p className="mt-10 font-mono text-3xl text-white/50">
          <span className="sr-only">Time remaining: </span>
          {minutes}:{String(seconds).padStart(2, "0")} remaining
        </p>
      </div>

      {process.env.NODE_ENV !== "production" && debug && (
        <p
          className="mb-3 font-mono text-[11px] break-all text-white/35"
          data-drive-debug
        >
          {debug}
        </p>
      )}

      <div className="safe-bottom grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={paused ? onResume : onPause}
          className="tap-target flex h-28 items-center justify-center gap-3 rounded-3xl bg-white/15 text-xl font-black"
        >
          {paused ? <Play size={30} /> : <Pause size={30} />}
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={onEnd}
          className="tap-target bg-coral flex h-28 items-center justify-center gap-3 rounded-3xl text-xl font-black"
        >
          <Square size={26} />
          End
        </button>
      </div>
    </main>
  );
}

function DriveSummary({
  summary,
  baseline,
  profileId,
}: {
  summary: DriveSessionSummary;
  baseline: ReadonlyMap<string, PhraseMastery>;
  profileId?: string;
}) {
  const [after, setAfter] = useState<ReadonlyMap<string, PhraseMastery>>(new Map());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const latest = profileId
        ? await loadMastery(profileId).catch(() => new Map<string, PhraseMastery>())
        : new Map<string, PhraseMastery>();
      if (!cancelled) setAfter(latest);
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const changed = useMemo(
    () =>
      [...after.entries()]
        .map(([phraseId, record]) => ({
          phraseId,
          before: memoryBand(baseline.get(phraseId)),
          band: memoryBand(record),
        }))
        .filter((item) => item.before !== item.band)
        .slice(0, 8),
    [after, baseline],
  );

  const elapsed = formatElapsed(summary.actualMs);
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] px-5 py-10">
      <div className="text-center">
        <div className="bg-marigold mx-auto grid h-20 w-20 place-items-center rounded-full">
          <Car size={36} />
        </div>
        <h1 className="mt-5 text-4xl font-black">Drive complete</h1>
        <p className="text-ink/65 mt-2">
          {elapsed} · {summary.activitiesCompleted}{" "}
          {summary.activitiesCompleted === 1 ? "activity" : "activities"}
        </p>
      </div>

      <section className="card mt-7 grid grid-cols-2 gap-4 p-5">
        <Stat value={summary.phrasesAttempted} label="Phrases practised" />
        <Stat value={summary.independentSuccesses} label="Unaided recalls" />
        <Stat value={summary.hintAssistedSuccesses} label="With a hint" />
        <Stat value={summary.errors} label="Need review" />
      </section>

      {summary.technicalFailures > 0 && (
        <p className="bg-sky/10 mt-4 rounded-xl p-3 text-sm">
          {summary.technicalFailures} attempt
          {summary.technicalFailures === 1 ? "" : "s"} could not be heard
          properly. These did not affect your progress.
        </p>
      )}

      {changed.length > 0 && (
        <section className="card mt-5 p-5">
          <h2 className="text-lg font-black">Memory changes</h2>
          <ul className="mt-3 space-y-2">
            {changed.map((item) => (
              <li key={item.phraseId} className="flex items-baseline gap-3">
                <span className="font-black">
                  {phraseById.get(item.phraseId)?.esMX ?? item.phraseId}
                </span>
                <span className="text-ink/60 ml-auto text-xs">
                  {MEMORY_BAND_LABEL[item.band]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/"
        className="tap-target bg-ink mt-7 flex items-center justify-center rounded-2xl px-6 font-black text-white"
      >
        Done
      </Link>
    </main>
  );
}

/** Short drives are common when a commute ends early; never report "0 minutes". */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60)
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-black">{value}</p>
      <p className="text-ink/60 text-xs">{label}</p>
    </div>
  );
}
