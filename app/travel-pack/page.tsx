"use client";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  Download,
  HardDriveDownload,
} from "lucide-react";
import { useState } from "react";
import { course } from "@/content/course";

const paths = [
  "/",
  "/path",
  "/practice",
  "/progress",
  "/offline",
  ...course.lessons.slice(0, 6).map((lesson) => `/lesson/${lesson.id}`),
  "/mission/friendly-arrival",
];
export default function TravelPackPage() {
  const [status, setStatus] = useState<
    "idle" | "downloading" | "ready" | "partial"
  >("idle");
  const download = async () => {
    setStatus("downloading");
    try {
      if ("storage" in navigator && "persist" in navigator.storage)
        await navigator.storage.persist();
      if (!("caches" in window)) throw new Error();
      const cache = await caches.open(`rumbo-pack-${course.version}`);
      await cache.addAll(paths);
      const audio = course.phrases.flatMap((p) => [
        p.audio.normal.src,
        p.audio.slow.src,
      ]);
      const results = await Promise.allSettled(
        audio.map(async (url) => {
          const response = await fetch(url);
          if (response.ok) await cache.put(url, response);
          else throw new Error();
        }),
      );
      setStatus(
        results.every((result) => result.status === "fulfilled")
          ? "ready"
          : "partial",
      );
    } catch {
      setStatus("partial");
    }
  };
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] px-4 py-5">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          className="tap-target grid place-items-center"
          aria-label="Back"
        >
          <ChevronLeft />
        </Link>
        <h1 className="text-2xl font-black">Offline pack</h1>
      </header>
      <div className="bg-ink mt-7 rounded-3xl p-6 text-white">
        <HardDriveDownload className="text-marigold" size={38} />
        <p className="text-marigold mt-4 text-xs font-black tracking-wider">
          DAYS 1–7
        </p>
        <h2 className="mt-2 text-3xl font-black">Your first Mexico pack</h2>
        <p className="mt-3 text-white/75">
          Lesson text, route, progress foundation and approved audio when
          generated.
        </p>
        <button
          onClick={() => void download()}
          disabled={status === "downloading"}
          className="tap-target bg-marigold text-ink mt-6 flex w-full items-center justify-center gap-2 rounded-2xl font-black"
        >
          <Download />
          {status === "downloading"
            ? "Downloading…"
            : status === "idle"
              ? "Download to this phone"
              : "Repair download"}
        </button>
      </div>
      {status === "ready" && (
        <p className="bg-agave/10 text-agave mt-4 flex items-center gap-2 rounded-xl p-3 font-bold">
          <CheckCircle2 />
          Pack verified and ready offline.
        </p>
      )}
      {status === "partial" && (
        <div className="bg-marigold/20 mt-4 rounded-xl p-3">
          <p className="font-bold">
            Lessons are cached; approved audio is not installed yet.
          </p>
          <p className="mt-1 text-sm">
            Use the documented ElevenLabs generation step, then tap Repair
            download. Device-voice previews remain clearly labelled.
          </p>
        </div>
      )}
      <h2 className="mt-7 text-xl font-black">Included phrases</h2>
      <ul className="divide-ink/10 mt-3 divide-y rounded-2xl bg-white px-4">
        {course.phrases.map((phrase) => (
          <li key={phrase.id} className="py-3">
            <p className="font-black">{phrase.esMX}</p>
            <p className="text-ink/55 text-sm">{phrase.english}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
