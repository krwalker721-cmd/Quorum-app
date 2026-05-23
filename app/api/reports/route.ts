import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const REASONS = new Set(["spam", "inappropriate", "harassment", "misinformation", "other"]);

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { post_id, reason, note } = await req.json().catch(() => ({}));
  if (!post_id || typeof post_id !== "string") {
    return NextResponse.json({ error: "missing post_id" }, { status: 400 });
  }
  if (!reason || !REASONS.has(reason)) {
    return NextResponse.json({ error: "invalid reason" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("reports").insert({
    post_id,
    reported_by: user.id,
    reason,
    note: typeof note === "string" ? note.slice(0, 1000) : null,
  });
  if (error) {
    if (error.message.includes("duplicate")) {
      return NextResponse.json({ ok: true, already: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
