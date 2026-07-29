import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  reconcileEntitlementFromStripe,
  resolveEntitlement,
} from "@/lib/entitlements";

// POST — force a Stripe → Supabase entitlement sync for the authenticated user.
//
// Exists for the moment right after checkout. Stripe redirects the browser back
// to /home the instant payment succeeds, which regularly beats the
// customer.subscription.created webhook; the member then lands on a UI that
// still says "free" and is still asking them to upgrade the thing they just
// bought. The client calls this on return, so the sync doesn't depend on webhook
// timing (or on the webhook arriving at all — in local development there's often
// no listener running).
//
// Unthrottled by design: it's user-initiated and idempotent.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let synced = false;
  try {
    // force also enables the customer search, so a purchase whose customer id
    // never made it into Supabase is still found.
    synced = await reconcileEntitlementFromStripe(user.id, { force: true });
  } catch (err) {
    console.error("[reconcile] failed:", err);
  }

  const entitlement = await resolveEntitlement(user.id);

  return NextResponse.json({
    synced,
    tier: entitlement.tier,
    status: entitlement.status,
    has_full_access: entitlement.hasFullAccess,
    access_reason: entitlement.accessReason,
    is_trialing: entitlement.isTrialing,
  });
}
