import { NextResponse } from "next/server";
import { phraseById } from "@/content/course";
import type { Phrase } from "@/content/schema";
import {
  evaluateAnswer,
  type EvaluationResult,
} from "@/lib/evaluation/evaluate";
import { getServerEnv } from "@/lib/env";
import { isTrustedSpeechOrigin } from "@/lib/speech/origin";
import { checkRateLimit } from "@/lib/speech/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const allowedMime = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-m4a",
]);

export async function POST(request: Request) {
  const env = getServerEnv();
  if (
    !isTrustedSpeechOrigin(
      request.headers.get("origin"),
      env.NEXT_PUBLIC_APP_URL,
      process.env.NODE_ENV === "production",
    )
  )
    return safeError("Speech requests must come from Rumbo.", 403);
  const supabase = await createClient();
  let userId = "demo";
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return safeError("Authentication required.", 401);
    userId = user.id;
  }
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkRateLimit(`${userId}:${ip}`, env.SPEECH_RATE_LIMIT_PER_MINUTE))
    return safeError(
      "Too many speech attempts. Wait a moment and try again.",
      429,
    );
  const form = await request.formData().catch(() => null);
  if (!form) return safeError("Invalid recording upload.", 400);
  const audio = form.get("audio");
  const phraseIds = form.getAll("phraseId");
  const durationMs = Number(form.get("durationMs"));
  if (
    !(audio instanceof File) ||
    phraseIds.length < 1 ||
    phraseIds.length > 6 ||
    phraseIds.some((id) => typeof id !== "string")
  )
    return safeError("Recording and phrase are required.", 400);
  const mime = audio.type.toLocaleLowerCase();
  if (
    !allowedMime.has(mime) ||
    audio.size > env.SPEECH_MAX_BYTES ||
    audio.size < 100
  )
    return safeError("Unsupported or invalid recording.", 413);
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 6_000)
    return safeError("Recording duration must be 5 seconds or less.", 400);
  const targetPhrases = phraseIds.map((id) => phraseById.get(String(id)));
  if (targetPhrases.some((phrase) => !phrase))
    return safeError("Unknown course phrase.", 400);
  const phrases = targetPhrases as Phrase[];

  if (env.VOICE_FEATURE_MODE === "fixture") {
    if (process.env.NODE_ENV === "production")
      return safeError("Speech transcription is not configured.", 503);
    const fixture = request.headers.get("x-rumbo-fixture-transcript");
    if (!fixture)
      return safeError(
        "Development speech fixture is active; configure ElevenLabs for live feedback.",
        503,
      );
    return NextResponse.json(evaluateBestAnswer(fixture, phrases), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!env.ELEVENLABS_API_KEY)
    return safeError("Speech transcription is not configured.", 503);
  const upstreamForm = new FormData();
  upstreamForm.set("file", audio, "speech-upload");
  upstreamForm.set("model_id", env.ELEVENLABS_STT_MODEL_ID);
  upstreamForm.set("language_code", "es");
  upstreamForm.set("tag_audio_events", "false");
  upstreamForm.set("diarize", "false");
  upstreamForm.set("timestamps_granularity", "none");
  const keyterms = [
    ...new Set(
      phrases
        .flatMap((phrase) => phrase.acceptedAnswers)
        .flatMap((answer) => answer.replace(/[¿?¡!.,]/g, "").split(/\s+/))
        .filter((word) => word.length > 3),
    ),
  ].slice(0, 20);
  keyterms.forEach((term) => upstreamForm.append("keyterms", term));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(
      "https://api.elevenlabs.io/v1/speech-to-text",
      {
        method: "POST",
        headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
        body: upstreamForm,
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (!response.ok)
      return safeError(
        response.status === 429
          ? "Speech service is busy. Try again shortly."
          : "Speech feedback is temporarily unavailable.",
        response.status === 429 ? 429 : 502,
      );
    const result = (await response.json()) as { text?: unknown };
    if (typeof result.text !== "string")
      return safeError("Speech feedback returned an invalid response.", 502);
    return NextResponse.json(evaluateBestAnswer(result.text, phrases), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return safeError(
      "Speech feedback timed out. Try again or continue without scoring.",
      504,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function evaluateBestAnswer(transcript: string, phrases: Phrase[]) {
  const scores: Record<EvaluationResult["outcome"], number> = {
    understood: 5,
    "different-valid": 4,
    "minor-issue": 3,
    incomplete: 2,
    "meaning-error": 1,
    "technical-failure": 0,
  };
  return phrases
    .map((phrase) => evaluateAnswer(transcript, phrase))
    .sort((a, b) => scores[b.outcome] - scores[a.outcome])[0]!;
}

function safeError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
