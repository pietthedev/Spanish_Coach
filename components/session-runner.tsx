"use client";

import { Ear, Headphones, Lightbulb, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioButton } from "./audio-button";
import { MicRecorder } from "./mic-recorder";
import { phraseById } from "@/content/course";
import type { Phrase } from "@/content/schema";
import type { EvaluationResult } from "@/lib/evaluation/evaluate";
import {
  pause,
  playPhraseAudio,
  speakEnglish,
  stopPlayback,
} from "@/lib/audio/playback";
import { presentCue } from "@/lib/learning/cue";
import {
  describeBandChange,
  stepFeedback,
  type BandChange,
  type StepFeedback,
} from "@/lib/learning/feedback";
import {
  assistanceForHintCount,
  buildHintLadder,
  shapeCue,
} from "@/lib/learning/hints";
import { reinsertForRetry, type SessionStep } from "@/lib/learning/session-planner";
import type {
  AssistanceLevel,
  CueType,
  PhraseMastery,
  StepKind,
} from "@/lib/learning/types";
import { recordPhraseAttempt } from "@/lib/offline/progress";

/** Genuine recall effort before hints are offered prominently. */
const THINKING_WINDOW_MS = 4_000;
/** Past this, a correct answer counts as hesitant rather than automatic. */
const HESITATION_MS = 6_000;
/** Anticipation gap between the English cue and hearing the Spanish. */
const ANTICIPATION_MS = 2_400;

export interface AttemptInput {
  phraseId: string;
  outcome: EvaluationResult["outcome"];
  assistance: AssistanceLevel;
  cueType: CueType;
  stepKind: StepKind;
  hintCount: number;
  answerVisible: boolean;
  responseLatencyMs?: number;
  transcript?: string;
}

export interface SessionScreenProps {
  profileId?: string;
  /** Fixed for the lifetime of the screen; remount to start a new session. */
  steps: SessionStep[];
  baseline: ReadonlyMap<string, PhraseMastery>;
  onRecorded: (change: BandChange) => void;
  onComplete: () => void;
  header: React.ReactNode;
}

/**
 * Shared session mechanics for both the daily lesson and Practice, so there is
 * only ever one path that writes mastery.
 */
export function SessionScreen({
  profileId,
  steps: initialSteps,
  baseline,
  onRecorded,
  onComplete,
  header,
}: SessionScreenProps) {
  const [steps, setSteps] = useState(initialSteps);
  const [index, setIndex] = useState(0);
  const attemptCounts = useRef(new Map<string, number>());

  const record = useCallback(
    (input: AttemptInput) => {
      const attemptNumber = (attemptCounts.current.get(input.phraseId) ?? 0) + 1;
      attemptCounts.current.set(input.phraseId, attemptNumber);
      const phrase = phraseById.get(input.phraseId);
      if (!profileId || !phrase) return;
      const before = baseline.get(input.phraseId);
      void recordPhraseAttempt(profileId, {
        ...input,
        attemptNumber,
        timestamp: new Date().toISOString(),
      }).then(({ after }) => {
        onRecorded(describeBandChange(phrase, before, after));
      });
    },
    [baseline, onRecorded, profileId],
  );

  const failStep = useCallback(() => {
    setSteps((current) => reinsertForRetry(current, index));
  }, [index]);

  const advance = useCallback(() => {
    stopPlayback();
    if (index < steps.length - 1) setIndex(index + 1);
    else onComplete();
  }, [index, onComplete, steps.length]);

  const step = steps[index];
  const progress = steps.length
    ? Math.round(((index + 1) / steps.length) * 100)
    : 0;

  if (!step) return <div className="p-6">This session is empty.</div>;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-4 py-4">
      <header className="flex items-center gap-3">
        {header}
        <div
          className="bg-ink/10 h-2 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Session progress"
        >
          <div
            className="bg-agave h-full rounded-full transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm font-bold">
          {index + 1}/{steps.length}
        </span>
      </header>
      <StepView
        key={`${step.id}:${index}`}
        step={step}
        isLast={index === steps.length - 1}
        onAttempt={record}
        onFailure={failStep}
        onAdvance={advance}
      />
    </main>
  );
}

