// The landing page's countdown relay (Phase 11): which ONE message the public
// landing page shows, from the admin's standalone countdowns (site_countdowns)
// and each Sprint's landing switch. Pure, so the server, the browser and the
// admin console all pick the same message. The data comes from
// lib/landingRelayData.ts and /api/countdowns/landing; nothing in it is
// sealed (migration 033: never the theme, never team content, never ids).

export type RelaySite = {
  key: string;
  label: string;
  subtext: string | null;
  target_at: string;
  zero_behavior: "hide" | "show_message";
  zero_message: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

export type RelaySprint = {
  number: number;
  title: string;
  tagline: string | null;
  headline: string | null;
  registration_opens_at: string;
  team_lock_at: string;
  starts_at: string;
  ends_at: string;
  reveal_at: string;
  state: string;
  phase: string;
  on_landing: boolean;
  teams: number;
  builders: number;
};

export type RelayData = { site: RelaySite[]; sprints: RelaySprint[] };

export type RelayItem = {
  /** Stable per message, so the card doesn't remount on every refresh. */
  id: string;
  title: string;
  sub: string | null;
  /** The digits' label ("Ends in"), shown before them. */
  countLabel: string | null;
  target: number | null;
  message: string | null;
  cta: { label: string; href: string; primary: boolean } | null;
  live: boolean;
};

export const SPRINT_LINE = "48 hours. New ideas. Teams across every cohort.";

/**
 * Where a Sprint stands at `now`, from its own times (so the relay moves on at
 * each boundary without waiting for fresh data). Paused stays paused: its
 * clock stopped, and only the admin moves it.
 */
export function relayPhase(s: RelaySprint, now: number): string {
  if (s.state === "paused") return "paused";
  const at = (v: string) => Date.parse(v);
  if (now < at(s.registration_opens_at)) return "upcoming";
  if (now < at(s.team_lock_at)) return "registration";
  if (now < at(s.starts_at)) return "teams_locked";
  if (now < at(s.ends_at)) return "live";
  if (now < at(s.reveal_at)) return "judging";
  return "revealed";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The relay's message at `now`, in the owner's order, skipping anything
 * switched off: a standalone countdown; a Sprint about to start; a live
 * Sprint (then one being judged, or paused); the latest recap until a newer
 * Sprint is announced. Null when nothing applies: the page shows nothing.
 */
export function pickRelay(data: RelayData, now: number, waitlistOn: boolean): RelayItem | null {
  const join = { label: waitlistOn ? "Request an invite" : "Start your free trial", href: "/signup", primary: true };

  // 1. Standalone countdowns: the soonest still ahead; else the latest past
  //    zero that shows a message. One set to hide at zero just drops out.
  const ahead = data.site.filter((c) => Date.parse(c.target_at) > now).sort((a, b) => Date.parse(a.target_at) - Date.parse(b.target_at));
  const done = data.site
    .filter((c) => Date.parse(c.target_at) <= now && c.zero_behavior === "show_message")
    .sort((a, b) => Date.parse(b.target_at) - Date.parse(a.target_at));
  const site = ahead[0] ?? done[0];
  if (site) {
    const cta = site.cta_label && site.cta_url ? { label: site.cta_label, href: site.cta_url, primary: true } : null;
    const reached = Date.parse(site.target_at) <= now;
    return {
      id: `site-${site.key}`,
      title: site.label,
      sub: site.subtext,
      countLabel: null,
      target: reached ? null : Date.parse(site.target_at),
      message: reached ? site.zero_message : null,
      cta,
      live: false,
    };
  }

  const phase = new Map(data.sprints.map((s) => [s.number, relayPhase(s, now)]));
  const shown = data.sprints.filter((s) => s.on_landing);

  // 2. A Sprint about to start (the soonest kickoff).
  const next = shown
    .filter((s) => ["upcoming", "registration", "teams_locked"].includes(phase.get(s.number)!))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  if (next) {
    return {
      id: `sprint-${next.number}-next`,
      title: next.headline || `Buildathon #${next.number} kicks off in`,
      sub:
        phase.get(next.number) === "registration"
          ? `${SPRINT_LINE} Registration is open.`
          : phase.get(next.number) === "teams_locked"
            ? `${SPRINT_LINE} Teams are set.`
            : SPRINT_LINE,
      countLabel: next.headline ? "Kicks off in" : null,
      target: Date.parse(next.starts_at),
      message: null,
      cta: join,
      live: false,
    };
  }

  // 3. Live (until its deadline), then being judged, then paused.
  const live = shown.find((s) => phase.get(s.number) === "live");
  if (live) {
    return {
      id: `sprint-${live.number}-live`,
      title: live.headline || `Buildathon #${live.number} is LIVE`,
      sub: `${plural(live.teams, "team", "teams")} building right now.`,
      countLabel: "Ends in",
      target: Date.parse(live.ends_at),
      message: null,
      cta: { ...join, label: "Want in on the next one?", primary: false },
      live: true,
    };
  }
  const judging = shown.find((s) => phase.get(s.number) === "judging");
  if (judging) {
    return {
      id: `sprint-${judging.number}-judging`,
      title: `Buildathon #${judging.number} wrapped: ${plural(judging.teams, "team", "teams")}, ${plural(judging.builders, "builder", "builders")}.`,
      sub: null,
      countLabel: "Results revealed in",
      target: Date.parse(judging.reveal_at),
      message: null,
      cta: null,
      live: false,
    };
  }
  const paused = shown.find((s) => phase.get(s.number) === "paused" && s.phase !== "revealed");
  if (paused) {
    return {
      id: `sprint-${paused.number}-paused`,
      title: `Buildathon #${paused.number} is paused`,
      sub: null,
      countLabel: null,
      target: null,
      message: "New times soon.",
      cta: null,
      live: false,
    };
  }

  // 4. The latest recap, until a newer Sprint is announced (published, any switch).
  const revealed = data.sprints
    .filter((s) => phase.get(s.number) === "revealed" || (phase.get(s.number) === "paused" && s.phase === "revealed"))
    .sort((a, b) => b.number - a.number)[0];
  if (revealed && revealed.on_landing) {
    const announced = data.sprints.some((s) => s.number > revealed.number && phase.get(s.number) !== "revealed");
    if (!announced) {
      return {
        id: `sprint-${revealed.number}-recap`,
        title: `See what founders built at Buildathon #${revealed.number}`,
        sub: revealed.tagline ? `${revealed.title}: ${revealed.tagline}` : revealed.title,
        countLabel: null,
        target: null,
        message: null,
        cta: { label: "See the projects", href: `/hackathon/${revealed.number}/recap`, primary: false },
        live: false,
      };
    }
  }
  return null;
}
