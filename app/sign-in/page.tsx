"use client";
import { Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("sending");
    const response = await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = (await response.json()) as { error?: string };
    if (response.ok) {
      setState("sent");
      setMessage(
        "Check your email on this phone. The secure link will bring you back to Rumbo.",
      );
    } else {
      setState("error");
      setMessage(body.error ?? "Sign-in is unavailable.");
    }
  };
  return (
    <main className="mx-auto grid min-h-dvh max-w-[430px] place-items-center px-5 py-8">
      <div className="w-full">
        <div className="route-mark mx-auto" />
        <p className="text-agave mt-7 text-center text-sm font-black tracking-[.16em]">
          READY FOR MÉXICO
        </p>
        <h1 className="mt-2 text-center text-4xl font-black">
          Your progress, your pace
        </h1>
        <p className="text-ink/65 mt-3 text-center">
          Use the email address that was privately invited. Each traveller has a
          separate account.
        </p>
        <form
          onSubmit={(event) => void submit(event)}
          className="card mt-7 p-5"
        >
          <label htmlFor="email" className="font-bold">
            Invited email
          </label>
          <div className="relative mt-2">
            <Mail className="text-ink/45 absolute top-3.5 left-3" size={20} />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="tap-target border-ink/15 w-full rounded-2xl border-2 bg-white pr-4 pl-11"
              placeholder="you@example.com"
            />
          </div>
          <button
            disabled={state === "sending"}
            className="tap-target bg-ink mt-4 w-full rounded-2xl font-black text-white disabled:opacity-60"
          >
            {state === "sending" ? "Sending…" : "Send secure sign-in link"}
          </button>
          {message && (
            <p
              className={`mt-4 text-sm ${state === "error" ? "text-coral" : "text-agave"}`}
              role="status"
            >
              {message}
            </p>
          )}
        </form>
        <div className="text-ink/60 mt-5 flex items-start gap-2 text-sm">
          <ShieldCheck className="text-agave shrink-0" size={20} />
          <p>
            Invite-only access. Rumbo does not offer public account creation.
          </p>
        </div>
        <Link
          href="/"
          className="tap-target text-sky mt-4 flex items-center justify-center font-bold"
        >
          Return to demo
        </Link>
      </div>
    </main>
  );
}
