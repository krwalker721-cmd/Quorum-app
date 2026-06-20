// Scheduled daily (recommended: 0 10 * * * — 10am UTC).
// Notifies referrers when a referred user has been pending for 24+ hours
// without adding a card. Sends at most one nudge per referral.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const { data: pendingReferrals } = await supabase
    .from("referrals")
    .select("id, referrer_id, referred_id, created_at")
    .eq("status", "pending")
    .lt("created_at", twentyFourHoursAgo.toISOString());

  if (!pendingReferrals?.length) {
    return new Response(JSON.stringify({ nudged: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let nudged = 0;
  for (const referral of pendingReferrals) {
    // Only nudge once per referral.
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", referral.referrer_id)
      .eq("type", "referral_nudge")
      .eq("source_id", referral.referred_id);

    if ((count || 0) === 0) {
      await supabase.from("notifications").insert({
        user_id: referral.referrer_id,
        kind: "referral_nudge",
        type: "referral_nudge",
        message:
          "a referral hasn't activated yet — they have 24 hours to claim their free month",
        source_id: referral.referred_id,
        source_type: "referral",
        read: false,
      });
      nudged++;
    }
  }

  return new Response(JSON.stringify({ nudged }), {
    headers: { "Content-Type": "application/json" },
  });
});
