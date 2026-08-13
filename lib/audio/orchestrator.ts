import { phraseById } from "@/content/course";
import type { NarrationStep } from "@/lib/drive/narration";
import type { FeedbackTone } from "@/lib/drive/types";
import { normalizeAnswer } from "@/lib/evaluation/normalize";
import {
  pause,
  playPhraseAudio,
  speakEnglish,
  speakSpanish,
  stopPlayback,
} from "./playback";
import { playTone, unlockTones } from "./tones";

/**
 * Serialises every sound Drive Mode makes. Only one caller owns the audio
 * output at a time, and a sequence always reports when it has truly finished
 * so the microphone is never opened over the top of a prompt.
 */
export class AudioOrchestrator {
  /** Bumped on every new sequence; stale sequences abandon themselves. */
  private generation = 0;
  private byText?: Map<string, string>;

  async unlock(): Promise<void> {
    await unlockTones();
  }

  /** Cancels whatever is playing and silences the output. */
  stop(): void {
    this.generation += 1;
    stopPlayback();
  }

  /**
   * Plays a narration sequence to completion. Resolves true if it finished,
   * false if a newer sequence superseded it.
   */
  async play(steps: NarrationStep[]): Promise<boolean> {
    this.generation += 1;
    const mine = this.generation;
    stopPlayback();

    for (const step of steps) {
      if (mine !== this.generation) return false;
      await this.playStep(step);
    }
    return mine === this.generation;
  }

  async tone(tone: FeedbackTone): Promise<void> {
    await playTone(tone);
  }

  private async playStep(step: NarrationStep): Promise<void> {
    switch (step.kind) {
      case "speak":
        await speakEnglish(step.text);
        return;
      case "phrase": {
        const phrase = phraseById.get(step.phraseId);
        if (phrase) await playPhraseAudio(phrase, step.speed);
        return;
      }
      case "line":
        await this.playSpanishLine(step.esMX);
        return;
      case "wait":
        await pause(step.ms);
        return;
    }
  }

  /**
   * Prefers the recorded voice when the line happens to be a course phrase,
   * because approved audio is the authority on pronunciation.
   */
  private async playSpanishLine(esMX: string): Promise<void> {
    this.byText ??= new Map(
      [...phraseById.values()].map((phrase) => [
        normalizeAnswer(phrase.esMX),
        phrase.id,
      ]),
    );
    const phraseId = this.byText.get(normalizeAnswer(esMX));
    const phrase = phraseId ? phraseById.get(phraseId) : undefined;
    if (phrase) await playPhraseAudio(phrase, "normal");
    else await speakSpanish(esMX);
  }
}
