import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

// GET — list all users joined with their subscription record, for the admin
// Subscriptions section. Returns one row per profile (subscription may be null
// for users who never had one initialized).
export async function GET(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, username, full_name, email, tier, trial_ends_at, stripe_customer_id")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (profiles ?? []).map((p) => p.id);
  const subMap = new Map<string, Record<string, unknown>>();
  if (ids.length) {
    const { data: subs } = await admin
      .from("subscriptions")
      .select(
        "user_id, status, tier, trial_ends_at, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id",
      )
      .in("user_id", ids);
    (subs ?? []).forEach((s) => subMap.set(s.user_id as string, s));
  }

  const rows = (profiles ?? []).map((p) => {
    const sub = subMap.get(p.id);
    return {
      user_id: p.id,
      username: p.username,
      full_name: p.full_name,
      email: p.email,
      tier: p.tier ?? "free",
      status: (sub?.status as string) ?? "trialing",
      trial_ends_at: (sub?.trial_ends_at as string) ?? p.trial_ends_at ?? null,
      current_period_end: (sub?.current_period_end as string) ?? null,
      cancel_at_period_end: (sub?.cancel_at_period_end as boolean) ?? false,
      stripe_customer_id:
        (sub?.stripe_customer_id as string) ?? p.stripe_customer_id ?? null,
      has_stripe_subscription: !!sub?.stripe_subscription_id,
    };
  });

  return NextResponse.json({ subscriptions: rows });
}
