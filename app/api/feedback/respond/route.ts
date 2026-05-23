import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { question_id, response, dismiss } = await req.json().catch(() => ({}));
  if (!question_id || typeof question_id !== "string") {
    return NextResponse.json({ error: "missing question_id" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (dismiss) {
    const { error } = await admin
      .from("feedback_dismissals")
      .insert({ question_id, user_id: user.id });
    if (error && !error.message.includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (typeof response !== "string" || !response.trim()) {
    return NextResponse.json({ error: "missing response" }, { status: 400 });
  }

  const { error } = await admin
    .from("feedback_responses")
    .insert({ question_id, user_id: user.id, response: response.slice(0, 2000) });
  if (error) {
    if (error.message.includes("duplicate")) {
      return NextResponse.json({ ok: true, already: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
