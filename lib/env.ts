import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_CONTENT_VERSION: z.string().default("2026.1"),
});

const serverSchema = publicSchema.extend({
  ELEVENLABS_API_KEY: z.string().min(10).optional(),
  ELEVENLABS_VOICE_ID_PRIMARY: z.string().optional(),
  ELEVENLABS_VOICE_ID_SECONDARY: z.string().optional(),
  ELEVENLABS_TTS_MODEL_ID: z.string().default("eleven_multilingual_v2"),
  ELEVENLABS_STT_MODEL_ID: z.string().default("scribe_v2"),
  INVITED_EMAIL_HASHES: z.string().default(""),
  SPEECH_RATE_LIMIT_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .default(20),
  SPEECH_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(10_000)
    .max(2_000_000)
    .default(1_000_000),
  VOICE_FEATURE_MODE: z.enum(["fixture", "batch"]).default("fixture"),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_CONTENT_VERSION: process.env.NEXT_PUBLIC_CONTENT_VERSION,
});

export function getServerEnv() {
  return serverSchema.parse({ ...process.env, ...publicEnv });
}

export function hasSupabaseConfig(): boolean {
  return Boolean(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL &&
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
