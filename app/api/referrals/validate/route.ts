import { NextRequest, NextResponse } from "next/server";
import { validateReferralCode } from "@/lib/referral-helpers";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET ?code=CODE — validate a referral code (called on the signup page when a
// ?ref= param is present). Returns the referrer's name for the welcome banner.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ valid: false, reason: "No code provided" });

  const result = await validateReferralCode(code);
  if (!result.valid) {
    return NextResponse.json({ valid: false, reason: result.reason });
  }

  const supabase = createAdminClient();
  const { data: referrer } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", result.referrerId!)
    .maybeSingle();

  return NextResponse.json({
    valid: true,
    referrerName: referrer?.full_name || referrer?.username || "A Quorum member",
  });
}
