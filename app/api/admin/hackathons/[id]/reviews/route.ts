import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/admin/db";
import { dbErrorResponse, guard } from "@/lib/admin/hackathons";
import { AWARD_LABEL, type AwardType } from "@/lib/hackathons/judging";

type Ctx = { params: Promise<{ id: string }> };

// Peer reviews for the admin console (migration 036): who has reviewed what,
// the standings the awards come from, every piece of feedback (with a way to
// hide an abusive one), and the two moments, should an admin need to nudge
// them: hand out the reviews now, recompute the awards. Writes go through
// adminDb, so the change log names the admin.
export async function GET(req: Request, ctx: Ctx) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  const db = createAdminClient();

  const [{ data: sprint }, standings, reviews, teams, subs, awards] = await Promise.all([
    db.from("hackathons").select("id, ends_at, judging_ends_at, reveal_at, reviews_per_person, reviews_assigned_at, awards_finalized_at").eq("id", id).maybeSingle(),
    db.rpc("hackathon_review_standings", { p_hackathon_id: id }),
    db
      .from("hackathon_reviews")
      .select("id, submission_id, reviewer_id, position, score_problem, score_works, score_use, strength, suggestion, is_favourite, completed_at, hidden_at")
      .eq("hackathon_id", id)
      .order("position"),
    db.from("hackathon_teams").select("id, name, emblem, color").eq("hackathon_id", id),
    db.from("hackathon_submissions").select("id, team_id, project_name").eq("hackathon_id", id),
    db.from("hackathon_awards").select("id, award_type, custom_label, citation, submission_id").eq("hackathon_id", id),
  ]);
  if (!sprint) return NextResponse.json({ error: "No such Buildathon." }, { status: 404 });

  const rows = (reviews.data ?? []) as {
    id: string;
    submission_id: string;
    reviewer_id: string;
    score_problem: number | null;
    score_works: number | null;
    score_use: number | null;
    strength: string | null;
    suggestion: string | null;
    is_favourite: boolean;
    completed_at: string | null;
    hidden_at: string | null;
  }[];
  const reviewerIds = Array.from(new Set(rows.map((r) => r.reviewer_id)));
  const { data: people } = reviewerIds.length
    ? await db.from("profiles").select("id, full_name, username").in("id", reviewerIds)
    : { data: [] };
  const nameOf = new Map(((people ?? []) as { id: string; full_name: string | null; username: string | null }[]).map((p) => [p.id, p.full_name?.trim() || p.username || "Someone"]));
  const teamById = new Map((teams.data ?? []).map((t) => [t.id as string, t]));
  const projectOf = new Map(
    (subs.data ?? []).map((s) => [s.id as string, { name: (s.project_name as string | null) || "Untitled project", team: teamById.get(s.team_id as string) ?? null }]),
  );

  const reviewers = reviewerIds
    .map((rid) => {
      const mine = rows.filter((r) => r.reviewer_id === rid);
      return { id: rid, name: nameOf.get(rid) ?? "Someone", assigned: mine.length, done: mine.filter((r) => r.completed_at).length };
    })
    .sort((a, b) => a.done / a.assigned - b.done / b.assigned || a.name.localeCompare(b.name));

  return NextResponse.json({
    sprint,
    reviewers,
    standings: ((standings.data ?? []) as { submission_id: string; reviews: number; problem: number | null; works: number | null; use: number | null; overall: number | null; favourites: number; eligible: boolean }[])
      .map((s) => ({ ...s, project: projectOf.get(s.submission_id) ?? null }))
      .sort((a, b) => (b.overall ?? -9) - (a.overall ?? -9)),
    feedback: rows
      .filter((r) => r.completed_at && (r.strength || r.suggestion))
      .map((r) => ({ id: r.id, project: projectOf.get(r.submission_id)?.name ?? "A project", reviewer: nameOf.get(r.reviewer_id) ?? "Someone", strength: r.strength, suggestion: r.suggestion, hidden: Boolean(r.hidden_at) })),
    awards: (awards.data ?? []).map((a) => ({
      id: a.id,
      label: a.award_type === "custom" ? a.custom_label ?? "Award" : AWARD_LABEL[a.award_type as AwardType] ?? a.award_type,
      citation: a.citation,
      project: projectOf.get(a.submission_id as string)?.name ?? "A project",
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ok = (r: { error: unknown }) =>
    r.error ? dbErrorResponse(r.error as { message: string; hint?: string }) : NextResponse.json({ ok: true });

  switch (String(b.op ?? "")) {
    case "hide":
    case "unhide":
      return ok(
        await adminDb(g.admin, b.op === "hide" ? "Hid a peer review" : "Showed a peer review again")
          .from("hackathon_reviews")
          .update({ hidden_at: b.op === "hide" ? new Date().toISOString() : null })
          .eq("id", String(b.review_id))
          .eq("hackathon_id", id),
      );
    case "assign":
      return ok(await adminDb(g.admin, "Handed out the peer reviews").rpc("hackathon_assign_reviews", { p_hackathon_id: id }));
    case "recompute":
      return ok(await adminDb(g.admin, "Recomputed the awards from peer reviews").rpc("hackathon_compute_awards", { p_hackathon_id: id, p_force: true }));
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
