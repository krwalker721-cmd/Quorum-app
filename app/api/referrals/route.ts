import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import {
  checkActivityGates,
  isReferralLinkActive,
  getTotalReferralCount,
  getActiveReferralCount,
} from "@/lib/referral-helpers";
import { getEarnedCreditMonths } from "@/lib/referral-credit";
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

  // Months of Member earned as credit — one per referral who activated. This
  // replaced the old standing 50%-off-forever bonus.
  const creditMonths = await getEarnedCreditMonths(user.id);

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
    creditMonths,
    creditValue: creditMonths * PRICING.member.monthly,
    referrals: referrals ?? [],
    rewards: rewards ?? [],
    tier,
    activeStripeDiscounts,
  });
}
