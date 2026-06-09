import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { assignUserToCohort } from "@/lib/cohorts";

// Remove a member from a cohort and reassign them to another available cohort
// (same logic as signup auto-join). Only the cohort creator (is_creator) may do
// this, and never themselves. Notifies the removed member.
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const cohortId: string | undefined = body?.cohort_id;
  const targetUserId: string | undefined = body?.user_id;
  if (!cohortId || !targetUserId) {
    return NextResponse.json({ error: "missing cohort_id or user_id" }, { status: 400 });
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "cannot remove yourself" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the caller is the creator of this cohort.
  const { data: creatorRow } = await admin
    .from("cohort_members")
    .select("id, is_creator")
    .eq("cohort_id", cohortId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!creatorRow || creatorRow.is_creator !== true) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Delete the target's membership in this cohort.
  const { error: delErr } = await admin
    .from("cohort_members")
    .delete()
    .eq("cohort_id", cohortId)
    .eq("user_id", targetUserId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // Auto-assign the removed user to another available cohort.
  try {
    await assignUserToCohort(admin, targetUserId);
  } catch {
    // If reassignment fails the kick still stands; the user can rejoin/browse.
  }

  await admin.from("notifications").insert({
    user_id: targetUserId,
    kind: "cohort_removed",
    message: "you have been removed from a cohort and reassigned to a new one",
    payload: { cohort_id: cohortId },
  });

  return NextResponse.json({ ok: true });
}
