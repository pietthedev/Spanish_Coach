import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const tables = [
  "profiles",
  "lesson_progress",
  "phrase_mastery",
  "attempts",
  "scenario_runs",
  "progress_events",
  "achievements",
  "favourites",
  "category_readiness",
  "devices",
] as const;
export async function GET() {
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
  const output: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    courseVersion: "2026.1",
  };
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*");
    if (error)
      return NextResponse.json(
        { error: "Export is temporarily unavailable." },
        { status: 502 },
      );
    output[table] = data;
  }
  return new NextResponse(JSON.stringify(output, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="rumbo-progress-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
