import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import type { PlanKey } from "@/lib/plans";

// GET — the member's billing summary for Settings → Billing: plan, price, the
// next (or first) charge date, card on file, discounts, and recent invoices.
//
// Read-only by design (LAUNCH.md §4c): Quorum shows billing, and every change —
// card, cancel, switch plan — still goes through Stripe's customer portal,
// which handles proration and failed-payment recovery.

const PLAN_LABEL: Record<PlanKey, string> = {
  member: "Member, monthly",
  member_annual: "Member, annual",
  founding: "Founding member",
  partner: "Partner",
};

type Invoice = {
  id: string;
  number: string | null;
  created: string;
  total: number;
  currency: string;
  status: string | null;
  url: string | null;
};

function planForPrice(priceId: string | undefined): PlanKey | null {
  if (!priceId) return null;
  const byEnv: [PlanKey, string | undefined][] = [
    ["member", process.env.STRIPE_MEMBER_PRICE_ID],
    ["member_annual", process.env.STRIPE_MEMBER_ANNUAL_PRICE_ID],
    ["founding", process.env.STRIPE_FOUNDING_PRICE_ID],
    ["partner", process.env.STRIPE_PARTNER_PRICE_ID],
  ];
  return byEnv.find(([, id]) => id && id === priceId)?.[0] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function discountLabel(d: any): string | null {
  const c = d?.coupon;
  if (!c) return null;
  const off =
    c.percent_off != null
      ? `${c.percent_off}% off`
      : c.amount_off != null
        ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: (c.currency ?? "usd").toUpperCase() }).format(c.amount_off / 100)} off`
        : null;
  const how =
    c.duration === "forever"
      ? "every charge"
      : c.duration === "repeating" && c.duration_in_months
        ? `for ${c.duration_in_months} ${c.duration_in_months === 1 ? "month" : "months"}`
        : c.duration === "once"
          ? "next charge"
          : null;
  const parts = [c.name, off && how ? `${off}, ${how}` : off].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// A customer or subscription Stripe doesn't know (deleted, or a test-mode key
// reading live ids in local dev) means there's nothing on file to show, not a
// failed page. Any other Stripe error still fails the request.
function isMissing(err: unknown): boolean {
  return (err as { code?: string })?.code === "resource_missing";
}

async function readSubscription(subscriptionId: string) {
  const s = (await stripe.subscriptions.retrieve(
    subscriptionId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expand: ["discounts", "default_payment_method"] } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any;

  const item = s.items?.data?.[0];
  const price = item?.price;
  const plan: PlanKey | null =
    typeof s.metadata?.plan === "string" && s.metadata.plan in PLAN_LABEL
      ? (s.metadata.plan as PlanKey)
      : planForPrice(price?.id);
  // Period dates moved onto items in newer API versions; read either.
  const periodEnd: number | null = s.current_period_end ?? item?.current_period_end ?? null;
  const card = typeof s.default_payment_method === "object" ? s.default_payment_method?.card : null;

  return {
    plan,
    planLabel: plan ? PLAN_LABEL[plan] : "Membership",
    amount: (price?.unit_amount as number | null) ?? null,
    currency: ((price?.currency as string | undefined) ?? "usd").toUpperCase(),
    interval: (price?.recurring?.interval as string | undefined) ?? null,
    status: s.status as string,
    trialEnd: s.trial_end ? new Date(s.trial_end * 1000).toISOString() : null,
    periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd: !!s.cancel_at_period_end,
    card: card ? { brand: card.brand as string, last4: card.last4 as string } : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discounts: ((s.discounts ?? []) as any[]).map(discountLabel).filter(Boolean) as string[],
  };
}

async function readInvoices(customerId: string): Promise<Invoice[]> {
  const list = await stripe.invoices.list({ customer: customerId, limit: 6 });
  return list.data.map((inv) => ({
    id: inv.id as string,
    number: inv.number,
    created: new Date(inv.created * 1000).toISOString(),
    total: inv.total,
    currency: inv.currency.toUpperCase(),
    status: inv.status,
    url: inv.hosted_invoice_url ?? null,
  }));
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // subscriptions rows aren't user-readable under RLS.
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId: string | null = row?.stripe_customer_id ?? null;
  const subscriptionId: string | null = row?.stripe_subscription_id ?? null;

  try {
    let subscription: Awaited<ReturnType<typeof readSubscription>> | null = null;
    if (subscriptionId) {
      try {
        subscription = await readSubscription(subscriptionId);
      } catch (err) {
        if (!isMissing(err)) throw err;
        console.warn("[billing] subscription not found in Stripe:", subscriptionId);
      }
    }

    let invoices: Invoice[] = [];
    if (customerId) {
      try {
        invoices = await readInvoices(customerId);
      } catch (err) {
        if (!isMissing(err)) throw err;
        console.warn("[billing] customer not found in Stripe:", customerId);
      }
    }

    return NextResponse.json({ subscription, invoices });
  } catch (err) {
    console.error("[billing] failed to read Stripe:", err);
    return NextResponse.json(
      { error: "Couldn't load billing details right now." },
      { status: 502 },
    );
  }
}
