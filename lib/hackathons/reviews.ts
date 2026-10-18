import { createClient as createSbClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicProject } from "./showcase";
import { REVIEW_COLUMNS, type MyReview } from "./reviewShared";

export { REVIEW_COLUMNS, type MyReview };

// Peer reviews (migration 036), from the server. Two moments, each once per
// Sprint, fired by whichever page loads first (Vercel Hobby has no per-minute
// cron; the database makes every later call a no-op):
//   * from the deadline: hand out the reviews (hackathon_assign_reviews);
//   * from the reveal: work out the awards (hackathon_compute_awards).
// Best-effort: a failure is logged and the page carries on.

function serviceDb(via: string) {
  return createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-quorum-via": via } },
  });
}

type Due = {
  is_published: boolean;
  status_override: string | null;
  ends_at: string | null;
  reveal_at: string | null;
  reviews_assigned_at: string | null;
  awards_finalized_at: string | null;
};

/** Hands out the reviews, then works out the awards, whichever is due. */
export async function runReviewsIfDue(sprintId: string, via = "peer reviews (page load)"): Promise<void> {
  try {
    const db = serviceDb(via);
    const { data } = await db
      .from("hackathons")
      .select("is_published, status_override, ends_at, reveal_at, reviews_assigned_at, awards_finalized_at")
      .eq("id", sprintId)
      .maybeSingle();
    const s = data as Due | null;
    if (!s || !s.is_published || s.status_override === "cancelled") return;
    const now = Date.now();
    if (!s.reviews_assigned_at && s.ends_at && Date.parse(s.ends_at) <= now && !s.status_override) {
      const { error } = await db.rpc("hackathon_assign_reviews", { p_hackathon_id: sprintId });
      if (error) console.error("assigning reviews failed:", error.message);
    }
    if (!s.awards_finalized_at && s.reveal_at && Date.parse(s.reveal_at) <= now) {
      const { error } = await db.rpc("hackathon_compute_awards", { p_hackathon_id: sprintId, p_force: false });
      if (error) console.error("computing awards failed:", error.message);
    }
  } catch (e) {
    console.error("peer reviews failed:", e);
  }
}

/**
 * The viewer's reviews for a Sprint, in order, each with its project (read
 * through the viewer's own client: 036 lets a reviewer read what they review,
 * with its screenshots and deck signed for them).
 */
export async function loadMyReviews(db: SupabaseClient, sprintId: string, userId: string): Promise<MyReview[]> {
  const { data } = await db
    .from("hackathon_reviews")
    .select(REVIEW_COLUMNS)
    .eq("hackathon_id", sprintId)
    .eq("reviewer_id", userId)
    .order("position");
  const rows = (data ?? []) as (Omit<MyReview, "project"> & { submission_id: string })[];
  if (rows.length === 0) return [];

  const projects = await loadAssignedProjects(db, rows.map((r) => r.submission_id));
  const byId = new Map(projects.map((p) => [p.submission_id, p]));
  return rows.map(({ submission_id, ...r }) => ({ ...r, project: byId.get(submission_id) ?? null }));
}

const SUBMISSION_BUCKET = "hackathon-submissions";
const DECK_BUCKET = "hackathon-decks";

/** The assigned projects, shaped like the public ones so the theatre can show them. */
async function loadAssignedProjects(db: SupabaseClient, ids: string[]): Promise<PublicProject[]> {
  const { data: subs } = await db
    .from("hackathon_submissions")
    .select("id, team_id, project_name, tagline, problem, description, demo_url, repo_url, video_url, screenshots, built_with, completed_at, presentation_path")
    .in("id", ids);
  const list = (subs ?? []) as {
    id: string;
    team_id: string;
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
    presentation_path?: string | null;
  }[];
  if (list.length === 0) return [];
  const { data: teams } = await db.from("hackathon_teams").select("id, name, slug, emblem, color").in("id", list.map((s) => s.team_id));
  const teamById = new Map(((teams ?? []) as { id: string; name: string; slug: string; emblem: string | null; color: string | null }[]).map((t) => [t.id, t]));

  const shotPaths = list.flatMap((s) => s.screenshots ?? []);
  const deckPaths = list.map((s) => s.presentation_path).filter((p): p is string => Boolean(p));
  const [shots, decks] = await Promise.all([
    shotPaths.length ? db.storage.from(SUBMISSION_BUCKET).createSignedUrls(shotPaths, 3600) : Promise.resolve({ data: [] }),
    deckPaths.length ? db.storage.from(DECK_BUCKET).createSignedUrls(deckPaths, 3600) : Promise.resolve({ data: [] }),
  ]);
  const url = new Map(
    [...((shots.data ?? []) as { path: string | null; signedUrl: string }[]), ...((decks.data ?? []) as { path: string | null; signedUrl: string }[])]
      .filter((x) => x.path && x.signedUrl)
      .map((x) => [x.path as string, x.signedUrl]),
  );

  return list.map((s) => {
    const t = teamById.get(s.team_id) ?? { name: "A team", slug: "", emblem: null, color: null };
    return {
      submission_id: s.id,
      team_id: s.team_id,
      team: { name: t.name, slug: t.slug, emblem: t.emblem, color: t.color },
      fields: {
        project_name: s.project_name ?? "",
        tagline: s.tagline ?? "",
        problem: s.problem ?? "",
        description: s.description ?? "",
        demo_url: s.demo_url ?? "",
        repo_url: s.repo_url ?? "",
        video_url: s.video_url ?? "",
        screenshots: s.screenshots ?? [],
        built_with: s.built_with ?? [],
      },
      completed_at: s.completed_at,
      members: [],
      awards: [],
      screenshotUrls: (s.screenshots ?? []).map((p) => url.get(p)).filter((u): u is string => Boolean(u)),
      deckUrl: s.presentation_path ? url.get(s.presentation_path) ?? null : null,
    };
  });
}

