import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

// POST — send an upgrade nudge to a user. Creates a `trial_ending` notification
// that lights up their settings nav dot and surfaces an upgrade prompt.
export async function POST(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "admin locked" }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    user_id: id,
    kind: "trial_ending",
    type: "trial_ending",
    message: "Your trial is ending soon — upgrade to keep full access.",
    source_type: "billing",
    read: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
