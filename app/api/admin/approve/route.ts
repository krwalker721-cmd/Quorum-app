import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";
import { approveUser } from "@/lib/admin/approve";

// Approve one member. The steps — trial, referral code, cohort — live in
// lib/admin/approve.ts, shared with bulk approve.
export async function POST(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "admin locked" }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const outcome = await approveUser(createAdminClient(), id);
  if (outcome.result === "failed") {
    return NextResponse.json({ error: outcome.reason ?? "approval failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    skipped: outcome.result === "skipped" ? outcome.reason : undefined,
    cohort_id: outcome.cohortId ?? null,
    cohort_warning: outcome.cohortWarning ?? null,
  });
}
