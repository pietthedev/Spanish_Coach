import type { z } from "zod";
import { exerciseSchema, lessonSchema } from "./schema";
export type Exercise = z.infer<typeof exerciseSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
