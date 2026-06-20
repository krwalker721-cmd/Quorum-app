import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/stripe-helpers";

// GET — full subscription details for the authenticated user.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, trial_ends_at, partner_waitlist, referred_by")
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
  const referredFreeMonthExpired = subscription?.referred_free_month_expires_at
    ? new Date(subscription.referred_free_month_expires_at) < new Date()
    : true;

  return NextResponse.json({
    tier: profile?.tier || "free",
    status: subscription?.status || "trialing",
    trial_ends_at: profile?.trial_ends_at || subscription?.trial_ends_at || null,
    // created_at of the subscription row — powers the "first 24h of trial"
    // welcome card on the home feed.
    created_at: subscription?.created_at || null,
    current_period_end: subscription?.current_period_end || null,
    cancel_at_period_end: subscription?.cancel_at_period_end || false,
    has_stripe_subscription: !!subscription?.stripe_subscription_id,
    referred_free_month_available: !referredFreeMonthExpired,
    referred_free_month_expires_at: subscription?.referred_free_month_expires_at || null,
    partner_waitlist: profile?.partner_waitlist || false,
    referrer_name: referrerName,
  });
}

// POST — create a Stripe Customer Portal session for the authenticated user.
export async function POST() {
  const supabase = createClient();
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
