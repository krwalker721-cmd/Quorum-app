import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";
import { assignUserToCohort } from "@/lib/cohorts";
import { initializeUserSubscription } from "@/lib/stripe-helpers";
import { createReferralCode, trackLoginEvent } from "@/lib/referral-helpers";

export async function POST(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "admin locked" }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: approved, error } = await admin
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", id)
    .select("referred_by")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Start the user's trial. Referred users (referred_by set at signup) get the
  // 30-day trial + 48h free-month window; cold signups get 7 days. Best-effort.
  const isReferred = !!approved?.referred_by;
  try {
    await initializeUserSubscription(id, isReferred);
  } catch (e) {
    console.error("initializeUserSubscription failed on approve:", e);
  }

  // Generate the user's referral code and seed their first login event (day 1
  // toward the 3-day activity gate). Best-effort — never block approval.
  try {
    await createReferralCode(id);
    await trackLoginEvent(id);
  } catch (e) {
    console.error("referral code / login event setup failed on approve:", e);
  }

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
