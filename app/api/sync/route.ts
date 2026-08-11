import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const eventSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().min(1),
  deviceId: z.string().min(1),
  type: z.enum([
    "lesson_started",
    "lesson_completed",
    "phrase_reviewed",
    "mission_completed",
  ]),
  entityId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  clientCreatedAt: z.string().datetime(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase)
    return NextResponse.json(
      { error: "Cloud sync is not configured." },
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
  const parsed = z
    .object({ events: z.array(eventSchema).max(25) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid sync batch." }, { status: 400 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (
    !profile ||
    parsed.data.events.some((event) => event.profileId !== profile.id)
  )
    return NextResponse.json({ error: "Profile mismatch." }, { status: 403 });
  const rows = parsed.data.events.map((event) => ({
    id: event.id,
    profile_id: profile.id,
    device_id: event.deviceId,
    event_type: event.type,
    entity_id: event.entityId,
    payload: event.payload,
    client_created_at: event.clientCreatedAt,
  }));
  const { error } = await supabase
    .from("progress_events")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error)
    return NextResponse.json(
      { error: "Sync is temporarily unavailable." },
      { status: 502 },
    );
  for (const event of parsed.data.events) {
    if (event.type !== "lesson_started" && event.type !== "lesson_completed")
      continue;
    const { data: existing } = await supabase
      .from("lesson_progress")
      .select("status, points, revision")
      .eq("profile_id", profile.id)
      .eq("lesson_id", event.entityId)
      .maybeSingle();
    if (existing?.status === "completed" && event.type === "lesson_started")
      continue;
    const completed = event.type === "lesson_completed";
    const points =
      completed && typeof event.payload.points === "number"
        ? Math.max(0, Math.min(100, Math.trunc(event.payload.points)))
        : (existing?.points ?? 0);
    const { error: projectionError } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          profile_id: profile.id,
          lesson_id: event.entityId,
          status: completed ? "completed" : "started",
          started_at: existing ? undefined : event.clientCreatedAt,
          completed_at: completed ? event.clientCreatedAt : null,
          points,
          content_version: "2026.1",
          revision: (existing?.revision ?? 0) + 1,
        },
        { onConflict: "profile_id,lesson_id" },
      );
    if (projectionError)
      return NextResponse.json(
        { error: "Progress projection is temporarily unavailable." },
        { status: 502 },
      );
  }
  const { data: lessonProgress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status, completed_at, points, revision")
    .order("started_at");
  return NextResponse.json({
    acknowledged: parsed.data.events.map((event) => event.id),
    lessonProgress: lessonProgress ?? [],
  });
}
