import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkActivityGates,
  isReferralLinkActive,
  getTotalReferralCount,
  getActiveReferralCount,
} from "@/lib/referral-helpers";

export const dynamic = "force-dynamic";

// GET — full referral data for the authenticated user. Powers the /referrals
// dashboard (wired in Session 8).
export async function GET() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: codeData } = await supabase
    .from("referral_codes")
    .select("code, active")
    .eq("user_id", user.id)
    .maybeSingle();

  const gates = await checkActivityGates(user.id);
  const linkStatus = await isReferralLinkActive(user.id);
  const totalCount = await getTotalReferralCount(user.id);
  const activeCount = await getActiveReferralCount(user.id);

  // Referrals with the referred user's public details.
  const { data: referrals } = await supabase
    .from("referrals")
    .select(
      `
      id,
      status,
      activated_at,
      last_seen_at,
      created_at,
      referred:profiles!referrals_referred_id_fkey(
        id,
        username,
        full_name,
        tier,
        stage
      )
    `,
    )
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false });

  const { data: rewards } = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("user_id", user.id)
    .order("applied_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  let monthlyBonus = 0;
  if (activeCount >= 5) monthlyBonus = 30;
  else if (activeCount >= 3) monthlyBonus = 20;
  else if (activeCount >= 1) monthlyBonus = 10;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  const referralLink = codeData?.code
    ? `${baseUrl}/signup?ref=${codeData.code}`
    : null;

  const tier = profile?.tier ?? "free";

  return NextResponse.json({
    code: codeData?.code ?? null,
    link: referralLink,
    linkActive: linkStatus.active,
    linkActiveReason: linkStatus.reason ?? null,
    gates,
    totalCount,
    activeCount,
    monthlyBonus,
    referrals: referrals ?? [],
    rewards: rewards ?? [],
    tier,
    referralCap: tier === "free" ? 3 : null,
    referralCapReached: tier === "free" && totalCount >= 3,
  });
}
