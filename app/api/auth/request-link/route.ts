import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

export async function POST(request: Request) {
  const env = getServerEnv();
  if (
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 },
    );
  const { email } = (await request.json().catch(() => ({}))) as {
    email?: string;
  };
  const normalEmail = email?.trim().toLocaleLowerCase();
  if (!normalEmail || normalEmail.length > 254)
    return NextResponse.json(
      { error: "Enter a valid invited email address." },
      { status: 400 },
    );
  const hash = createHash("sha256").update(normalEmail).digest("hex");
  const allowlist = new Set(
    env.INVITED_EMAIL_HASHES.split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  if (!allowlist.has(hash))
    return NextResponse.json(
      { error: "This email has not been invited." },
      { status: 403 },
    );
  const supabase = createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const { error } = await supabase.auth.signInWithOtp({
    email: normalEmail,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  if (error)
    return NextResponse.json(
      { error: "The sign-in link could not be sent. Try again shortly." },
      { status: 502 },
    );
  return NextResponse.json({ ok: true });
}
