// Supabase Edge Function — downgrade users whose free trial has expired and who
// never added a card (no Stripe subscription). Schedule hourly: cron "0 * * * *".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();

  const { data: expiredTrials } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("status", "trialing")
    .is("stripe_subscription_id", null)
    .lt("trial_ends_at", now);

  if (!expiredTrials?.length) {
    return new Response(JSON.stringify({ expired: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  for (const { user_id } of expiredTrials) {
    // The account stays active but reverts to free-tier caps.
    await supabase
      .from("subscriptions")
      .update({ status: "active", tier: "free" })
      .eq("user_id", user_id);

    await supabase.from("profiles").update({ tier: "free" }).eq("id", user_id);

    await supabase.from("notifications").insert({
      user_id,
      kind: "trial_expired",
      type: "trial_expired",
      message: "your free trial has ended — you're now on the free plan",
      source_type: "system",
      read: false,
    });
  }

  return new Response(JSON.stringify({ expired: expiredTrials.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
