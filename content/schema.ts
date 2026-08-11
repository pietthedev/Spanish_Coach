import { z } from "zod";

export const reviewStatusSchema = z.object({
  linguistic: z.enum(["required", "approved"]),
  mexicanUsage: z.enum(["required", "approved"]),
  safety: z.enum(["not-applicable", "required", "approved"]),
});

const audioAssetSchema = z.object({
  src: z.string().min(1),
  assetId: z.string().min(1),
  voiceSlot: z.enum(["primary", "secondary"]),
  speed: z.enum(["normal", "slow"]),
  productionReady: z.boolean(),
});

export const phraseSchema = z.object({
  id: z.string().regex(/^mx\./),
  esMX: z.string().min(1),
  english: z.string().min(1),
  pronunciationAid: z.string().optional(),
  context: z.string().min(1),
  register: z.enum(["neutral", "formal-neutral", "friendly-neutral"]),
  productive: z.boolean().default(true),
  acceptedAnswers: z.array(z.string().min(1)).min(1),
  requiredConcepts: z.array(z.string()).min(1),
  conceptAliases: z.record(z.string(), z.array(z.string()).min(1)),
  criticalConcepts: z.array(z.string()).default([]),
  criticalTerms: z.record(z.string(), z.array(z.string())).default({}),
  optionalWords: z.array(z.string()).default([]),
  likelyReplies: z
    .array(z.object({ esMX: z.string(), english: z.string() }))
    .default([]),
  commonErrors: z
    .array(z.object({ pattern: z.string(), feedback: z.string() }))
    .default([]),
  audio: z.object({ normal: audioAssetSchema, slow: audioAssetSchema }),
  reviewIntervalsDays: z.tuple([
    z.literal(0),
    z.literal(1),
    z.literal(3),
    z.literal(7),
    z.literal(14),
    z.literal(30),
  ]),
  offline: z.enum(["core", "optional"]),
  reviewStatus: reviewStatusSchema,
});

export const exerciseSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("due-review"),
    limit: z.number().int().min(0).max(6),
  }),
  z.object({
    id: z.string(),
    type: z.literal("present"),
    phraseId: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("retrieve"),
    phraseId: z.string(),
    prompt: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("listen-choice"),
    phraseId: z.string(),
    options: z.array(z.string()).min(2),
    answer: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("speak"),
    phraseId: z.string(),
    prompt: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("micro-scenario"),
    prompt: z.string(),
    phraseIds: z.array(z.string()).min(1),
  }),
]);

export const lessonSchema = z.object({
  id: z.string().regex(/^mx71\.d\d{2}$/),
  day: z.number().int().min(1).max(71),
  date: z.string().date(),
  title: z.string().min(1),
  outcome: z.string().min(1),
  estimatedMinutes: z.number().min(3).max(10),
  newPhraseIds: z.array(z.string()).max(3),
  reviewPhraseIds: z.array(z.string()),
  exercises: z.array(exerciseSchema).min(1),
  completionMessage: z.string().min(1),
  travelPoints: z.number().int().min(0),
  category: z.enum([
    "foundations",
    "food",
    "money",
    "transport",
    "directions",
    "stay",
    "problems",
    "friendly-chat",
  ]),
  reviewStatus: reviewStatusSchema,
});

export const missionTurnSchema = z.object({
  id: z.string(),
  speaker: z.enum(["host", "learner"]),
  line: z.string(),
  meaning: z.string(),
  expectedIntent: z.string().optional(),
  acceptedPhraseIds: z.array(z.string()).default([]),
  hint: z.string().optional(),
  repair: z.string().optional(),
  next: z.string().nullable(),
});

export const scenarioSchema = z.object({
  id: z.string(),
  version: z.string(),
  title: z.string(),
  goal: z.string(),
  startTurnId: z.string(),
  successTurnIds: z.array(z.string()).min(1),
  requiredIntents: z.array(z.string()).min(1),
  turns: z.array(missionTurnSchema).min(2),
  reviewStatus: reviewStatusSchema,
});

export const courseSchema = z.object({
  id: z.literal("mx-travel-71"),
  version: z.string(),
  title: z.string(),
  teachingLanguage: z.literal("en"),
  targetLocale: z.literal("es-MX"),
  startDate: z.literal("2026-08-10"),
  departureDate: z.literal("2026-10-20"),
  phase: z.object({
    id: z.literal("foundations"),
    title: z.string(),
    dayRange: z.tuple([z.literal(1), z.literal(7)]),
  }),
  phrases: z.array(phraseSchema),
  lessons: z.array(lessonSchema).length(7),
  scenarios: z.array(scenarioSchema).min(1),
});

export type Phrase = z.infer<typeof phraseSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type Course = z.infer<typeof courseSchema>;
