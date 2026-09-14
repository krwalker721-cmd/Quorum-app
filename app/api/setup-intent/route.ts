import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/stripe-helpers";
import { PRICING } from "@/lib/pricing";
import { LEGAL } from "@/lib/legal";
import { isPlanKey, resolvePlanPrice, type PlanKey } from "@/lib/plans";

// Plans this card path can start, and the price each one names in the consent
// record. Partner isn't offered here.
type CardPlan = Exclude<PlanKey, "partner">;
const CARD_PLAN_PRICE: Record<CardPlan, string> = {
  member: `$${PRICING.member.monthly}/month`,
  member_annual: `$${PRICING.member.annual}/year`,
  founding: `$${PRICING.founding.monthly}/month`,
};

function isCardPlan(v: unknown): v is CardPlan {
  return isPlanKey(v) && v !== "partner";
}

// POST — create a SetupIntent so a referred user can save a card without being
// charged. The SetupIntent is created on demand (when the user clicks "claim"),
// not on page load, to avoid wasting API calls.
export async function POST() {
  const supabase = await createClient();

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
// card, then creates the Member subscription that starts billing when the
// user's *existing* trial ends. The trial clock is granted up front by
// /api/subscription/initialize (30 days normally, 45 for a referred founder),
// so we honour the date the user has already been shown rather than starting a
// second, different countdown here.
export async function PUT(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { paymentMethodId, customerId, renewalConsent, plan: rawPlan } = (await req.json()) as {
    paymentMethodId?: string;
    customerId?: string;
    renewalConsent?: boolean;
    plan?: string;
  };

  // A plan KEY, resolved to a price server-side exactly as /api/checkout does,
  // so what's charged always matches the plan named in the consent text. This
  // route used to hardcode STRIPE_MEMBER_PRICE_ID whatever plan was chosen.
  // No plan means Member (the referred free-month form); a plan this path
  // doesn't offer (Partner) is refused rather than quietly swapped for Member.
  if (rawPlan !== undefined && !isCardPlan(rawPlan)) {
    return NextResponse.json({ error: "That plan isn't available here." }, { status: 400 });
  }
  const plan: CardPlan = rawPlan ?? "member";

  if (!paymentMethodId || !customerId) {
    return NextResponse.json(
      { error: "Missing payment method or customer" },
      { status: 400 },
    );
  }

  // Automatic-renewal laws (Cal. Bus. & Prof. Code § 17602; 940 CMR 38.05) need
  // the member's affirmative consent to the renewal terms before a trial can turn
  // into a charge, and California requires keeping proof of it. The CardForm
  // checkbox is that consent; it's stamped onto the Stripe subscription below,
  // where the record outlives anything that happens to our own database.
  if (renewalConsent !== true) {
    return NextResponse.json(
      { error: "Please agree to the renewal terms to continue." },
      { status: 400 },
    );
  }

  // Enforces founding-seat availability too. The seat itself is claimed by the
  // webhook when the subscription is created (metadata.plan === "founding").
  const resolved = await resolvePlanPrice(plan);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const priceId = resolved.priceId;

  try {
    // Attach the card and make it the default for future invoices.
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Persist with the service-role client so reads/writes bypass RLS, matching
    // the rest of the payments stack.
    const admin = createAdminClient();

    const { data: existingSub } = await admin
      .from("subscriptions")
      .select("trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const nowSec = Math.floor(Date.now() / 1000);
    const storedEnd = existingSub?.trial_ends_at
      ? Math.floor(new Date(existingSub.trial_ends_at).getTime() / 1000)
      : 0;
    // Stripe rejects a trial_end less than 48h out, so a trial in its last two
    // days is nudged to the floor rather than failing the whole activation.
    const floorEnd = nowSec + 48 * 60 * 60;
    const trialEnd = Math.max(storedEnd || nowSec + 7 * 24 * 60 * 60, floorEnd);

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_end: trialEnd,
      default_payment_method: paymentMethodId,
      metadata: {
        supabase_user_id: user.id,
        // Read by the webhook (founding seat) and the billing summary.
        plan,
        renewal_consent_at: new Date().toISOString(),
        renewal_consent_terms:
          `Free until trial end, then ${CARD_PLAN_PRICE[plan]}, renewing until ` +
          `cancelled. Terms of Service effective ${LEGAL.effectiveDate}.`,
      },
    });

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
      { error: "Could not save your card. Please try again." },
      { status: 500 },
    );
  }
}
