import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";
import { applyMilestoneReward } from "@/lib/referral-helpers";

// GET — platform-wide referral overview for the admin Referrals section:
// status counts, top referrers, and recent referral records.
export async function GET(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: referrals } = await admin
    .from("referrals")
    .select("id, referrer_id, referred_id, status, activated_at, last_seen_at, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows = referrals ?? [];

  const totals = {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    pending: rows.filter((r) => r.status === "pending").length,
    inactive: rows.filter((r) => r.status === "inactive").length,
    churned: rows.filter((r) => r.status === "churned").length,
  };

  // Names for everyone involved.
  const ids = [
    ...new Set([
      ...rows.map((r) => r.referrer_id),
      ...rows.map((r) => r.referred_id),
    ]),
  ];
  const nameMap = new Map<string, { username: string | null; full_name: string | null }>();
  if (ids.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username, full_name")
      .in("id", ids);
    (profiles ?? []).forEach((p) =>
      nameMap.set(p.id, { username: p.username, full_name: p.full_name }),
    );
  }

  // Reward counts per referrer (active rewards only).
  const { data: rewards } = await admin
    .from("referral_rewards")
    .select("user_id, reward_type, active");
  const rewardCount = new Map<string, number>();
  (rewards ?? [])
    .filter((r) => r.active)
    .forEach((r) =>
      rewardCount.set(r.user_id, (rewardCount.get(r.user_id) ?? 0) + 1),
    );

  // Aggregate per referrer for the leaderboard.
  const byReferrer = new Map<
    string,
    { total: number; active: number }
  >();
  for (const r of rows) {
    const agg = byReferrer.get(r.referrer_id) ?? { total: 0, active: 0 };
    if (r.status !== "churned") agg.total++;
    if (r.status === "active") agg.active++;
    byReferrer.set(r.referrer_id, agg);
  }

  const topReferrers = [...byReferrer.entries()]
    .map(([userId, agg]) => ({
      user_id: userId,
      username: nameMap.get(userId)?.username ?? null,
      full_name: nameMap.get(userId)?.full_name ?? null,
      total_referrals: agg.total,
      active_referrals: agg.active,
      rewards_granted: rewardCount.get(userId) ?? 0,
    }))
    .sort((a, b) => b.total_referrals - a.total_referrals)
    .slice(0, 50);

  const records = rows.slice(0, 200).map((r) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    activated_at: r.activated_at,
    last_seen_at: r.last_seen_at,
    referrer: nameMap.get(r.referrer_id) ?? null,
    referrer_id: r.referrer_id,
    referred: nameMap.get(r.referred_id) ?? null,
    referred_id: r.referred_id,
  }));

  return NextResponse.json({ totals, topReferrers, records });
}

// POST — manually grant a milestone reward to a user. Lets an admin apply
// rewards before the Stripe automation lands (Session 9).
const MILESTONE_COUNTS: Record<string, number> = {
  milestone_1: 1,
  milestone_3: 3,
  milestone_5: 5,
  milestone_10: 10,
  milestone_25: 25,
};

export async function POST(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }

  const { user_id, reward_type } = await req.json().catch(() => ({}));
  if (!user_id || typeof user_id !== "string") {
    return NextResponse.json({ error: "missing user_id" }, { status: 400 });
  }
  if (!reward_type || !(reward_type in MILESTONE_COUNTS)) {
    return NextResponse.json({ error: "invalid reward_type" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Don't double-grant a lifetime milestone.
  const { data: existing } = await admin
    .from("referral_rewards")
    .select("id")
    .eq("user_id", user_id)
    .eq("reward_type", reward_type)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: false, reason: "already granted" });
  }

  await applyMilestoneReward(
    user_id,
    reward_type as Parameters<typeof applyMilestoneReward>[1],
    MILESTONE_COUNTS[reward_type],
  );

  return NextResponse.json({ ok: true });
}
