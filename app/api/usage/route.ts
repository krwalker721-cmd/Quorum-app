import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMonth } from "@/lib/stripe-helpers";
import { resolveEntitlement, type Tier } from "@/lib/entitlements";

// GET — what the authenticated account may do, plus this month's usage counters.
//
// `hasFullAccess` is the field callers should gate on. The older shape (tier,
// status, limits) is still returned for the nudge components that read counters,
// but deciding access from `tier` alone is what made a trialing account look
// capped: its tier is "free" because the trial needs no card.
//
// A limit of -1 means uncapped. Every write limit for an unentitled account is 0
// — there is no metered free rung, so "0 of 0 used" is never a useful thing to
// tell someone. `reason: "upgrade_required"` says what's actually true.
const LIMITS: Record<Tier, Record<string, number>> = {
  free: {
    cohort_posts: 0,
    pulse_posts: 0,
    replies: 0,
    messages: 0,
    vault_notes: 0,
    collab_posts: 0,
  },
  member: {
    cohort_posts: -1,
    pulse_posts: -1,
    replies: -1,
    messages: -1,
    vault_notes: -1,
    collab_posts: -1,
  },
  partner: {
    cohort_posts: -1,
    pulse_posts: -1,
    replies: -1,
    messages: -1,
    vault_notes: -1,
    collab_posts: -1,
  },
};

const UNCAPPED = LIMITS.member;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Reconcile before reporting a block: this endpoint is what the client uses to
  // decide whether to show a paywall, so a stale "free" here is a paying member
  // being nagged to buy what they already bought.
  const entitlement = await resolveEntitlement(user.id, { reconcileIfBlocked: true });
  const month = getCurrentMonth();

  const { data: usage } = await supabase
    .from("usage_tracking")
    .select("*")
    .eq("user_id", user.id)
    .eq("month", month)
    .maybeSingle();

  return NextResponse.json({
    tier: entitlement.tier,
    status: entitlement.status,
    hasFullAccess: entitlement.hasFullAccess,
    accessReason: entitlement.accessReason,
    isTrialing: entitlement.isTrialing,
    trialEndsAt: entitlement.trialEndsAt,
    daysLeftInTrial: entitlement.daysLeftInTrial,
    hadTrial: entitlement.hadTrial,
    reason: entitlement.hasFullAccess ? "entitled" : "upgrade_required",
    month,
    usage: {
      cohort_posts: usage?.cohort_posts || 0,
      pulse_posts: usage?.pulse_posts || 0,
      replies: usage?.replies || 0,
      messages: usage?.messages || 0,
      vault_notes: usage?.vault_notes || 0,
      collab_posts: usage?.collab_posts || 0,
    },
    // An active trial is uncapped, so it must not report the lapsed limits.
    limits: entitlement.hasFullAccess ? UNCAPPED : LIMITS[entitlement.tier],
  });
}
