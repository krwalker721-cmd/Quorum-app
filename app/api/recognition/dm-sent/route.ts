import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Called fire-and-forget after a DM is sent. If this is the FIRST message
 * exchanged between sender and recipient and an introduction record exists
 * naming both, mark the intro awarded and drop a one-time "connector" notice
 * for the introducer.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { recipient_id } = await req.json().catch(() => ({}));
  if (!recipient_id || typeof recipient_id !== "string") {
    return NextResponse.json({ error: "missing recipient_id" }, { status: 400 });
  }
  if (recipient_id === user.id) return NextResponse.json({ ok: true });

  // Best-effort: only react when this is the first time these two have DM'd.
  // Count messages between the pair (in either direction).
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${recipient_id}),and(sender_id.eq.${recipient_id},recipient_id.eq.${user.id})`,
    );

  // Allow ≤ 1 because the just-sent message itself is already in the table.
  if ((count ?? 0) > 1) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const { data: intros } = await admin
    .from("introductions")
    .select("id, introducer_id, person_a_id, person_b_id, awarded")
    .or(
      `and(person_a_id.eq.${user.id},person_b_id.eq.${recipient_id}),and(person_a_id.eq.${recipient_id},person_b_id.eq.${user.id})`,
    )
    .eq("awarded", false)
    .limit(5);

  for (const intro of intros ?? []) {
    await admin
      .from("introductions")
      .update({ awarded: true })
      .eq("id", intro.id);
    await admin.from("recognition_notices").insert({
      user_id: intro.introducer_id,
      kind: "connector",
      payload: {
        a: intro.person_a_id,
        b: intro.person_b_id,
      },
    });
  }
  return NextResponse.json({ ok: true });
}
