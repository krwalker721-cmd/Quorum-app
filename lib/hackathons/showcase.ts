import type { SupabaseClient } from "@supabase/supabase-js";
import { AWARD_LABEL, NAMED_AWARDS, type AwardType } from "@/lib/hackathons/judging";
import { SUBMISSION_BUCKET, type SubmissionFields } from "@/lib/hackathons/submission";

// The public showcase (Phase 10): what anyone may see once a Sprint is
// revealed, signed out included. Everything comes through migration 032's
// functions and the awards' own read policy (031), with whatever client the
// page has, so the database alone decides: nothing before the reveal, drafts
// never, and first names only for anyone who isn't an approved member.

export type PublicSprint = {
  id: string;
  number: number;
  slug: string;
  title: string;
  tagline: string | null;
  theme: string | null;
  starts_at: string;
  ends_at: string;
  reveal_at: string;
  teams: number;
  builders: number;
  cohorts: number;
  shipped: number;
};

/** A builder: first name only signed out; members also get the rest. */
export type PublicPerson = {
  first_name: string;
  id?: string;
  full_name?: string | null;
  username?: string | null;
  stage?: string | null;
};

export type PublicAward = { id: string; award_type: AwardType; custom_label: string | null; citation: string | null };

export type PublicProject = {
  submission_id: string;
  team_id: string;
  team: { name: string; slug: string; emblem: string | null; color: string | null };
  fields: SubmissionFields;
  completed_at: string | null;
  members: PublicPerson[];
  awards: PublicAward[];
  /** Signed URLs, in order; the gallery asks for the first one only. */
  screenshotUrls: string[];
};

const SIGNED_FOR = 60 * 60 * 6; // six hours: a recap left open all afternoon keeps its images

export async function loadPublicSprint(db: SupabaseClient, number: number): Promise<PublicSprint | null> {
  const { data } = await db.rpc("hackathon_public_sprint", { p_number: number });
  return ((data as PublicSprint[] | null) ?? [])[0] ?? null;
}

type Row = {
  submission_id: string;
  team_id: string;
  team_slug: string;
  team_name: string;
  team_emblem: string | null;
  team_color: string | null;
  project_name: string | null;
  tagline: string | null;
  problem: string | null;
  description: string | null;
  demo_url: string | null;
  repo_url: string | null;
  video_url: string | null;
  screenshots: string[] | null;
  built_with: string[] | null;
  completed_at: string | null;
  members: PublicPerson[];
};

/**
 * Every complete project of a revealed Sprint, with its awards and signed
 * screenshot URLs: the first for each card, and every one for the team named
 * in `allFor` (the project page's own project).
 */
export async function loadPublicProjects(
  db: SupabaseClient,
  sprintId: string,
  opts: { allFor?: string } = {},
): Promise<PublicProject[]> {
  const [{ data: rows }, { data: awards }] = await Promise.all([
    db.rpc("hackathon_public_projects", { p_hackathon_id: sprintId }),
    db.from("hackathon_awards").select("id, award_type, custom_label, citation, submission_id, created_at").eq("hackathon_id", sprintId).order("created_at"),
  ]);
  const list = (rows as Row[] | null) ?? [];
  if (list.length === 0) return [];

  // Awards show only once finalized (031). RLS hides unfinalized ones from
  // everyone but admins; checking here too means an admin sees what the public does.
  const { data: final } = await db.from("hackathons").select("awards_finalized_at").eq("id", sprintId).maybeSingle();
  const awardList = final?.awards_finalized_at ? sortAwards((awards ?? []) as (PublicAward & { submission_id: string })[]) : [];

  const wanted = (r: Row) => (r.team_slug === opts.allFor ? (r.screenshots ?? []) : (r.screenshots ?? []).slice(0, 1));
  const paths = list.flatMap(wanted);
  const { data: signed } = paths.length
    ? await db.storage.from(SUBMISSION_BUCKET).createSignedUrls(paths, SIGNED_FOR)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const url = new Map((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl]));

  return list.map((r) => ({
    submission_id: r.submission_id,
    team_id: r.team_id,
    team: { name: r.team_name, slug: r.team_slug, emblem: r.team_emblem, color: r.team_color },
    fields: {
      project_name: r.project_name ?? "",
      tagline: r.tagline ?? "",
      problem: r.problem ?? "",
      description: r.description ?? "",
      demo_url: r.demo_url ?? "",
      repo_url: r.repo_url ?? "",
      video_url: r.video_url ?? "",
      screenshots: r.screenshots ?? [],
      built_with: r.built_with ?? [],
    },
    completed_at: r.completed_at,
    members: r.members ?? [],
    awards: awardList.filter((a) => a.submission_id === r.submission_id),
    screenshotUrls: wanted(r)
      .map((p) => url.get(p))
      .filter((u): u is string => Boolean(u)),
  }));
}

export const awardName = (a: Pick<PublicAward, "award_type" | "custom_label">) =>
  a.award_type === "custom" ? (a.custom_label ?? "Award") : AWARD_LABEL[a.award_type];

/** Named awards in their own order (Judges' pick first), then custom ones as given. */
export function sortAwards<T extends { award_type: string }>(awards: T[]): T[] {
  const rank = (t: string) => {
    const i = NAMED_AWARDS.findIndex((n) => n.type === t);
    return i === -1 ? NAMED_AWARDS.length : i;
  };
  return [...awards].sort((a, b) => rank(a.award_type) - rank(b.award_type));
}

/** Every award once, each with its project, in award order. */
export function awardsWithProjects(projects: PublicProject[]): { award: PublicAward; project: PublicProject }[] {
  return sortAwards(projects.flatMap((p) => p.awards.map((award) => ({ award, project: p, award_type: award.award_type })))).map(
    ({ award, project }) => ({ award, project }),
  );
}

/** "built with" tags across the gallery, most used first. */
export function tagCounts(projects: PublicProject[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of projects) for (const t of p.fields.built_with) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** A person as the showcase's avatar row wants them. Members get a profile link. */
export function showcasePerson(p: PublicPerson, i: number) {
  return {
    id: p.id ?? `builder-${i}`,
    full_name: p.full_name ?? p.first_name,
    username: p.username ?? null,
    stage: p.stage ?? null,
  };
}

export const projectHref = (n: number, slug: string) => `/hackathon/${n}/project/${slug}`;
export const recapHref = (n: number) => `/hackathon/${n}/recap`;
