import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateReferralCode, createReferral } from "@/lib/referral-helpers";

export const dynamic = "force-dynamic";

// POST { code } — claim a referral code for the newly-signed-up (authenticated)
// user. This project has no auth-callback route; the signup page creates the
// profile inline and then calls this with the captured ?ref= code. The referred
// user is taken from the session, never the request body, so a user can't be
// attributed to someone else.
export async function POST(req: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json().catch(() => ({ code: null }));
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const { valid, referrerId, reason } = await validateReferralCode(code);
  if (!valid || !referrerId) {
    return NextResponse.json({ claimed: false, reason: reason ?? "Invalid code" });
  }

  if (referrerId === user.id) {
    return NextResponse.json({ claimed: false, reason: "Cannot refer yourself" });
  }

  await createReferral(referrerId, user.id, code);
  return NextResponse.json({ claimed: true });
}
