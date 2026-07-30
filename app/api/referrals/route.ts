import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import {
  createReferralCode,
  checkActivityGates,
  isReferralLinkActive,
  getTotalReferralCount,
  getActiveReferralCount,
} from "@/lib/referral-helpers";
import { recalculateBonus } from "@/lib/referral-helpers";
import { tierFor, BONUS_TIERS } from "@/lib/referral-model";
import { PRICING } from "@/lib/pricing";

export const dynamic = "force-dynamic";

// GET — full referral data for the authenticated user. Powers the /referrals
// dashboard (wired in Session 8).
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let { data: codeData } = await supabase
    .from("referral_codes")
    .select("code, active")
    .eq("user_id", user.id)
    .maybeSingle();

  // Mint the code on demand if it's missing. It used to be created only by the
  // admin approve route, so anyone approved another way — seeded directly,
  // approved before that route existed, or with the waitlist off — ended up
  // with no code at all and therefore no referral link. createReferralCode is
  // idempotent, so this is safe to run on every request.
  if (!codeData?.code) {
    try {
      const code = await createReferralCode(user.id);
      codeData = { code, active: true };
    } catch (e) {
      console.error("referral code creation failed:", e);
    }
  }

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

  // Self-heal the standing bonus on dashboard load, so a missed webhook shows
  // up as the right tier rather than silently stale. Best-effort.
  try {
    await recalculateBonus(user.id);
  } catch (e) {
    console.error("bonus recalculation failed:", e);
  }

  const tier_ = tierFor(activeCount);
  const monthlyBonus = tier_?.amountOff ?? (tier_ ? PRICING.member.monthly : 0);
  const bonusIsFree = tier_ != null && tier_.amountOff === null;

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
    bonusIsFree,
    bonusLabel: tier_?.label ?? null,
    bonusLadder: BONUS_TIERS.map((t) => ({
      min: t.min,
      amountOff: t.amountOff,
      label: t.label,
    })),
    memberPrice: PRICING.member.monthly,
    referrals: referrals ?? [],
    rewards: rewards ?? [],
    tier,
    activeStripeDiscounts,
  });
}
