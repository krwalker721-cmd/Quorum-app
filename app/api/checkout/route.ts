import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/stripe-helpers";

// POST — create a Stripe Checkout session for the standard (cold signup) flow.
// The client may pass a priceId, but we default to STRIPE_MEMBER_PRICE_ID so the
// price never has to be exposed to the browser.
export async function POST(req: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { priceId?: string; successUrl?: string; cancelUrl?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — we fall back to defaults below.
  }

  const priceId = body.priceId || process.env.STRIPE_MEMBER_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "No price ID configured" }, { status: 400 });
  }

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
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },
      allow_promotion_codes: true,
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