export function StepView({
  step,
  isLast,
  onAttempt,
  onFailure,
  onAdvance,
}: {
  step: SessionStep;
  isLast: boolean;
  onAttempt: (input: AttemptInput) => void;
  onFailure: () => void;
  onAdvance: () => void;
}) {
  if (step.kind === "scenario")
    return (
      <ScenarioStep
        step={step}
        isLast={isLast}
        onAttempt={onAttempt}
        onFailure={onFailure}
        onAdvance={onAdvance}
      />
    );
  const phrase = phraseById.get(step.phraseId);
  if (!phrase) return <div className="p-6">This phrase is unavailable.</div>;
  if (step.kind === "introduce")
    return (
      <IntroduceStep
        phrase={phrase}
        isLast={isLast}
        onAttempt={onAttempt}
        onAdvance={onAdvance}
      />
    );
  if (step.kind === "listen-understand")
    return (
      <ListenStep
        phrase={phrase}
        options={step.options ?? []}
        answer={step.answer ?? phrase.english}
        isLast={isLast}
        onAttempt={onAttempt}
        onAdvance={onAdvance}
      />
    );
  return (
    <RecallStep
      phrase={phrase}
      cueType={step.cueType}
      stepKind={step.kind}
      isLast={isLast}
      onAttempt={onAttempt}
      onFailure={onFailure}
      onAdvance={onAdvance}
    />
  );
}

function Shell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <>
      <section className="flex flex-1 flex-col justify-center py-6">
        {children}
      </section>
      <footer className="safe-bottom bg-canvas sticky bottom-0 pt-3">
        {footer}
      </footer>
    </>
  );
}

function ContinueButton({
  disabled,
  isLast,
  onClick,
}: {
  disabled: boolean;
  isLast: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tap-target bg-ink w-full rounded-2xl px-5 font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
    >
      {isLast ? "Finish" : "Continue"}
    </button>
  );
}

/**
 * Progressive disclosure: intent, then sound, then text. The learner meets the
 * phrase through the ear before the eye.
 */
function IntroduceStep({
  phrase,
  isLast,
  onAttempt,
  onAdvance,
}: {
  phrase: Phrase;
  isLast: boolean;
  onAttempt: (input: AttemptInput) => void;
  onAdvance: () => void;
}) {
  const [reveal, setReveal] = useState<0 | 1 | 2>(0);
  const [result, setResult] = useState<EvaluationResult>();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await speakEnglish(phrase.english);
      if (cancelled) return;
      await pause(ANTICIPATION_MS);
      if (cancelled) return;
      setReveal(1);
      await playPhraseAudio(phrase, "normal");
      if (cancelled) return;
      setReveal(2);
    })();
    return () => {
      cancelled = true;
      stopPlayback();
    };
  }, [phrase]);

  const feedback = result
    ? stepFeedback(result, phrase, "repeat-only")
    : undefined;

  return (
    <Shell
      footer={
        <ContinueButton
          disabled={reveal < 2}
          isLast={isLast}
          onClick={onAdvance}
        />
      }
    >
      <p className="text-agave text-xs font-black tracking-[.18em]">NEW PHRASE</p>
      <h1 className="mt-4 text-3xl leading-tight font-black">
        {phrase.english}
      </h1>
      <p className="text-ink/70 mt-3 rounded-2xl bg-white p-4 text-sm leading-relaxed">
        {phrase.context}
      </p>

      <div className="mt-6 min-h-[8.5rem]" aria-live="polite">
        {reveal === 0 && (
          <p className="text-ink/55 flex items-center gap-2 text-lg">
            <Ear size={22} /> Listen — how might this sound in Spanish?
          </p>
        )}
        {reveal === 1 && (
          <p className="text-ink/70 flex items-center gap-2 text-lg font-bold">
            <Headphones size={22} /> Listening…
          </p>
        )}
        {reveal === 2 && (
          <div>
            <p className="text-4xl leading-tight font-black">{phrase.esMX}</p>
            <p className="text-ink/55 mt-2 text-sm">{phrase.pronunciationAid}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <AudioButton phrase={phrase} speed="normal" />
              <AudioButton phrase={phrase} speed="slow" />
            </div>
          </div>
        )}
      </div>

      {reveal === 2 && (
        <div className="border-ink/10 mt-6 border-t pt-6">
          <p className="mb-3 text-center font-black">Say it once to lock it in</p>
          <p className="text-ink/55 mb-4 text-center text-xs">
            This is pronunciation practice — you will be asked to recall it
            without the text shortly.
          </p>
          <MicRecorder
            phrase={phrase}
            label="Tap to repeat"
            onResult={(value) => {
              setResult(value);
              onAttempt({
                phraseId: phrase.id,
                outcome: value.outcome,
                assistance: "repeat-only",
                cueType: "english",
                stepKind: "introduce",
                hintCount: 0,
                answerVisible: true,
                transcript: value.transcript,
              });
            }}
          />
          {feedback && result && (
            <FeedbackPanel feedback={feedback} result={result} />
          )}
        </div>
      )}
    </Shell>
  );
}

