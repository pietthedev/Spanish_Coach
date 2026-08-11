import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { course } from "../content/course.ts";

type Entry = {
  phraseId: string;
  text: string;
  speed: "normal" | "slow";
  voiceId: string;
  voiceSlot: string;
  modelId: string;
  contentVersion: string;
  contentHash: string;
  file: string;
  generatedAt: string;
};
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const apiKey = process.env.ELEVENLABS_API_KEY;
const voices = {
  primary: process.env.ELEVENLABS_VOICE_ID_PRIMARY,
  secondary: process.env.ELEVENLABS_VOICE_ID_SECONDARY,
};
const modelId = process.env.ELEVENLABS_TTS_MODEL_ID || "eleven_multilingual_v2";
const root = path.resolve("public/audio/generated");
const manifestPath = path.join(root, "manifest.json");

async function loadManifest(): Promise<Entry[]> {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8")) as Entry[];
  } catch {
    return [];
  }
}
async function retryFetch(
  url: string,
  init: RequestInit,
  attempts = 4,
): Promise<Response> {
  let last: Response | undefined;
  for (let i = 0; i < attempts; i += 1) {
    last = await fetch(url, init);
    if (last.ok) return last;
    if (![429, 500, 502, 503].includes(last.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** i));
  }
  throw new Error(
    `ElevenLabs generation failed with status ${last?.status ?? "network"}`,
  );
}

async function main() {
  if (!dryRun && (!apiKey || !voices.primary || !voices.secondary))
    throw new Error(
      "Set ELEVENLABS_API_KEY and both approved voice IDs, or run with --dry-run.",
    );
  await mkdir(root, { recursive: true });
  const existing = await loadManifest();
  const output: Entry[] = [...existing];
  for (const phrase of course.phrases)
    for (const speed of ["normal", "slow"] as const) {
      const voiceSlot = phrase.audio[speed].voiceSlot;
      const voiceId = voices[voiceSlot] || `<${voiceSlot}-voice-id>`;
      const contentHash = createHash("sha256")
        .update(
          JSON.stringify({
            text: phrase.esMX,
            speed,
            voiceId,
            modelId,
            version: course.version,
          }),
        )
        .digest("hex");
      const file = `${phrase.id.replaceAll(".", "-")}.${speed}.mp3`;
      const previous = existing.find(
        (entry) => entry.phraseId === phrase.id && entry.speed === speed,
      );
      if (previous?.contentHash === contentHash) {
        process.stdout.write(`skip ${file}\n`);
        continue;
      }
      process.stdout.write(
        `${dryRun ? "would generate" : "generate"} ${file} with ${voiceSlot} voice\n`,
      );
      if (dryRun) continue;
      const response = await retryFetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey!,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            text: phrase.esMX.replace("…", ""),
            model_id: modelId,
            voice_settings: {
              stability: 0.55,
              similarity_boost: 0.75,
              style: 0,
              use_speaker_boost: true,
              speed: speed === "slow" ? 0.75 : 1,
            },
          }),
        },
      );
      await writeFile(
        path.join(root, file),
        Buffer.from(await response.arrayBuffer()),
      );
      const entry: Entry = {
        phraseId: phrase.id,
        text: phrase.esMX,
        speed,
        voiceId,
        voiceSlot,
        modelId,
        contentVersion: course.version,
        contentHash,
        file,
        generatedAt: new Date().toISOString(),
      };
      const index = output.findIndex(
        (item) => item.phraseId === phrase.id && item.speed === speed,
      );
      if (index >= 0) output[index] = entry;
      else output.push(entry);
    }
  if (!dryRun)
    await writeFile(
      manifestPath,
      `${JSON.stringify(output, null, 2)}\n`,
      "utf8",
    );
}
void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Audio generation failed"}\n`,
  );
  process.exitCode = 1;
});
