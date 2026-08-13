import type { EvaluationResult } from "@/lib/evaluation/evaluate";

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Single client-side path to the speech endpoint, so the request contract
 * lives in one place for both guided lessons and Drive Mode.
 */
export async function transcribeAttempt({
  blob,
  mimeType,
  phraseIds,
  durationMs,
}: {
  blob: Blob;
  mimeType: string;
  phraseIds: string[];
  durationMs: number;
}): Promise<EvaluationResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return technical(
      "You are offline, so spoken feedback is unavailable. Your progress is not affected.",
    );

  const data = new FormData();
  data.set("audio", blob, `speech.${mimeType.includes("webm") ? "webm" : "m4a"}`);
  for (const phraseId of phraseIds) data.append("phraseId", phraseId);
  data.set("durationMs", String(durationMs));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("/api/speech/transcribe", {
      method: "POST",
      body: data,
      signal: controller.signal,
    });
    const result = (await response.json()) as EvaluationResult & { error?: string };
    if (!response.ok)
      throw new Error(result.error || "Speech feedback is temporarily unavailable.");
    return result;
  } catch (error) {
    return technical(
      error instanceof DOMException && error.name === "AbortError"
        ? "Speech feedback took too long."
        : "Speech feedback is temporarily unavailable. Your progress is not affected.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function technical(message: string): EvaluationResult {
  return {
    outcome: "technical-failure",
    label: "That did not reach the microphone",
    message,
    transcript: "",
  };
}
