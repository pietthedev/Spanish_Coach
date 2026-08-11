import Link from "next/link";
import { Check, LockKeyhole, MapPin } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { course } from "@/content/course";

export default function PathPage() {
  return (
    <AppShell active="path">
      <p className="text-agave text-sm font-black tracking-[.15em]">
        YOUR ROUTE
      </p>
      <h1 className="mt-2 text-4xl font-black">Foundations & repair</h1>
      <p className="text-ink/65 mt-3">
        Seven days to prove the complete learning loop.
      </p>
      <ol className="before:bg-agave/25 relative mt-7 space-y-4 before:absolute before:top-7 before:bottom-7 before:left-6 before:w-0.5">
        {course.lessons.map((lesson) => (
          <li key={lesson.id} className="relative flex gap-4">
            <div
              className={`border-canvas z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full border-4 ${lesson.day === 7 ? "bg-coral text-white" : "bg-agave text-white"}`}
            >
              {lesson.day === 7 ? <MapPin size={20} /> : lesson.day}
            </div>
            <Link
              href={
                lesson.day === 7
                  ? "/mission/friendly-arrival"
                  : `/lesson/${lesson.id}`
              }
              className="tap-target card flex flex-1 items-center justify-between p-4"
            >
              <div>
                <p className="text-ink/55 text-xs font-bold">
                  DAY {lesson.day} · {lesson.date.slice(5)}
                </p>
                <h2 className="mt-1 font-black">{lesson.title}</h2>
              </div>
              {lesson.day === 1 ? (
                <Check className="text-agave" />
              ) : lesson.day <= 7 ? (
                <span className="text-xs font-bold">Open</span>
              ) : (
                <LockKeyhole />
              )}
            </Link>
          </li>
        ))}
      </ol>
    </AppShell>
  );
}
