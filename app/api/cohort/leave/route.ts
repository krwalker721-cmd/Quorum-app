import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

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

  const admin = createAdminClient();

  // Leaving is a full, permanent removal — delete the membership row and stop.
  // No reassignment: the user immediately loses access to that cohort's posts,
  // messages, and room (enforced by RLS on the now-missing membership).
  if (cohortId) {
    const { error } = await admin
      .from("cohort_members")
      .delete()
      .eq("user_id", user.id)
      .eq("cohort_id", cohortId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // No explicit cohort — remove from all of them.
    const { error } = await admin
      .from("cohort_members")
      .delete()
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
