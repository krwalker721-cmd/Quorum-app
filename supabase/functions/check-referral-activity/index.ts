// Scheduled daily (recommended: 0 2 * * * — 2am UTC).
// Marks active referrals inactive when the referred user hasn't been seen in
// 30 days, then recalculates the affected referrers' monthly bonus.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: staleReferrals } = await supabase
    .from("referrals")
    .select("id, referred_id, referrer_id")
    .eq("status", "active")
    .lt("last_seen_at", thirtyDaysAgo.toISOString());

  if (!staleReferrals?.length) {
    return new Response(JSON.stringify({ deactivated: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let deactivated = 0;
  for (const referral of staleReferrals) {
    await supabase
      .from("referrals")
      .update({ status: "inactive" })
      .eq("id", referral.id);

    await supabase.from("notifications").insert({
      user_id: referral.referrer_id,
      kind: "referral_inactive",
      type: "referral_inactive",
      message: "a referral is no longer active — your monthly bonus was recalculated",
      source_id: referral.referred_id,
      source_type: "referral",
      read: false,
    });

    deactivated++;
  }

  // Recalculate monthly bonuses for affected referrers.
  const affectedReferrers = [...new Set(staleReferrals.map((r) => r.referrer_id))];
  for (const referrerId of affectedReferrers) {
    const { count } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", referrerId)
      .eq("status", "active");

    // Retire old bonus, write a fresh one if still eligible.
    await supabase
      .from("referral_rewards")
      .update({ active: false })
      .eq("user_id", referrerId)
      .eq("reward_type", "monthly_bonus");

    const activeCount = count || 0;
    if (activeCount > 0) {
      await supabase.from("referral_rewards").insert({
        user_id: referrerId,
        reward_type: "monthly_bonus",
        milestone_count: activeCount,
        active: true,
      });
    }
  }

  return new Response(JSON.stringify({ deactivated }), {
    headers: { "Content-Type": "application/json" },
  });
});