/**
 * Retrieval before reveal. The Spanish is never on screen while the learner is
 * trying to produce it.
 */
function RecallStep({
  phrase,
  cueType,
  stepKind,
  isLast,
  onAttempt,
  onFailure,
  onAdvance,
  situation,
}: {
  phrase: Phrase;
  cueType: CueType;
  stepKind: StepKind;
  isLast: boolean;
  onAttempt: (input: AttemptInput) => void;
  onFailure: () => void;
  onAdvance: () => void;
  situation?: string;
}) {
  const [hintLevel, setHintLevel] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<EvaluationResult>();
  const [thinkingOver, setThinkingOver] = useState(false);
  const [assistance, setAssistance] = useState<AssistanceLevel>();
  const cueReadyAt = useRef(0);
  const spokeAt = useRef<number | undefined>(undefined);
  const ladder = useMemo(() => buildHintLadder(phrase), [phrase]);
  const cue = useMemo(
    () => presentCue(phrase, cueType, stepKind),
    [phrase, cueType, stepKind],
  );

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    void (async () => {
      if (cue.spokenEnglish) await speakEnglish(cue.spokenEnglish);
      else if (cue.playsSpanish) await playPhraseAudio(phrase, "normal");
      if (cancelled) return;
      cueReadyAt.current = Date.now();
      timers.push(
        window.setTimeout(() => setThinkingOver(true), THINKING_WINDOW_MS),
      );
    })();
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      stopPlayback();
    };
  }, [cue, phrase]);

  const answerVisible = revealed || Boolean(result);

  const handleResult = (value: EvaluationResult) => {
    const latency = spokeAt.current
      ? spokeAt.current - cueReadyAt.current
      : undefined;
    const level = assistanceForHintCount(
      hintLevel,
      revealed,
      false,
      latency !== undefined && latency > HESITATION_MS,
    );
    setAssistance(level);
    setResult(value);
    onAttempt({
      phraseId: phrase.id,
      outcome: value.outcome,
      assistance: level,
      cueType,
      stepKind,
      hintCount: hintLevel,
      answerVisible: revealed,
      responseLatencyMs: latency,
      transcript: value.transcript,
    });
    if (value.outcome === "meaning-error" || value.outcome === "incomplete")
      onFailure();
  };

  const handleReveal = () => {
    setRevealed(true);
    setAssistance("revealed");
    onAttempt({
      phraseId: phrase.id,
      outcome: "incomplete",
      assistance: "revealed",
      cueType,
      stepKind,
      hintCount: hintLevel,
      answerVisible: true,
    });
    onFailure();
  };

  const feedback = result
    ? stepFeedback(result, phrase, assistance ?? "none")
    : undefined;

  return (
    <Shell
      footer={
        <ContinueButton
          disabled={!result && !revealed}
          isLast={isLast}
          onClick={onAdvance}
        />
      }
    >
      <p className="text-sky text-xs font-black tracking-[.18em]">
        {stepKind === "scenario" ? "IN THE MOMENT" : "SAY IT FROM MEMORY"}
      </p>
      {situation && (
        <p className="text-ink/70 mt-3 rounded-2xl bg-white p-4 text-sm leading-relaxed">
          {situation}
        </p>
      )}
      <h1 className="mt-4 text-3xl leading-tight font-black">{cue.prompt}</h1>
      {cue.detail && <p className="text-ink/65 mt-2 text-lg">{cue.detail}</p>}
      {cue.spokenEnglish && (
        <button
          type="button"
          onClick={() => void speakEnglish(phrase.english)}
          className="tap-target border-ink/15 mt-4 inline-flex items-center gap-2 self-start rounded-xl border bg-white px-4 font-bold"
          aria-label="Hear the English cue again"
        >
          <Headphones size={18} /> Hear it again
        </button>
      )}

      <div className="mt-6 min-h-[6rem]" aria-live="polite">
        {answerVisible ? (
          <div className="card p-5">
            <p className="text-3xl font-black" data-spanish-answer>
              {phrase.esMX}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <AudioButton phrase={phrase} speed="normal" />
              <AudioButton phrase={phrase} speed="slow" />
            </div>
          </div>
        ) : hintLevel > 0 ? (
          <div className="bg-marigold/20 rounded-2xl p-4" data-hint>
            <p className="text-2xl font-black" data-hint-text>
              {ladder[hintLevel - 1]!.text}
            </p>
            <p className="text-ink/65 mt-1 text-sm">
              {ladder[hintLevel - 1]!.support}
            </p>
          </div>
        ) : (
          <p className="text-ink/45 text-sm">
            {thinkingOver
              ? `${shapeCue(phrase)} Pull it from memory, then speak.`
              : "Think for a moment…"}
          </p>
        )}
      </div>

      {!result && (
        <div className="mt-5">
          <MicRecorder
            phrase={phrase}
            label="Tap to speak"
            onStart={() => {
              spokeAt.current = Date.now();
            }}
            onResult={handleResult}
          />
        </div>
      )}

      {!answerVisible && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {hintLevel < ladder.length && (
            <button
              type="button"
              onClick={() => setHintLevel(hintLevel + 1)}
              className={`tap-target inline-flex items-center gap-2 rounded-xl border-2 px-4 font-bold transition-opacity ${
                thinkingOver || hintLevel > 0
                  ? "border-ink/25 opacity-100"
                  : "border-ink/10 opacity-60"
              }`}
            >
              <Lightbulb size={18} />
              {hintLevel === 0 ? "Give me a hint" : "More of the phrase"}
            </button>
          )}
          <button
            type="button"
            onClick={handleReveal}
            className="tap-target text-ink/55 rounded-xl px-4 font-bold underline"
          >
            Show the answer
          </button>
        </div>
      )}

      {feedback && result && (
        <FeedbackPanel feedback={feedback} result={result} />
      )}
    </Shell>
  );
}

