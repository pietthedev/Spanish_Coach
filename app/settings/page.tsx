"use client";
import Link from "next/link";
import {
  ChevronLeft,
  Download,
  FileDown,
  LogOut,
  Mic,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRumbo } from "@/components/app-providers";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const { profile } = useRumbo();
  const [message, setMessage] = useState(
    "Microphone permission is requested only after you tap Test microphone.",
  );
  const test = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMessage("Microphone is working. Rumbo stopped access after the test.");
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setMessage(
        "Microphone access is off. In Chrome, open site settings → Microphone → Allow.",
      );
    }
  };
  const signOut = async () => {
    await createClient()?.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  };
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] px-4 py-5">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          className="tap-target grid place-items-center rounded-full"
          aria-label="Back to Today"
        >
          <ChevronLeft />
        </Link>
        <h1 className="text-2xl font-black">Profile & settings</h1>
      </header>
      <section className="card mt-6 p-5">
        <div className="flex items-center gap-3">
          <UserRound className="text-agave" />
          <div>
            <p className="font-black">{profile?.displayName ?? "Traveller"}</p>
            <p className="text-ink/55 text-xs">
              {profile?.isDemo
                ? "Demo profile · this device"
                : "Private learner profile"}
            </p>
          </div>
        </div>
      </section>
      <section className="card mt-4 p-5">
        <h2 className="flex items-center gap-2 font-black">
          <Mic className="text-coral" />
          Microphone test
        </h2>
        <p className="text-ink/65 mt-2 text-sm" aria-live="polite">
          {message}
        </p>
        <button
          onClick={() => void test()}
          className="tap-target bg-ink mt-4 w-full rounded-2xl px-4 font-black text-white"
        >
          Test microphone
        </button>
      </section>
      <Link
        href="/travel-pack"
        className="tap-target mt-4 flex items-center gap-3 rounded-2xl bg-white p-4 font-black"
      >
        <Download className="text-sky" />
        Offline pack & storage
      </Link>
      {!profile?.isDemo && (
        <a
          href="/api/account/export"
          className="tap-target mt-2 flex items-center gap-3 rounded-2xl bg-white p-4 font-black"
        >
          <FileDown className="text-agave" />
          Export my progress
        </a>
      )}
      <section className="bg-agave/10 mt-4 rounded-2xl p-4">
        <h2 className="flex items-center gap-2 font-black">
          <ShieldCheck />
          Voice privacy
        </h2>
        <p className="mt-2 text-sm">
          Online recordings are sent securely for transcription and are not
          retained by Rumbo. Offline recordings stay on your device.
        </p>
      </section>
      <button
        onClick={() => void signOut()}
        className="tap-target border-coral text-coral mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border font-black"
      >
        <LogOut />
        {profile?.isDemo ? "Exit demo" : "Sign out / switch account"}
      </button>
      <p className="text-ink/45 mt-6 text-center text-xs">
        Rumbo 0.1 · Course 2026.1
      </p>
    </main>
  );
}
