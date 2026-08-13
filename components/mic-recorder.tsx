"use client";

import { Mic, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Phrase } from "@/content/schema";
import type { EvaluationResult } from "@/lib/evaluation/evaluate";
import { transcribeAttempt } from "@/lib/speech/transcribe-client";

type State = "idle" | "listening" | "processing" | "done" | "failure";

const MAX_RECORDING_SECONDS = 5;

export function MicRecorder({
  phrase,
  acceptedPhrases = [phrase],
  onResult,
  onStart,
  label = "Tap to speak",
}: {
  phrase: Phrase;
  acceptedPhrases?: Phrase[];
  onResult: (result: EvaluationResult) => void;
  onStart?: () => void;
  label?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string>();
  const recorder = useRef<MediaRecorder | undefined>(undefined);
  const stream = useRef<MediaStream | undefined>(undefined);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const cutoffTimer = useRef<number | undefined>(undefined);
  const startedAt = useRef<number | undefined>(undefined);
  const cancelled = useRef(false);
  const reportResult = (result: EvaluationResult) => {
    onResult(result);
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>("[data-speech-feedback]")
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      ),
    );
  };
  const cleanup = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = undefined;
    if (timer.current) window.clearInterval(timer.current);
    if (cutoffTimer.current) window.clearTimeout(cutoffTimer.current);
    timer.current = undefined;
    cutoffTimer.current = undefined;
  };
  useEffect(() => cleanup, []);
  const start = async () => {
    onStart?.();
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      technical(
        "This browser cannot record audio. You can continue without scoring.",
      );
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      stream.current = media;
      chunks.current = [];
      cancelled.current = false;
      const preferred = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";
      const mediaRecorder = new MediaRecorder(
        media,
        preferred ? { mimeType: preferred } : undefined,
      );
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      mediaRecorder.onstart = () => {
        startedAt.current = Date.now();
      };
      mediaRecorder.onstop = () => {
        if (cancelled.current) {
          cleanup();
          return;
        }
        void processRecording(
          mediaRecorder.mimeType || "audio/webm",
          startedAt.current
            ? Math.min(
                Date.now() - startedAt.current,
                MAX_RECORDING_SECONDS * 1000,
              )
            : 0,
        );
      };
      mediaRecorder.start(250);
      setSeconds(0);
      setState("listening");
      timer.current = window.setInterval(
        () =>
          setSeconds(
            Math.min(
              Math.floor(
                (Date.now() - (startedAt.current ?? Date.now())) / 1000,
              ),
              MAX_RECORDING_SECONDS,
            ),
          ),
        250,
      );
      cutoffTimer.current = window.setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          setSeconds(MAX_RECORDING_SECONDS);
          setState("processing");
          mediaRecorder.stop();
        }
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      technical(
        name === "NotAllowedError"
          ? "Microphone permission is off. Enable it in Chrome settings, retry, or continue without scoring."
          : "The microphone is unavailable or was interrupted. Try again when it is free.",
      );
    }
  };
  const stop = () => {
    if (recorder.current?.state === "recording") {
      setState("processing");
      recorder.current.stop();
    }
  };
  const cancel = () => {
    cancelled.current = true;
    recorder.current?.stop();
    cleanup();
    chunks.current = [];
    setState("idle");
  };
  const technical = (message: string) => {
    cleanup();
    setState("failure");
    reportResult({
      outcome: "technical-failure",
      label: "The microphone did not catch that",
      message,
      transcript: "",
    });
  };
  const processRecording = async (mimeType: string, durationMs: number) => {
    cleanup();
    const blob = new Blob(chunks.current, { type: mimeType });
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingUrl(URL.createObjectURL(blob));
    if (blob.size < 800) {
      technical(
        "The recording was silent or too short. Try speaking a little closer to the phone.",
      );
      return;
    }
    if (!navigator.onLine) {
      technical(
        "You are offline. Listen to your recording and self-check; online speech feedback is unavailable.",
      );
      return;
    }
    setState("processing");
    const result = await transcribeAttempt({
      blob,
      mimeType,
      phraseIds: acceptedPhrases.map((item) => item.id),
      durationMs,
    });
    if (result.outcome === "technical-failure") {
      technical(result.message);
      return;
    }
    setState("done");
    reportResult(result);
  };
  return (
    <div className="text-center">
      <p className="text-ink/65 mb-3 text-sm">
        Your recording is sent to ElevenLabs only when online. Rumbo does not
        save raw voice recordings. Recording stops automatically after 5
        seconds.
      </p>
      {state === "listening" ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={cancel}
            className="tap-target border-ink/20 grid place-items-center rounded-full border bg-white"
            aria-label="Cancel recording"
          >
            <X />
          </button>
          <button
            type="button"
            onClick={stop}
            className="tap-target mic-pulse bg-coral grid h-20 w-20 place-items-center rounded-full text-white"
            aria-label={`Stop recording, ${seconds} seconds`}
          >
            <Square fill="currentColor" />
          </button>
          <span className="w-24 font-mono" aria-live="polite">
            0:{String(seconds).padStart(2, "0")} / 0:05
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          disabled={state === "processing"}
          className="tap-target bg-agave mx-auto flex h-20 min-w-48 items-center justify-center gap-3 rounded-full px-6 font-black text-white disabled:opacity-60"
          aria-label={label}
        >
          <Mic />
          {state === "processing" ? "Checking…" : label}
        </button>
      )}
      {recordingUrl && (
        <audio
          className="mx-auto mt-4 w-full"
          controls
          src={recordingUrl}
          aria-label="Play back your recording"
        />
      )}
    </div>
  );
}
