import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";
import { assignUserToCohort } from "@/lib/cohorts";

export async function POST(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "admin locked" }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ status: "approved" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-assign to a cohort on approval. Don't fail the whole approval if cohort
  // assignment hits a transient error — surface a warning in the response.
  let cohortId: string | null = null;
  let cohortWarn: string | null = null;
  try {
    cohortId = await assignUserToCohort(admin, id);
  } catch (e: any) {
    cohortWarn = e?.message ?? "cohort assignment failed";
  }

  return NextResponse.json({ ok: true, cohort_id: cohortId, cohort_warning: cohortWarn });
}