function ListenStep({
  phrase,
  options,
  answer,
  isLast,
  onAttempt,
  onAdvance,
}: {
  phrase: Phrase;
  options: string[];
  answer: string;
  isLast: boolean;
  onAttempt: (input: AttemptInput) => void;
  onAdvance: () => void;
}) {
  const [choice, setChoice] = useState<string>();
  const [misses, setMisses] = useState(0);
  const correct = choice === answer;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) await playPhraseAudio(phrase, "normal");
    })();
    return () => {
      cancelled = true;
      stopPlayback();
    };
  }, [phrase]);

  const choose = (option: string) => {
    setChoice(option);
    if (option === answer)
      onAttempt({
        phraseId: phrase.id,
        outcome: "understood",
        // Needing another go is recorded as assistance, not as a wrong answer.
        assistance: misses === 0 ? "none" : "hint-1",
        cueType: "spanish-audio",
        stepKind: "listen-understand",
        hintCount: misses,
        answerVisible: false,
      });
    else setMisses((value) => value + 1);
  };

  return (
    <Shell
      footer={
        <ContinueButton disabled={!correct} isLast={isLast} onClick={onAdvance} />
      }
    >
      <p className="text-sky text-xs font-black tracking-[.18em]">
        LISTEN &amp; UNDERSTAND
      </p>
      <h1 className="mt-3 text-3xl font-black">What did you hear?</h1>
      <div className="mt-5 flex flex-wrap gap-3">
        <AudioButton phrase={phrase} speed="normal" />
        <AudioButton phrase={phrase} speed="slow" />
      </div>
      <div className="mt-6 grid gap-3">
        {options.map((option) => {
          const chosen = choice === option;
          const state = chosen
            ? option === answer
              ? "border-agave bg-agave/10"
              : "border-coral bg-coral/10"
            : "border-ink/15 bg-white";
          return (
            <button
              type="button"
              key={option}
              onClick={() => choose(option)}
              aria-pressed={chosen}
              className={`tap-target rounded-2xl border-2 p-4 text-left font-bold ${state}`}
            >
              {option}
            </button>
          );
        })}
      </div>
      <div className="mt-4 min-h-[3rem]" aria-live="polite">
        {choice && !correct && (
          <p className="bg-coral/10 rounded-xl p-3 text-sm">
            Not that one. Play it again and listen for the shape of the word.
          </p>
        )}
        {correct && (
          <p className="bg-agave/10 rounded-xl p-3 text-sm">
            Yes — that is what was said.
          </p>
        )}
      </div>
    </Shell>
  );
}

