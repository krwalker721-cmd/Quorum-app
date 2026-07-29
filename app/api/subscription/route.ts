import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/stripe-helpers";
import { resolveEntitlement } from "@/lib/entitlements";

// GET — full subscription details for the authenticated user. This is what
// TierContext bootstraps from, so it drives every plan pill, upgrade nudge, and
// paywall in the app: it resolves through lib/entitlements.ts and self-heals
// against Stripe when the stored state grants nothing. A missed webhook used to
// leave a paying member looking free here, with the upgrade prompts to match.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entitlement = await resolveEntitlement(user.id, { reconcileIfBlocked: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("referred_by")
    .eq("id", user.id)
    .maybeSingle();

  // Surface the referrer's name so the onboarding pricing screen can credit them
  // ("Your first month is on [name]"). Read with the service-role client since a
  // user can't read another user's profile row under RLS.
  let referrerName: string | null = null;
  if (profile?.referred_by) {
    const admin = createAdminClient();
    const { data: referrer } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", profile.referred_by)
      .maybeSingle();
    referrerName = referrer?.full_name || referrer?.username || null;
  }

  // The referred free-month offer is available only until its expiry passes.
  const referredFreeMonthExpired = entitlement.referredFreeMonthExpiresAt
    ? new Date(entitlement.referredFreeMonthExpiresAt) < new Date()
    : true;

  return NextResponse.json({
    tier: entitlement.tier,
    status: entitlement.status,
    trial_ends_at: entitlement.trialEndsAt,
    // The permission bit. Paid OR mid-trial — clients should gate on this rather
    // than comparing tier strings.
    has_full_access: entitlement.hasFullAccess,
    access_reason: entitlement.accessReason,
    is_trialing: entitlement.isTrialing,
    days_left_in_trial: entitlement.daysLeftInTrial,
    had_trial: entitlement.hadTrial,
    payment_failing: entitlement.paymentFailing,
    // created_at of the subscription row — powers the "first 24h of trial"
    // welcome card on the home feed.
    created_at: entitlement.subscriptionCreatedAt,
    current_period_end: entitlement.currentPeriodEnd,
    cancel_at_period_end: entitlement.cancelAtPeriodEnd,
    has_stripe_subscription: entitlement.hasStripeSubscription,
    referred_free_month_available: !referredFreeMonthExpired,
    referred_free_month_expires_at: entitlement.referredFreeMonthExpiresAt,
    partner_waitlist: entitlement.partnerWaitlist,
    referrer_name: referrerName,
  });
}

// POST — create a Stripe Customer Portal session for the authenticated user.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, username, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const email = profile?.email || user.email;
  if (!email) return NextResponse.json({ error: "No email found" }, { status: 400 });

  const customerId = await getOrCreateStripeCustomer(
    user.id,
    email,
    profile?.full_name,
  );

  const returnPath = profile?.username ? `/profile/${profile.username}` : "/settings";
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}${returnPath}`,
  });

  return NextResponse.json({ url: portalSession.url });
}
