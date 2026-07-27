import { createAdminClient } from "@/lib/supabase/server";
import { FOUNDING_SEATS } from "@/lib/pricing";

// Server-side plan → Stripe price resolution.
//
// Checkout takes a plan KEY from the client, never a price id. The founding rate
// is a real discount against a finite pool of seats, so letting the browser name
// its own price would let anyone claim it — and claim it after the pool closed.

export type PlanKey = "member" | "member_annual" | "founding" | "partner";

const PLAN_ENV: Record<PlanKey, string> = {
  member: "STRIPE_MEMBER_PRICE_ID",
  member_annual: "STRIPE_MEMBER_ANNUAL_PRICE_ID",
  founding: "STRIPE_FOUNDING_PRICE_ID",
  partner: "STRIPE_PARTNER_PRICE_ID",
};

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === "string" && v in PLAN_ENV;
}

/** How many founding seats remain. Never negative. */
export async function foundingSeatsRemaining(): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_founding_member", true);
  return Math.max(0, FOUNDING_SEATS - (count || 0));
}

/**
 * Resolve a plan to its Stripe price id, enforcing eligibility. Returns an error
 * string rather than throwing so the route can answer with a clean 4xx.
 */
export async function resolvePlanPrice(
  plan: PlanKey,
): Promise<{ priceId: string } | { error: string }> {
  if (plan === "founding") {
    const remaining = await foundingSeatsRemaining();
    if (remaining <= 0) {
      return { error: "Founding seats are gone — Member is the current rate." };
    }
  }

  const priceId = process.env[PLAN_ENV[plan]];
  if (!priceId) return { error: `No price configured for plan: ${plan}` };
  return { priceId };
}

/**
 * Stamp a member as founding at the moment their subscription starts. Racy by
 * nature (two checkouts can complete on the last seat), so it re-checks under
 * the current count and the unique index on founding_member_number is the final
 * arbiter.
 */
export async function claimFoundingSeat(userId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("is_founding_member")
    .eq("id", userId)
    .maybeSingle();
  if (existing?.is_founding_member) return true;

  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_founding_member", true);

  const taken = count || 0;
  if (taken >= FOUNDING_SEATS) return false;

  const { error } = await supabase
    .from("profiles")
    .update({ is_founding_member: true, founding_member_number: taken + 1 })
    .eq("id", userId);

  return !error;
}
