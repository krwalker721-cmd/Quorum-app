import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/stripe-helpers";
import { isPlanKey, resolvePlanPrice, type PlanKey } from "@/lib/plans";
import { PRICING } from "@/lib/pricing";
import { LEGAL } from "@/lib/legal";

// Automatic-renewal terms shown directly above Stripe Checkout's Subscribe
// button — the point of consent, which is where auto-renewal laws want them.
// Read from lib/pricing.ts so the stated price can't drift from the charged one.
function renewalNotice(plan: PlanKey): string {
  const price: Record<PlanKey, string> = {
    member: `$${PRICING.member.monthly}/month`,
    member_annual: `$${PRICING.member.annual}/year`,
    founding: `$${PRICING.founding.monthly}/month`,
    partner: `$${PRICING.partner.monthly}/month`,
  };
  return (
    `Renews automatically at ${price[plan]} until you cancel. Cancel anytime in ` +
    "Settings; access continues to the end of the paid period. Payments are non-refundable."
  );
}

// POST — create a Stripe Checkout session for the standard (cold signup) flow.
// The client passes a plan KEY (member / member_annual / founding / partner);
// the price id is resolved server-side by lib/plans.ts, which also enforces
// founding-seat availability.
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { plan?: string; successUrl?: string; cancelUrl?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — we fall back to defaults below.
  }

  // Plan key, not a price id: the founding rate is a finite discounted pool, so
  // the browser must never get to name the price it pays.
  const plan = isPlanKey(body.plan) ? body.plan : "member";
  const resolved = await resolvePlanPrice(plan);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const priceId = resolved.priceId;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, stripe_customer_id")
    .eq("id", user.id)
    .single();

  const email = profile?.email || user.email;
  if (!email) return NextResponse.json({ error: "No email found" }, { status: 400 });

  try {
    const customerId = await getOrCreateStripeCustomer(
      user.id,
      email,
      profile?.full_name,
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: body.successUrl || `${appUrl}/home?upgraded=true`,
      cancel_url: body.cancelUrl || `${appUrl}/pricing?canceled=true`,
      metadata: { supabase_user_id: user.id, plan },
      subscription_data: { metadata: { supabase_user_id: user.id, plan } },
      allow_promotion_codes: true,
      // An explicit "I agree" checkbox. Stripe records it on the session as
      // consent.terms_of_service = "accepted", which is the proof of consent
      // California's automatic-renewal law requires (Cal. Bus. & Prof. Code
      // § 17602). Session creation errors unless a Terms of Service URL is set in
      // Stripe's public business details — added 2026-09-12.
      consent_collection: { terms_of_service: "required" },
      custom_text: {
        submit: { message: renewalNotice(plan) },
        terms_of_service_acceptance: {
          message:
            `I agree to the [Terms of Service](${LEGAL.site}/terms), including that my ` +
            "membership renews automatically until I cancel.",
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] failed to create session:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 },
    );
  }
}
