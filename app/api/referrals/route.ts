import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import {
  checkActivityGates,
  isReferralLinkActive,
  getTotalReferralCount,
  getActiveReferralCount,
} from "@/lib/referral-helpers";

export const dynamic = "force-dynamic";

// Monthly-equivalent value of each reward coupon, for the dashboard savings card.
// Recurring milestone discounts are expressed against the $49 Member price.
const DISCOUNT_VALUES: Record<string, number> = {
  QUORUM_MILESTONE_10: 24.5, // 50% of $49
  QUORUM_MILESTONE_25: 49, // 100% of $49
  QUORUM_MONTHLY_10: 10,
  QUORUM_MONTHLY_20: 20,
  QUORUM_MONTHLY_30: 30,
};

function calculateCurrentSavings(discountIds: string[]): number {
  return discountIds.reduce((total, id) => total + (DISCOUNT_VALUES[id] || 0), 0);
}

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

  // Active Stripe discounts currently attached to the user's subscription — the
  // source of truth for what they're actually saving this month. Read via the
  // service-role client (subscriptions rows aren't user-readable under RLS).
  let activeStripeDiscounts: string[] = [];
  const admin = createAdminClient();
  const { data: subscriptionData } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (subscriptionData?.stripe_subscription_id) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(
        subscriptionData.stripe_subscription_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { expand: ["discounts"] } as any,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const discounts = ((stripeSub as any).discounts ?? []) as any[];
      activeStripeDiscounts = discounts
        .map((d) => d?.coupon?.id)
        .filter((id): id is string => Boolean(id));
    } catch (err) {
      console.error("Failed to fetch Stripe discounts:", err);
    }
  }

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
    activeStripeDiscounts,
    currentSavings: calculateCurrentSavings(activeStripeDiscounts),
  });
}
