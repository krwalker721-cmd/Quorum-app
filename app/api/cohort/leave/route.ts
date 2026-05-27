import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { assignUserToCohort } from "@/lib/cohorts";

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

  if (cohortId) {
    const { error } = await admin
      .from("cohort_members")
      .delete()
      .eq("user_id", user.id)
      .eq("cohort_id", cohortId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // No explicit cohort — remove from all (single-cohort assumption).
    const { error } = await admin
      .from("cohort_members")
      .delete()
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let reassignedTo: string | null = null;
  let warn: string | null = null;
  try {
    reassignedTo = await assignUserToCohort(admin, user.id);
  } catch (e: any) {
    warn = e?.message ?? "reassign failed";
  }

  return NextResponse.json({ ok: true, reassigned_to: reassignedTo, warning: warn });
}
