import type { Phrase } from "@/content/schema";

/** Speech synthesis can hang silently; never let it stall a lesson. */
const SPEECH_TIMEOUT_MS = 6_000;

let current: HTMLAudioElement | undefined;

export function stopPlayback() {
  current?.pause();
  current = undefined;
  if (typeof window !== "undefined" && "speechSynthesis" in window)
    window.speechSynthesis.cancel();
}

/**
 * Every playback path resolves rather than throws. Audio is a teaching aid, so
 * a missing asset or a blocked autoplay must not break the session.
 */
export async function playPhraseAudio(
  phrase: Phrase,
  speed: "normal" | "slow" = "normal",
): Promise<void> {
  stopPlayback();
  const asset = phrase.audio[speed];
  try {
    const audio = new Audio(asset.src);
    current = audio;
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener("ended", () => resolve(), { once: true });
      audio.addEventListener("error", () => reject(new Error("asset")), {
        once: true,
      });
      audio.play().catch(reject);
    });
  } catch {
    await speak(phrase.esMX.replaceAll("…", ""), "es-MX", speed === "slow" ? 0.72 : 0.92);
  }
}

export function speakEnglish(text: string): Promise<void> {
  return speak(text, "en-US", 0.95);
}

function speak(text: string, lang: string, rate: number): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window))
    return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, SPEECH_TIMEOUT_MS);
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      finish();
    }
  });
}

export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
