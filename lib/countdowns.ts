import { createAdminClient } from "@/lib/supabase/server";

// Every countdown a visitor might see: standalone ones (site_countdowns, e.g.
// the launch) and Sprint ones (a published Sprint counting to its own next
// milestone). Everything here is safe to show signed out; it's what the
// landing strip, the in-app bar and /api/countdowns serve.

export type Placement = "landing" | "app";

export type SiteCountdown = {
  kind: "site";
  id: string;
  key: string;
  label: string;
  subtext: string | null;
  target_at: string;
  zero_behavior: "hide" | "show_message";
  zero_message: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

export type SprintCountdown = {
  kind: "sprint";
  id: string;
  number: number;
  title: string;
  headline: string | null;
  registration_opens_at: string;
  starts_at: string;
  ends_at: string;
  reveal_at: string;
  status_override: "paused" | "cancelled" | null;
};

export type PublicCountdown = SiteCountdown | SprintCountdown;

/**
 * The countdowns to show in one place, soonest first. A standalone countdown
 * set to hide at zero drops out once it's past; a Sprint drops out once it's
 * revealed or cancelled. Reaching zero never changes anything else: opening
 * signups stays a deliberate admin action.
 */
export async function getPublicCountdowns(where: Placement): Promise<PublicCountdown[]> {
  const db = createAdminClient();
  const now = new Date().toISOString();

  const [site, sprints] = await Promise.all([
    db
      .from("site_countdowns")
      .select("id, key, label, subtext, target_at, zero_behavior, zero_message, cta_label, cta_url")
      .eq("is_enabled", true)
      .eq(where === "landing" ? "show_on_landing" : "show_in_app", true)
      .order("target_at"),
    db
      .from("hackathons")
      .select("id, number, title, countdown_headline_override, registration_opens_at, starts_at, ends_at, reveal_at, status_override")
      .eq("is_published", true)
      .eq(where === "landing" ? "show_countdown_on_landing" : "show_countdown_in_app", true)
      .gt("reveal_at", now)
      .order("starts_at"),
  ]);

  const siteItems: PublicCountdown[] = (site.data ?? [])
    .filter((c) => c.zero_behavior === "show_message" || c.target_at > now)
    .map((c) => ({ kind: "site", ...c }) as SiteCountdown);

  const sprintItems: PublicCountdown[] = (sprints.data ?? [])
    .filter((s) => s.status_override !== "cancelled")
    .map((s) => ({
      kind: "sprint",
      id: s.id,
      number: s.number,
      title: s.title,
      headline: s.countdown_headline_override,
      registration_opens_at: s.registration_opens_at,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      reveal_at: s.reveal_at,
      status_override: s.status_override,
    }));

  return [...siteItems, ...sprintItems];
}
