"use client";
import { Headphones, Mic, Repeat2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { course } from "@/content/course";

export default function PracticePage() {
  return (
    <AppShell active="practice">
      <p className="text-sky text-sm font-black tracking-[.15em]">PRACTICE</p>
      <h1 className="mt-2 text-4xl font-black">Keep useful phrases close</h1>
      <div className="card mt-6 p-5">
        <div className="flex items-center gap-3">
          <Repeat2 className="text-agave" />
          <div>
            <h2 className="text-xl font-black">Nothing due yet</h2>
            <p className="text-ink/65 text-sm">
              Reviews appear here before new material.
            </p>
          </div>
        </div>
        <button className="tap-target bg-ink mt-5 w-full rounded-2xl px-4 font-black text-white">
          Quick practice · 3 phrases
        </button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button className="tap-target rounded-2xl bg-white p-4 text-left">
          <Headphones className="text-sky" />
          <span className="mt-3 block font-black">Listening</span>
          <span className="text-ink/55 text-xs">Hear another voice</span>
        </button>
        <button className="tap-target rounded-2xl bg-white p-4 text-left">
          <Mic className="text-coral" />
          <span className="mt-3 block font-black">Speaking</span>
          <span className="text-ink/55 text-xs">Low-stakes rehearsal</span>
        </button>
      </div>
      <h2 className="mt-7 text-lg font-black">Week 1 phrasebook</h2>
      <ul className="mt-3 space-y-2">
        {course.phrases.slice(0, 6).map((phrase) => (
          <li key={phrase.id} className="rounded-xl bg-white p-3">
            <span className="font-black">{phrase.esMX}</span>
            <span className="text-ink/55 float-right text-sm">
              {phrase.english}
            </span>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
