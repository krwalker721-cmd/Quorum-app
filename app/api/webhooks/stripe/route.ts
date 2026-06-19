import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { syncSubscriptionToSupabase } from "@/lib/stripe-helpers";
import { createAdminClient } from "@/lib/supabase/server";

// Stripe signature verification needs the raw request body, so this handler must
// run on the Node runtime and read req.text() directly (no body parsing).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Notification copy keyed by event type. The notifications table predates this
// feature and has NOT NULL `kind` + `message` columns, so we always supply both
// alongside the newer `type` / `source_type` / `read` columns.
const NOTICE_COPY: Record<string, string> = {
  subscription_cancelled: "your subscription was canceled",
  payment_succeeded: "your payment went through",
  payment_failed: "your payment failed — please update your card",
  trial_ending: "your trial ends soon",
};

async function notify(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  type: keyof typeof NOTICE_COPY,
) {
  await supabase.from("notifications").insert({
    user_id: userId,
    kind: type,
    type,
    message: NOTICE_COPY[type],
    source_type: "system",
    read: false,
  });
}

async function userIdForCustomer(customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer) return null;
  return customer.metadata?.supabase_user_id ?? null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = headers().get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await syncSubscriptionToSupabase(event.data.object);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = await userIdForCustomer(subscription.customer as string);
        if (!userId) break;

        await supabase
          .from("subscriptions")
          .update({ tier: "free", status: "canceled", stripe_subscription_id: null })
          .eq("user_id", userId);

        await supabase.from("profiles").update({ tier: "free" }).eq("id", userId);

        await notify(supabase, userId, "subscription_cancelled");
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | null;
        };
        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string,
        );
        await syncSubscriptionToSupabase(subscription);

        const userId = await userIdForCustomer(invoice.customer as string);
        if (!userId) break;
        await notify(supabase, userId, "payment_succeeded");
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await userIdForCustomer(invoice.customer as string);
        if (!userId) break;

        await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("user_id", userId);

        await notify(supabase, userId, "payment_failed");
        break;
      }

      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object;
        const userId = await userIdForCustomer(subscription.customer as string);
        if (!userId) break;
        await notify(supabase, userId, "trial_ending");
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