/**
 * The situation only. Candidate phrases are never listed, or there is nothing
 * to retrieve.
 */
function ScenarioStep({
  step,
  isLast,
  onAttempt,
  onFailure,
  onAdvance,
}: {
  step: Extract<SessionStep, { kind: "scenario" }>;
  isLast: boolean;
  onAttempt: (input: AttemptInput) => void;
  onFailure: () => void;
  onAdvance: () => void;
}) {
  const phrases = step.phraseIds
    .map((id) => phraseById.get(id))
    .filter((phrase): phrase is Phrase => Boolean(phrase));
  const [turn, setTurn] = useState(0);
  const phrase = phrases[turn];

  if (!phrase)
    return (
      <Shell
        footer={
          <ContinueButton disabled={false} isLast={isLast} onClick={onAdvance} />
        }
      >
        <MessageCircle className="text-coral" size={36} />
        <h1 className="mt-4 text-3xl font-black">Travel moment</h1>
        <p className="card mt-5 p-5 text-lg leading-relaxed">{step.prompt}</p>
      </Shell>
    );

  return (
    <RecallStep
      key={phrase.id}
      phrase={phrase}
      cueType="situation"
      stepKind="scenario"
      situation={step.prompt}
      isLast={isLast && turn === phrases.length - 1}
      onAttempt={onAttempt}
      onFailure={onFailure}
      onAdvance={() => {
        if (turn < phrases.length - 1) setTurn(turn + 1);
        else onAdvance();
      }}
    />
  );
}

function FeedbackPanel({
  feedback,
  result,
}: {
  feedback: StepFeedback;
  result: EvaluationResult;
}) {
  const tone = {
    success: "bg-agave/10",
    partial: "bg-marigold/20",
    rebuild: "bg-coral/10",
    neutral: "bg-sky/10",
  }[feedback.tone];
  return (
    <div
      className={`mt-6 rounded-2xl p-4 ${tone}`}
      role="status"
      data-speech-feedback
    >
      <p className="font-black">{feedback.headline}</p>
      <p className="mt-1 text-sm">{feedback.detail}</p>
      {result.transcript && (
        <p className="text-ink/65 mt-2 text-sm">
          The service heard: “{result.transcript}”
        </p>
      )}
    </div>
  );
}
