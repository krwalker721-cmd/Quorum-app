import type { SupabaseClient } from "@supabase/supabase-js";
import type { SprintRow } from "@/lib/hackathons/sprint";

// Judging (Phase 9). The rubric is 020's four 1–5 scores; this file gives
// them words, orders each judge's list, and turns scores into the admin's
// suggestions. Who may read or write what is the database's business
// (migrations 020, 030, 031): judges read complete submissions from the
// deadline and write their own scores until judging_ends_at.

export type ScoreKey = "score_problem" | "score_shipped" | "score_collaboration" | "score_potential";

export const RUBRIC: { key: ScoreKey; label: string; question: string; low: string; high: string }[] = [
  {
    key: "score_problem",
    label: "Problem",
    question: "Is the problem real, and clearly put?",
    low: "Vague or minor",
    high: "Sharp and worth solving",
  },
  {
    key: "score_shipped",
    label: "Shipped",
    question: "How much of it actually works?",
    low: "Mostly an idea",
    high: "A working product",
  },
  {
    key: "score_collaboration",
    label: "Collaboration",
    question: "Did the team build it together?",
    low: "One person's work",
    high: "A real team effort",
  },
  {
    key: "score_potential",
    label: "Potential",
    question: "Could this become a real product or company?",
    low: "A fun experiment",
    high: "I'd use it, or back it",
  },
];

export type Score = Record<ScoreKey, number> & {
  id: string;
  submission_id: string;
  notes: string | null;
  updated_at: string;
};

export const SCORE_COLUMNS =
  "id, submission_id, score_problem, score_shipped, score_collaboration, score_potential, notes, updated_at";

export type AwardType =
  | "community_pick"
  | "crowd_favourite"
  | "judges_pick"
  | "most_shipped"
  | "best_collaboration"
  | "most_likely_to_become_real"
  | "custom";

export const AWARD_LABEL: Record<AwardType, string> = {
  // Computed from peer reviews (036).
  community_pick: "Community pick",
  crowd_favourite: "Crowd favourite",
  // From the judges era (031); kept for Sprints judged that way.
  judges_pick: "Judges' pick",
  most_shipped: "Most shipped",
  best_collaboration: "Best collaboration",
  most_likely_to_become_real: "Most likely to become real",
  custom: "Award",
};

/** The named awards, and which average suggests a winner for each. */
export const NAMED_AWARDS: { type: Exclude<AwardType, "custom">; basis: ScoreKey | "overall"; basisLabel: string }[] = [
  { type: "judges_pick", basis: "overall", basisLabel: "overall" },
  { type: "most_shipped", basis: "score_shipped", basisLabel: "shipped" },
  { type: "best_collaboration", basis: "score_collaboration", basisLabel: "collaboration" },
  { type: "most_likely_to_become_real", basis: "score_potential", basisLabel: "potential" },
];

/**
 * Each judge's own fixed order, so the same team isn't always first (or
 * last, when everyone's tired). A hash of judge and submission: stable across
 * reloads, different per judge.
 */
export function judgeOrder<T extends { id: string }>(judgeId: string, items: T[]): T[] {
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  return [...items].sort((a, b) => hash(judgeId + a.id) - hash(judgeId + b.id) || a.id.localeCompare(b.id));
}

/** Where scoring stands for a Sprint, on the given clock. */
export type ScoringWindow = "not_yet" | "open" | "closed" | "frozen";

export function scoringWindow(sprint: Pick<SprintRow, "state" | "ends_at" | "judging_ends_at">, nowMs: number): ScoringWindow {
  if (sprint.state === "paused" || sprint.state === "cancelled") return "frozen";
  const ends = sprint.ends_at ? Date.parse(sprint.ends_at) : null;
  const judged = sprint.judging_ends_at ? Date.parse(sprint.judging_ends_at) : null;
  if (ends === null || judged === null || nowMs < ends) return "not_yet";
  return nowMs < judged ? "open" : "closed";
}

export type JudgeProject = {
  id: string;
  team_id: string;
  project_name: string | null;
  tagline: string | null;
  team: { name: string; slug: string; emblem: string | null; color: string | null };
};

/**
 * The judge's list: every complete submission they can read (RLS gives a
 * judge complete ones only, from the deadline), in their own order, with
 * their own scores.
 */
export async function loadJudgeQueue(
  db: SupabaseClient,
  sprintId: string,
  judgeId: string,
): Promise<{ projects: JudgeProject[]; scores: Map<string, Score> }> {
  const [{ data: subs }, { data: teams }, { data: scores }] = await Promise.all([
    db.from("hackathon_submissions").select("id, team_id, project_name, tagline, is_complete").eq("hackathon_id", sprintId),
    db.from("hackathon_teams").select("id, name, slug, emblem, color").eq("hackathon_id", sprintId),
    db.from("hackathon_scores").select(SCORE_COLUMNS).eq("hackathon_id", sprintId).eq("judge_id", judgeId),
  ]);
  const teamById = new Map((teams ?? []).map((t) => [t.id as string, t]));
  const projects = (subs ?? [])
    .filter((s) => s.is_complete && teamById.has(s.team_id as string))
    .map((s) => {
      const t = teamById.get(s.team_id as string)!;
      return {
        id: s.id as string,
        team_id: s.team_id as string,
        project_name: (s.project_name as string | null) ?? null,
        tagline: (s.tagline as string | null) ?? null,
        team: { name: t.name as string, slug: t.slug as string, emblem: (t.emblem as string | null) ?? null, color: (t.color as string | null) ?? null },
      };
    });
  return {
    projects: judgeOrder(judgeId, projects),
    scores: new Map(((scores ?? []) as unknown as Score[]).map((s) => [s.submission_id, s])),
  };
}

/** The judge's standing in a Sprint: accepted, invited, or not a judge. */
export async function judgeStatus(db: SupabaseClient, sprintId: string, userId: string): Promise<"judge" | "invited" | null> {
  const { data } = await db
    .from("hackathon_judges")
    .select("accepted_at")
    .eq("hackathon_id", sprintId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return data.accepted_at ? "judge" : "invited";
}

export const judgeHref = (n: number, slug?: string) => (slug ? `/buildathon/${n}/judge/${slug}` : `/buildathon/${n}/judge`);

/** The mean of some numbers to one decimal, or null for none. */
export function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
}

/** A score's own overall: the mean of its four. */
export const overall = (s: Record<ScoreKey, number>) =>
  (s.score_problem + s.score_shipped + s.score_collaboration + s.score_potential) / 4;

export type Averages = Record<ScoreKey | "overall", number | null>;

/**
 * One project's scores, summed up for the admins: the mean of each
 * criterion, the overall (the mean of each judge's own overall), how many
 * judges scored it, and the spread between the most and least generous.
 */
export function summarize(scores: Record<ScoreKey, number>[]): { averages: Averages; count: number; spread: number | null } {
  const overalls = scores.map(overall);
  const averages = Object.fromEntries(RUBRIC.map((r) => [r.key, mean(scores.map((s) => s[r.key]))])) as Averages;
  averages.overall = mean(overalls);
  return {
    averages,
    count: scores.length,
    spread: overalls.length > 1 ? Math.round((Math.max(...overalls) - Math.min(...overalls)) * 10) / 10 : null,
  };
}
