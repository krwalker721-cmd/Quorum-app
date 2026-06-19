import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/stripe-helpers";

// POST — create a SetupIntent so a referred user can save a card without being
// charged. The SetupIntent is created on demand (when the user clicks "claim"),
// not on page load, to avoid wasting API calls.
export async function POST() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
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

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: { supabase_user_id: user.id },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId,
    });
  } catch (err) {
    console.error("[setup-intent] failed to create SetupIntent:", err);
    return NextResponse.json(
      { error: "Could not start card setup. Please try again." },
      { status: 500 },
    );
  }
}

// PUT — called after the SetupIntent succeeds client-side. Attaches the saved
// card, then creates the Member subscription with a 30-day trial (the referred
// free month). The trial means $0 for month 1, $49 automatic on day 31.
export async function PUT(req: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { paymentMethodId, customerId } = (await req.json()) as {
    paymentMethodId?: string;
    customerId?: string;
  };

  if (!paymentMethodId || !customerId) {
    return NextResponse.json(
      { error: "Missing payment method or customer" },
      { status: 400 },
    );
  }

  const priceId = process.env.STRIPE_MEMBER_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "No price ID configured" }, { status: 400 });
  }

  try {
    // Attach the card and make it the default for future invoices.
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const trialEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_end: trialEnd,
      default_payment_method: paymentMethodId,
      metadata: { supabase_user_id: user.id },
    });

    // Persist with the service-role client so the write bypasses RLS, matching
    // the rest of the payments stack.
    const admin = createAdminClient();
    await admin
      .from("subscriptions")
      .update({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        status: "trialing",
        tier: "member",
        trial_ends_at: new Date(trialEnd * 1000).toISOString(),
        referred_free_month_expires_at: null, // offer claimed
      })
      .eq("user_id", user.id);

    await admin.from("profiles").update({ tier: "member" }).eq("id", user.id);

    return NextResponse.json({ success: true, subscriptionId: subscription.id });
  } catch (err) {
    console.error("[setup-intent] failed to create subscription:", err);
    return NextResponse.json(
      { error: "Could not activate your free month. Please try again." },
      { status: 500 },
    );
  }
}
