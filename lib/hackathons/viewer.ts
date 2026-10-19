import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEntitlement } from "@/lib/entitlements";

/**
 * The signed-in member's standing for the Hackathon pages: admin, and whether
 * they're an active member (trial included), from lib/entitlements.ts like the
 * rest of the app. The layout has already healed a missed webhook this page
 * load, so this doesn't ask Stripe again.
 */
export async function getMemberStanding(
  db: SupabaseClient,
  userId: string,
): Promise<{ tier: string; isAdmin: boolean; isActive: boolean }> {
  const [{ data: profile }, entitlement] = await Promise.all([
    db.from("profiles").select("tier, is_admin").eq("id", userId).maybeSingle(),
    resolveEntitlement(userId).catch(() => null),
  ]);
  return {
    tier: ((profile?.tier as string | null) ?? "free").toUpperCase(),
    isAdmin: Boolean(profile?.is_admin),
    isActive: entitlement?.hasFullAccess ?? false,
  };
}
