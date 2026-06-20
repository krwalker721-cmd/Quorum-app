import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTier, getCurrentMonth, type Tier } from "@/lib/stripe-helpers";

// GET — current month usage and the limits for the authenticated user's tier.
// A limit of -1 means uncapped.
const LIMITS: Record<Tier, Record<string, number>> = {
  free: {
    cohort_posts: 3,
    pulse_posts: 2,
    replies: 5,
    messages: 3,
    vault_notes: 1,
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

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getUserTier(user.id);
  const month = getCurrentMonth();

  const { data: usage } = await supabase
    .from("usage_tracking")
    .select("*")
    .eq("user_id", user.id)
    .eq("month", month)
    .maybeSingle();

  // Subscription status + trial info, used to gate caps and tailor the paywall.
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const status = subscription?.status || "trialing";
  // hadTrial: a trial existed and has already passed.
  const hadTrial = subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at) < new Date()
    : false;

  return NextResponse.json({
    tier,
    status,
    hadTrial,
    month,
    usage: {
      cohort_posts: usage?.cohort_posts || 0,
      pulse_posts: usage?.pulse_posts || 0,
      replies: usage?.replies || 0,
      messages: usage?.messages || 0,
      vault_notes: usage?.vault_notes || 0,
      collab_posts: usage?.collab_posts || 0,
    },
    limits: LIMITS[tier],
  });
}
