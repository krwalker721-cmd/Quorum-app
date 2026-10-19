import type { MemberActivity } from "@/lib/hackathons/room";

// "Hasn't been active in a while", softly, so a teammate who has dropped off
// shows early (Phase 6). Only waking time counts:
//   * 11 pm – 7 am in the teammate's own time zone never counts (their browser
//     reports the zone when they open the room; unknown means it all counts);
//   * time they marked "Sleeping until…" doesn't either: quiet time starts
//     again when that sleep ends.
// Three waking hours without a contribution (message, doc, link, vote) flags
// them. Nothing here is stored; the room works it out on the server's clock.

export const QUIET_AFTER_WAKING_MS = 3 * 60 * 60_000;
export const NIGHT_STARTS_HOUR = 23;
export const NIGHT_ENDS_HOUR = 7;
const STEP_MS = 15 * 60_000;

const hourFormats = new Map<string, Intl.DateTimeFormat | null>();

function hourFormat(tz: string): Intl.DateTimeFormat | null {
  if (!hourFormats.has(tz)) {
    try {
      hourFormats.set(tz, new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }));
    } catch {
      hourFormats.set(tz, null);
    }
  }
  return hourFormats.get(tz)!;
}

/** The hour of day (0–23) at `ms` in `tz`, or null if the zone is unknown. */
export function localHour(ms: number, tz: string | null): number | null {
  const f = tz ? hourFormat(tz) : null;
  if (!f) return null;
  const h = Number(f.formatToParts(ms).find((p) => p.type === "hour")?.value);
  return Number.isFinite(h) ? h % 24 : null;
}

export function isNight(ms: number, tz: string | null): boolean {
  const h = localHour(ms, tz);
  return h !== null && (h >= NIGHT_STARTS_HOUR || h < NIGHT_ENDS_HOUR);
}

/** Time between two moments that isn't night where the person is (to 15 minutes). */
export function wakingMs(fromMs: number, toMs: number, tz: string | null): number {
  if (toMs <= fromMs) return 0;
  if (!tz || !hourFormat(tz)) return toMs - fromMs;
  let total = 0;
  for (let t = fromMs; t < toMs; t += STEP_MS) {
    const slice = Math.min(STEP_MS, toMs - t);
    if (!isNight(t + slice / 2, tz)) total += slice;
  }
  return total;
}

export type QuietState =
  | { kind: "asleep"; until: number }
  | { kind: "night" }
  | { kind: "quiet"; sinceMs: number }
  | { kind: "fine" };

/**
 * Where a teammate stands while the Sprint is live. `startsAt` is kickoff:
 * nobody is quiet for not posting before it.
 */
export function quietState(a: MemberActivity | undefined, startsAt: number, nowMs: number): QuietState {
  const tz = a?.time_zone ?? null;
  const sleepUntil = a?.sleeping_until ? Date.parse(a.sleeping_until) : null;
  if (sleepUntil !== null && sleepUntil > nowMs) return { kind: "asleep", until: sleepUntil };
  if (isNight(nowMs, tz)) return { kind: "night" };

  const lastActive = a?.last_active_at ? Date.parse(a.last_active_at) : null;
  const anchor = Math.max(startsAt, lastActive ?? -Infinity, sleepUntil ?? -Infinity);
  if (wakingMs(anchor, nowMs, tz) >= QUIET_AFTER_WAKING_MS) {
    return { kind: "quiet", sinceMs: lastActive !== null && lastActive >= startsAt ? lastActive : startsAt };
  }
  return { kind: "fine" };
}

/** "7 hours", "45 min", "2 days". */
export function spanText(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} ${h === 1 ? "hour" : "hours"}`;
  return `${Math.floor(h / 24)} days`;
}
