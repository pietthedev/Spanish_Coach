export interface ListenOptions {
  /** How long to wait for the learner to start speaking at all. */
  waitForSpeechMs?: number;
  /** Hard cap once speech begins. The transcribe API rejects over 6s. */
  maxSpeechMs?: number;
  /** Trailing silence that ends the turn. */
  endOfSpeechMs?: number;
  onSpeechStart?: () => void;
}

export type ListenResult =
  | { status: "speech"; blob: Blob; mimeType: string; durationMs: number; startedAt: number }
  | { status: "silence" }
  | { status: "cancelled" }
  | { status: "technical"; error: string };

const DEFAULTS = {
  waitForSpeechMs: 9_000,
  maxSpeechMs: 5_000,
  endOfSpeechMs: 900,
};

/** Frames above the noise floor before we believe speech has started. */
const ONSET_FRAMES = 3;
const FRAME_MS = 50;
const BASELINE_FRAMES = 8;
const MIN_THRESHOLD = 0.015;

type AudioContextConstructor = new () => AudioContext;

function audioContextCtor(): AudioContextConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const scope = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

/**
 * Hands-free capture: holds the microphone open listening for speech onset,
 * records only the utterance itself, and closes as soon as the learner stops.
 * The microphone is never left running between activities.
 */
export class SpeechListener {
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private context?: AudioContext;
  private frameTimer?: number;
  private cancelled = false;

  async listen(options: ListenOptions = {}): Promise<ListenResult> {
    const config = { ...DEFAULTS, ...options };
    this.cancelled = false;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    )
      return { status: "technical", error: "This browser cannot record audio." };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      return {
        status: "technical",
        error:
          name === "NotAllowedError"
            ? "Microphone permission is off."
            : "The microphone is unavailable.",
      };
    }

    try {
      return await this.capture(config);
    } catch {
      return { status: "technical", error: "Recording failed." };
    } finally {
      this.teardown();
    }
  }

  private capture(config: Required<Omit<ListenOptions, "onSpeechStart">> & ListenOptions): Promise<ListenResult> {
    return new Promise<ListenResult>((resolve) => {
      const Ctor = audioContextCtor();
      const stream = this.stream!;
      const chunks: Blob[] = [];
      let analyser: AnalyserNode | undefined;
      let buffer: Float32Array | undefined;

      if (Ctor) {
        try {
          this.context = new Ctor();
          const source = this.context.createMediaStreamSource(stream);
          analyser = this.context.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);
          buffer = new Float32Array(analyser.fftSize);
        } catch {
          analyser = undefined;
        }
      }

      const preferred = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";
      const recorder = new MediaRecorder(
        stream,
        preferred ? { mimeType: preferred } : undefined,
      );
      this.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };

      let startedAt = 0;
      let settled = false;
      const finish = (outcome: ListenResult) => {
        if (settled) return;
        settled = true;
        if (this.frameTimer) window.clearInterval(this.frameTimer);
        resolve(outcome);
      };

      recorder.onstop = () => {
        if (this.cancelled) return finish({ status: "cancelled" });
        const durationMs = Math.min(Date.now() - startedAt, config.maxSpeechMs);
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 800)
          return finish({ status: "technical", error: "The recording was too quiet." });
        finish({
          status: "speech",
          blob,
          mimeType: recorder.mimeType || "audio/webm",
          durationMs,
          startedAt,
        });
      };

      let frames = 0;
      let loud = 0;
      let quietMs = 0;
      let baseline = 0;
      let speaking = false;
      const openedAt = Date.now();

      const stopRecorder = () => {
        if (recorder.state === "recording") recorder.stop();
      };

      this.frameTimer = window.setInterval(() => {
        if (this.cancelled) {
          stopRecorder();
          return finish({ status: "cancelled" });
        }
        const level = analyser && buffer ? rms(analyser, buffer) : undefined;
        frames += 1;

        // Learn the cabin noise floor before deciding what counts as speech.
        if (level !== undefined && frames <= BASELINE_FRAMES) {
          baseline = Math.max(baseline, level);
          return;
        }
        const threshold = Math.max(MIN_THRESHOLD, baseline * 2.5);

        if (!speaking) {
          if (level === undefined) {
            // No analyser: fall back to recording the whole window.
            speaking = true;
            startedAt = Date.now();
            recorder.start(250);
            config.onSpeechStart?.();
            return;
          }
          if (level > threshold) loud += 1;
          else loud = 0;
          if (loud >= ONSET_FRAMES) {
            speaking = true;
            startedAt = Date.now();
            recorder.start(250);
            config.onSpeechStart?.();
          } else if (Date.now() - openedAt > config.waitForSpeechMs) {
            return finish({ status: "silence" });
          }
          return;
        }

        const elapsed = Date.now() - startedAt;
        if (elapsed >= config.maxSpeechMs) return stopRecorder();
        if (level !== undefined && level <= threshold) {
          quietMs += FRAME_MS;
          if (quietMs >= config.endOfSpeechMs) stopRecorder();
        } else quietMs = 0;
      }, FRAME_MS);
    });
  }

  cancel(): void {
    this.cancelled = true;
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.teardown();
  }

  private teardown(): void {
    if (this.frameTimer) window.clearInterval(this.frameTimer);
    this.frameTimer = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    void this.context?.close().catch(() => undefined);
    this.context = undefined;
    this.recorder = undefined;
  }
}

function rms(analyser: AnalyserNode, buffer: Float32Array): number {
  analyser.getFloatTimeDomainData(buffer as Float32Array<ArrayBuffer>);
  let sum = 0;
  for (const sample of buffer) sum += sample * sample;
  return Math.sqrt(sum / buffer.length);
}
