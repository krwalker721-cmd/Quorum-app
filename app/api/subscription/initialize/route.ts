import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { TRIAL_DAYS } from "@/lib/pricing";

// POST — initialize a trialing subscription the first time a user reaches
// onboarding. Referred users get a longer trial (the invitee half of the
// referral incentive), everyone else gets the standard length. Idempotent: once
// trial_ends_at is stamped we leave the existing subscription untouched.
//
// Subscription rows are not user-writable under RLS (only SELECT + service_role
// writes), so the upsert and the profile stamp both go through the admin client.
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Already initialized? Don't touch the trial clock.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, trial_ends_at, tier, stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Never downgrade someone who already pays. Anyone who checked out before
  // finishing onboarding has a real subscription and no trial date, and the
  // upsert below would have reset them to tier "free", status "trialing".
  const alreadyPaid =
    existing?.tier === "member" ||
    existing?.tier === "partner" ||
    !!existing?.stripe_subscription_id;

  if (existing?.trial_ends_at || alreadyPaid) {
    return NextResponse.json({ already_initialized: true });
  }

  // Referred users get a longer trial (their first month free).
  const { data: profile } = await admin
    .from("profiles")
    .select("referred_by")
    .eq("id", user.id)
    .maybeSingle();

  // Lengths come from lib/pricing.ts — the same constant the banner, the pricing
  // page, and the onboarding copy read. Hardcoding them here handed a
  // non-referred founder a 7-day trial while every screen promised 30.
  const isReferred = !!profile?.referred_by;
  const trialDays = isReferred ? TRIAL_DAYS.referred : TRIAL_DAYS.standard;
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

  await admin.from("subscriptions").upsert(
    {
      user_id: user.id,
      tier: "free",
      status: "trialing",
      trial_ends_at: trialEndsAt.toISOString(),
    },
    { onConflict: "user_id" },
  );

  await admin
    .from("profiles")
    .update({ trial_ends_at: trialEndsAt.toISOString() })
    .eq("id", user.id);

  return NextResponse.json({
    initialized: true,
    trial_ends_at: trialEndsAt.toISOString(),
    is_referred: isReferred,
  });
}
