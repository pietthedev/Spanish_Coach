"use client";

import { Mic, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Phrase } from "@/content/schema";
import type { EvaluationResult } from "@/lib/evaluation/evaluate";

type State = "idle" | "listening" | "processing" | "done" | "failure";

export function MicRecorder({
  phrase,
  onResult,
}: {
  phrase: Phrase;
  onResult: (result: EvaluationResult) => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string>();
  const recorder = useRef<MediaRecorder | undefined>(undefined);
  const stream = useRef<MediaStream | undefined>(undefined);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const cleanup = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = undefined;
    if (timer.current) window.clearInterval(timer.current);
  };
  useEffect(() => cleanup, []);
  const start = async () => {
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
      mediaRecorder.onstop = () =>
        void processRecording(mediaRecorder.mimeType || "audio/webm");
      mediaRecorder.start(250);
      setSeconds(0);
      setState("listening");
      timer.current = window.setInterval(
        () => setSeconds((value) => value + 1),
        1000,
      );
      window.setTimeout(() => {
        if (mediaRecorder.state === "recording") mediaRecorder.stop();
      }, 10_000);
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
    if (recorder.current?.state === "recording") recorder.current.stop();
  };
  const cancel = () => {
    recorder.current?.stop();
    cleanup();
    chunks.current = [];
    setState("idle");
  };
  const technical = (message: string) => {
    cleanup();
    setState("failure");
    onResult({
      outcome: "technical-failure",
      label: "The microphone did not catch that",
      message,
      transcript: "",
    });
  };
  const processRecording = async (mimeType: string) => {
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
    try {
      const data = new FormData();
      data.set(
        "audio",
        blob,
        `speech.${mimeType.includes("webm") ? "webm" : "m4a"}`,
      );
      data.set("phraseId", phrase.id);
      data.set("durationMs", String(seconds * 1000));
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      const response = await fetch("/api/speech/transcribe", {
        method: "POST",
        body: data,
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const result = (await response.json()) as EvaluationResult & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          result.error || "Speech feedback is temporarily unavailable.",
        );
      setState("done");
      onResult(result);
    } catch (error) {
      technical(
        error instanceof DOMException && error.name === "AbortError"
          ? "Speech feedback took too long. Try again or continue."
          : "Speech feedback is temporarily unavailable. Your learning progress is not affected.",
      );
    }
  };
  return (
    <div className="text-center">
      <p className="text-ink/65 mb-3 text-sm">
        Your recording is sent to ElevenLabs only when online. Rumbo does not
        save raw voice recordings.
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
          <span className="w-12 font-mono" aria-live="polite">
            0:{String(seconds).padStart(2, "0")}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          disabled={state === "processing"}
          className="tap-target bg-agave mx-auto flex h-20 min-w-48 items-center justify-center gap-3 rounded-full px-6 font-black text-white disabled:opacity-60"
          aria-label="Tap to speak"
        >
          <Mic />
          {state === "processing" ? "Checking…" : "Tap to speak"}
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
