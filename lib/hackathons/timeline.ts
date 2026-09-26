import { formatNy } from "@/lib/time/newYork";

// A Sprint's six milestones, in the order the database requires them
// (hackathons_timeline_order in migration 018). Shared by the admin form, which
// checks as you type, and the admin API, which checks again before saving.

export const MILESTONES = [
  { key: "registration_opens_at", label: "Registration opens" },
  { key: "team_lock_at", label: "Team lock" },
  { key: "starts_at", label: "Kickoff" },
  { key: "ends_at", label: "Submission deadline" },
  { key: "judging_ends_at", label: "Judging ends" },
  { key: "reveal_at", label: "Reveal" },
] as const;

export type MilestoneKey = (typeof MILESTONES)[number]["key"];
export type Timeline = Partial<Record<MilestoneKey | "lobby_closes_at", string | null>>;

export const TIME_FIELDS: (MilestoneKey | "lobby_closes_at")[] = [
  ...MILESTONES.map((m) => m.key),
  "lobby_closes_at",
];

export function labelFor(key: string): string {
  if (key === "lobby_closes_at") return "Lobby closes";
  return MILESTONES.find((m) => m.key === key)?.label ?? key;
}

/**
 * Every ordering problem, in words. Only the dates that are set are compared,
 * since a draft may leave some empty. Kickoff must be strictly before the
 * deadline; everything else may coincide (e.g. reveal = judging end).
 */
export function timelineErrors(t: Timeline): string[] {
  const errors: string[] = [];
  const set = MILESTONES.filter((m) => t[m.key]);
  for (let i = 0; i < set.length; i++) {
    for (let j = i + 1; j < set.length; j++) {
      const a = set[i];
      const b = set[j];
      const ta = new Date(t[a.key]!).getTime();
      const tb = new Date(t[b.key]!).getTime();
      const strict = a.key === "starts_at" && b.key === "ends_at";
      if (strict ? ta >= tb : ta > tb) {
        errors.push(
          `${a.label} (${formatNy(t[a.key])}) must be ${strict ? "before" : "at or before"} ${b.label.toLowerCase()} (${formatNy(t[b.key])}).`,
        );
      }
    }
  }
  if (t.lobby_closes_at && t.registration_opens_at && new Date(t.lobby_closes_at) < new Date(t.registration_opens_at)) {
    errors.push(`The lobby can't close (${formatNy(t.lobby_closes_at)}) before registration opens.`);
  }
  return errors;
}

/** Milestones still missing a date: publishing needs all six. */
export function missingMilestones(t: Timeline): string[] {
  return MILESTONES.filter((m) => !t[m.key]).map((m) => m.label);
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * The quick-schedule defaults from a kickoff time: registration opens 7 days
 * before, teams lock 1 hour before, the deadline is 48 hours after kickoff,
 * judging ends 48 hours after that, and the reveal is when judging ends.
 */
export function quickSchedule(kickoffIso: string): Record<MilestoneKey, string> {
  const k = new Date(kickoffIso).getTime();
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
    registration_opens_at: iso(k - 7 * DAY),
    team_lock_at: iso(k - HOUR),
    starts_at: iso(k),
    ends_at: iso(k + 48 * HOUR),
    judging_ends_at: iso(k + 96 * HOUR),
    reveal_at: iso(k + 96 * HOUR),
  };
}

/**
 * The milestone a Sprint countdown counts to right now: registration opening,
 * then kickoff, then the deadline, then the reveal. Null once revealed or with
 * no dates.
 */
export function nextMilestone(
  t: Timeline,
  nowMs: number,
): { key: MilestoneKey; label: string; at: string } | null {
  const order: { key: MilestoneKey; label: string }[] = [
    { key: "registration_opens_at", label: "Registration opens" },
    { key: "starts_at", label: "Kickoff" },
    { key: "ends_at", label: "Submissions close" },
    { key: "reveal_at", label: "Reveal" },
  ];
  for (const m of order) {
    const at = t[m.key];
    if (at && new Date(at).getTime() > nowMs) return { key: m.key, label: m.label, at };
  }
  return null;
}
