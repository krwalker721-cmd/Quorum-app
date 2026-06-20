import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// POST — initialize a trialing subscription the first time a user reaches
// onboarding. Referred users get a 30-day trial (their free month), everyone
// else gets the standard 7 days. Idempotent: once trial_ends_at is stamped we
// leave the existing subscription untouched.
//
// Subscription rows are not user-writable under RLS (only SELECT + service_role
// writes), so the upsert and the profile stamp both go through the admin client.
export async function POST() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Already initialized? Don't touch the trial clock.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, trial_ends_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.trial_ends_at) {
    return NextResponse.json({ already_initialized: true });
  }

  // Referred users get a longer trial (their first month free).
  const { data: profile } = await admin
    .from("profiles")
    .select("referred_by")
    .eq("id", user.id)
    .maybeSingle();

  const isReferred = !!profile?.referred_by;
  const trialDays = isReferred ? 30 : 7;
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
