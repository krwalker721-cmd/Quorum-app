import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Find this user's Stripe customer. Checks the two places we store the id, then
 * falls back to searching Stripe by the `supabase_user_id` metadata that
 * getOrCreateStripeCustomer stamps on every customer it creates — the case that
 * most needs cleanup is the one where the local id write was lost.
 */
async function findStripeCustomerId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const [{ data: sub }, { data: profile }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const stored = sub?.stripe_customer_id || profile?.stripe_customer_id || null;
  if (stored) return stored;

  try {
    const res = await stripe.customers.search({
      query: `metadata['supabase_user_id']:'${userId}'`,
      limit: 1,
    });
    return res.data[0]?.id ?? null;
  } catch (err) {
    // Search is index-backed and lags creation by up to a minute, and isn't
    // enabled on every account. Treat as "not found" — the caller decides.
    console.error("[account/delete] customer search failed:", err);
    return null;
  }
}

// POST — permanently delete the authenticated user's account.
//
// Billing is torn down BEFORE the account, and a Stripe failure aborts the whole
// thing. That ordering is the entire point: this route used to delete the auth
// user and profile while leaving the subscription live, so the card kept being
// charged every month and the person no longer had an account to cancel from.
// Deleting first and failing second is unrecoverable — nothing would be left
// linking that Stripe customer to anyone.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // --- 1. tear down billing -------------------------------------------------
  const customerId = await findStripeCustomerId(admin, user.id);

  if (customerId) {
    try {
      const { data: subscriptions } = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });

      // Cancel immediately rather than at period end — the account is going away
      // now, so there is nothing left to serve the rest of the period for.
      for (const sub of subscriptions) {
        if (sub.status === "canceled" || sub.status === "incomplete_expired") continue;
        await stripe.subscriptions.cancel(sub.id, {
          invoice_now: false,
          prorate: false,
        });
      }

      // Remove the customer so the stored card and personal details go with the
      // account. Stripe retains past invoices for its own compliance reasons,
      // which is what we want for bookkeeping.
      await stripe.customers.del(customerId);
    } catch (err) {
      console.error("[account/delete] Stripe teardown failed:", err);
      return NextResponse.json(
        {
          error:
            "Could not cancel your subscription, so nothing was deleted. " +
            "Please try again, or contact support — we won't remove your " +
            "account while billing is still active.",
        },
        { status: 502 },
      );
    }
  }

  // --- 2. delete the account ------------------------------------------------
  // Drop the profile row explicitly first (cascades to most child rows). If the
  // schema already cascades from auth.users this is a harmless no-op.
  try {
    await admin.from("profiles").delete().eq("id", user.id);
  } catch (e) {
    console.error("account delete — profile cleanup failed:", e);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("account delete — auth deletion failed:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  // Clear the session cookie on the way out.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
