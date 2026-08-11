"use client";

import { Gauge, Volume2 } from "lucide-react";
import { useState } from "react";
import type { Phrase } from "@/content/schema";

export function AudioButton({
  phrase,
  speed,
}: {
  phrase: Phrase;
  speed: "normal" | "slow";
}) {
  const [fallback, setFallback] = useState(false);
  const [playing, setPlaying] = useState(false);
  const play = async () => {
    setPlaying(true);
    const asset = phrase.audio[speed];
    try {
      const audio = new Audio(asset.src);
      audio.playbackRate = 1;
      audio.addEventListener("ended", () => setPlaying(false), { once: true });
      audio.addEventListener(
        "error",
        () => {
          setFallback(true);
          speak();
        },
        { once: true },
      );
      await audio.play();
    } catch {
      setFallback(true);
      speak();
    }
  };
  const speak = () => {
    if (!("speechSynthesis" in window)) {
      setPlaying(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(
      phrase.esMX.replace("…", ""),
    );
    utterance.lang = "es-MX";
    utterance.rate = speed === "slow" ? 0.72 : 0.92;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };
  return (
    <div>
      <button
        type="button"
        onClick={() => void play()}
        className="tap-target border-ink/15 inline-flex items-center gap-2 rounded-xl border bg-white px-4 font-bold"
        aria-label={`Play ${phrase.esMX} at ${speed} speed`}
      >
        {speed === "slow" ? <Gauge size={20} /> : <Volume2 size={20} />}
        {playing ? "Playing…" : speed === "slow" ? "Slow" : "Normal"}
      </button>
      {(fallback || !phrase.audio[speed].productionReady) && (
        <p className="text-ink/55 mt-1 text-[11px]">
          Device-voice preview · approved audio required for production
        </p>
      )}
    </div>
  );
}
