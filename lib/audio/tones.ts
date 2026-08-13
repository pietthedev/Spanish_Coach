import type { FeedbackTone } from "@/lib/drive/types";

/**
 * Feedback sounds are synthesised rather than shipped as files: nothing to
 * download, nothing to cache, and they work offline from the first drive.
 */
interface ToneSpec {
  /** Frequency sweep in Hz. */
  from: number;
  to: number;
  durationMs: number;
  /** Peak gain. Kept below speech so nothing startles a driver. */
  gain: number;
  type: OscillatorType;
  /** Repeats make the technical tone recognisably different, not louder. */
  repeats?: number;
}

const TONES: Record<FeedbackTone, ToneSpec> = {
  // Bright, short, and over quickly so the next prompt follows immediately.
  correct: { from: 880, to: 1320, durationMs: 130, gain: 0.16, type: "sine" },
  // Same family as correct but flatter: understood, with a small wobble.
  acceptable: { from: 740, to: 740, durationMs: 150, gain: 0.13, type: "sine" },
  // Low and soft. This must read as "let's go again", never as a buzzer.
  retry: { from: 260, to: 200, durationMs: 300, gain: 0.15, type: "sine" },
  // Two flat blips: clearly mechanical, clearly not a judgement.
  technical: {
    from: 440,
    to: 440,
    durationMs: 90,
    gain: 0.11,
    type: "triangle",
    repeats: 2,
  },
};

type AudioContextConstructor = new () => AudioContext;

let context: AudioContext | undefined;

function audioContextCtor(): AudioContextConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const scope = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

export function toneSupported(): boolean {
  return audioContextCtor() !== undefined;
}

/**
 * Must be called from a user gesture. Mobile browsers create the context in a
 * suspended state otherwise and the first tone is silently dropped.
 */
export async function unlockTones(): Promise<void> {
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  try {
    context ??= new Ctor();
    if (context.state === "suspended") await context.resume();
  } catch {
    context = undefined;
  }
}

export async function playTone(tone: FeedbackTone): Promise<void> {
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  try {
    context ??= new Ctor();
    if (context.state === "suspended") await context.resume();
  } catch {
    return;
  }
  const spec = TONES[tone];
  const repeats = spec.repeats ?? 1;
  const gapMs = 70;
  const active = context;

  for (let index = 0; index < repeats; index += 1) {
    const startAt = active.currentTime + (index * (spec.durationMs + gapMs)) / 1000;
    const endAt = startAt + spec.durationMs / 1000;
    try {
      const oscillator = active.createOscillator();
      const gain = active.createGain();
      oscillator.type = spec.type;
      oscillator.frequency.setValueAtTime(spec.from, startAt);
      if (spec.to !== spec.from)
        oscillator.frequency.exponentialRampToValueAtTime(spec.to, endAt);
      // Short fades stop the click that a hard start/stop produces.
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(spec.gain, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(gain).connect(active.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    } catch {
      return;
    }
  }

  const totalMs = repeats * spec.durationMs + (repeats - 1) * gapMs;
  await new Promise<void>((resolve) => setTimeout(resolve, totalMs + 40));
}

export function closeTones(): void {
  void context?.close().catch(() => undefined);
  context = undefined;
}
