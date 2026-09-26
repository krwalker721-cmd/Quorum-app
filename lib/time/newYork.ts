// Sprint times are typed in New York time and stored in UTC. The browser's
// own time zone data does the conversion, so daylight saving is handled by
// the same tables the operating system uses; no library needed.

export const NY_ZONE = "America/New_York";

type Wall = { y: number; mo: number; d: number; h: number; mi: number };

function wallOf(ms: number): Wall {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

/** Minutes New York is ahead of UTC at this instant (negative: -240 in summer). */
function offsetMinutes(ms: number): number {
  const w = wallOf(ms);
  const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi);
  return Math.round((asUtc - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A UTC instant as the value a datetime-local input shows, in New York time. */
export function utcToNyInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const w = wallOf(new Date(iso).getTime());
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}`;
}

export type NyParse =
  | { ok: true; iso: string; ambiguous: boolean }
  | { ok: false; error: string };

/**
 * A datetime-local value ("2026-10-09T18:00"), read as New York time, to UTC.
 *
 * Two daylight-saving edge cases, both reported rather than guessed:
 *  - a time that doesn't exist (2:30am on the spring-forward night) is refused;
 *  - a time that happens twice (1:30am on the fall-back night) takes the first
 *    one, EDT, and says so.
 */
export function nyInputToUtc(value: string): NyParse {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return { ok: false, error: "Enter a date and time." };
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);

  // The offset either side of the wall time covers any transition near it.
  const offsets = Array.from(
    new Set([offsetMinutes(naive - 12 * 3_600_000), offsetMinutes(naive + 12 * 3_600_000)]),
  );
  const matches = offsets
    .map((off) => naive - off * 60_000)
    .filter((ms) => {
      const w = wallOf(ms);
      return w.y === y && w.mo === mo && w.d === d && w.h === h && w.mi === mi;
    })
    .sort((a, b) => a - b);

  if (matches.length === 0) {
    return {
      ok: false,
      error: `${pad(h)}:${pad(mi)} doesn't exist in New York that night (the clocks jump forward). Pick another time.`,
    };
  }
  return { ok: true, iso: new Date(matches[0]).toISOString(), ambiguous: matches.length > 1 };
}

/** "Oct 9, 2026, 6:00 PM EDT" */
export function formatNy(iso: string | null | undefined): string {
  if (!iso) return "not set";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: NY_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** "EDT (UTC−4)" at the given instant, or now. */
export function nyZoneLabel(iso?: string | null): string {
  const ms = iso ? new Date(iso).getTime() : Date.now();
  const abbr =
    new Intl.DateTimeFormat("en-US", { timeZone: NY_ZONE, timeZoneName: "short" })
      .formatToParts(new Date(ms))
      .find((p) => p.type === "timeZoneName")?.value ?? "ET";
  const off = offsetMinutes(ms) / 60;
  return `${abbr} (UTC${off < 0 ? "−" : "+"}${Math.abs(off)})`;
}
