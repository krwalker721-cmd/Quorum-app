import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Onboarding progress for the current user. Backed by the onboarding_progress
// table (one row per user, RLS-scoped to auth.uid()). The cookie-based server
// client runs as the signed-in user, so RLS enforces ownership for us.

// GET — current user's progress, or sensible defaults if no row exists yet.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("onboarding_progress")
    .select("current_step, completed, screen3_answer")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      current_step: 1,
      completed: false,
      screen3_answer: null,
    });
  }

  return NextResponse.json({
    current_step: data.current_step,
    completed: data.completed,
    screen3_answer: data.screen3_answer,
  });
}

// POST — upsert progress. Accepts any subset of { current_step, screen3_answer,
// completed }; only the provided fields are written. Setting completed:true also
// stamps completed_at.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    current_step?: number;
    screen3_answer?: string;
    completed?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const payload: Record<string, unknown> = { user_id: user.id };
  if (typeof body.current_step === "number") {
    payload.current_step = body.current_step;
  }
  if (typeof body.screen3_answer === "string") {
    payload.screen3_answer = body.screen3_answer;
  }
  if (typeof body.completed === "boolean") {
    payload.completed = body.completed;
    if (body.completed) {
      payload.completed_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from("onboarding_progress")
    .upsert(payload, { onConflict: "user_id" })
    .select("current_step, completed, screen3_answer, completed_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
