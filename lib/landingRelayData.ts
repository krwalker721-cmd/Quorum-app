import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import type { RelayData, RelaySite, RelaySprint } from "@/lib/landingRelay";

// Server only. The relay's data: enabled standalone countdowns switched on
// for the landing page (their public fields only), and the Sprints from
// hackathon_landing_relay() (migration 033: no theme, no team content, no
// ids). Anything that fails reads as empty, so the landing page always
// renders: with nothing to show, the relay shows nothing.

export async function fetchLandingRelayData(): Promise<RelayData> {
  const db = createAdminClient();
  const [site, sprints] = await Promise.all([
    db
      .from("site_countdowns")
      .select("key, label, subtext, target_at, zero_behavior, zero_message, cta_label, cta_url")
      .eq("is_enabled", true)
      .eq("show_on_landing", true),
    db.rpc("hackathon_landing_relay"),
  ]);
  return {
    site: ((site.error ? [] : site.data) ?? []) as RelaySite[],
    sprints: ((sprints.error ? [] : sprints.data) ?? []) as RelaySprint[],
  };
}

/**
 * For rendering the landing page: the same data, shared across visitors for
 * 30 seconds, so a busy landing page doesn't ask the database on every visit.
 * An admin's change shows within about a minute (this, then the page's own
 * 30-second re-check of /api/countdowns/landing).
 */
export const getLandingRelayData = unstable_cache(
  async () => {
    try {
      return await fetchLandingRelayData();
    } catch {
      return { site: [], sprints: [] } satisfies RelayData;
    }
  },
  ["landing-relay-v1"],
  { revalidate: 30 },
);
