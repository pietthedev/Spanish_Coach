"use client";
import { CheckCircle2, Mic, Volume2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [mic, setMic] = useState<"untested" | "ok" | "off">("untested");
  const [audio, setAudio] = useState(false);
  const testMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMic("ok");
    } catch {
      setMic("off");
    }
  };
  const testAudio = () => {
    const utterance = new SpeechSynthesisUtterance(
      "Hola. Bienvenidos a Rumbo.",
    );
    utterance.lang = "es-MX";
    utterance.onend = () => setAudio(true);
    speechSynthesis.speak(utterance);
  };
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] px-5 py-8">
      <p className="text-agave text-sm font-black tracking-wider">
        FIRST-RUN CHECK
      </p>
      <h1 className="mt-2 text-4xl font-black">
        Let’s make sure you can hear and speak
      </h1>
      <p className="text-ink/65 mt-3">
        Rumbo asks for microphone access only when you choose to test or speak.
      </p>
      <section className="card mt-7 p-5">
        <h2 className="flex items-center gap-2 text-xl font-black">
          <Volume2 className="text-sky" />
          Audio
        </h2>
        <p className="mt-2 text-sm">
          Play a short Spanish greeting at your current volume.
        </p>
        <button
          onClick={testAudio}
          className="tap-target bg-ink mt-4 w-full rounded-2xl font-black text-white"
        >
          {audio ? "Play again" : "Test audio"}
        </button>
        {audio && (
          <p className="text-agave mt-3 flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 size={18} />
            Audio played
          </p>
        )}
      </section>
      <section className="card mt-4 p-5">
        <h2 className="flex items-center gap-2 text-xl font-black">
          <Mic className="text-coral" />
          Microphone
        </h2>
        <p className="mt-2 text-sm">
          Access ends immediately after this test. Voice leaves the phone only
          during an online transcription exercise.
        </p>
        <button
          onClick={() => void testMic()}
          className="tap-target border-ink mt-4 w-full rounded-2xl border-2 font-black"
        >
          Test microphone
        </button>
        {mic === "ok" && (
          <p className="text-agave mt-3 text-sm font-bold">Microphone ready</p>
        )}
        {mic === "off" && (
          <p className="text-coral mt-3 text-sm font-bold">
            Permission is off. You can continue and enable it later.
          </p>
        )}
      </section>
      <button
        onClick={() => router.push("/")}
        className="tap-target bg-agave mt-6 w-full rounded-2xl font-black text-white"
      >
        Continue to Today
      </button>
    </main>
  );
}
