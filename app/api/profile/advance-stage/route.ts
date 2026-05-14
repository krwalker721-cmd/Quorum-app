import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const ORDER = ["idea", "pre-seed", "seed", "series_a"] as const;
type Stage = (typeof ORDER)[number];

const TRANSITION_COPY: Record<string, string> = {
  "pre-seed": "pre-seed. the idea is real enough to bet on. keep going.",
  seed: "seed stage. someone else believes in this now too.",
  series_a: "series_a. you built something worth scaling.",
};

/**
 * Advance the caller's stage by exactly one step along the canonical order.
 * One-directional. Refuses anything else.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stage")
    .eq("id", user.id)
    .single();

  const current = profile?.stage as Stage | null;
  if (!current) return NextResponse.json({ error: "no current stage" }, { status: 400 });

  const idx = ORDER.indexOf(current);
  if (idx < 0) return NextResponse.json({ error: "unknown stage" }, { status: 400 });
  if (idx >= ORDER.length - 1) {
    return NextResponse.json({ error: "already at top stage" }, { status: 400 });
  }
  const next = ORDER[idx + 1];

  const { error } = await supabase
    .from("profiles")
    .update({ stage: next })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Queue the one-time congrats line for next home load. Use admin so the
  // insert never trips a future RLS tweak.
  const admin = createAdminClient();
  await admin.from("recognition_notices").insert({
    user_id: user.id,
    kind: "stage_advance",
    payload: { from: current, to: next, copy: TRANSITION_COPY[next] ?? null },
  });

  return NextResponse.json({ ok: true, stage: next });
}
