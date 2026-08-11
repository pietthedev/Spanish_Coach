import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/lesson-player";
import { lessonById } from "@/content/course";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const lesson = lessonById.get(lessonId);
  if (!lesson || lesson.day === 7) notFound();
  return <LessonPlayer lesson={lesson} />;
}
