import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = await createClient();
  if (!supabase)
    return NextResponse.json(
      { error: "Cloud account is not configured." },
      { status: 503 },
    );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("auth_user_id", user.id);
  if (error)
    return NextResponse.json(
      { error: "Account data could not be deleted." },
      { status: 502 },
    );
  await supabase.auth.signOut();
  return NextResponse.json(
    {
      ok: true,
      note: "Rumbo learner data was deleted. Remove the Auth user in the Supabase dashboard to complete identity deletion.",
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
