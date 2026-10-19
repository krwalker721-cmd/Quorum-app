import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/admin/db";
import { dbErrorResponse, guard } from "@/lib/admin/hackathons";
import { AWARD_LABEL, SCORE_COLUMNS, summarize, type AwardType, type Score } from "@/lib/hackathons/judging";

type Ctx = { params: Promise<{ id: string }> };
type Person = { id: string; full_name: string | null; username: string | null; email: string | null };

const nameOf = (p: Person | undefined | null) => p?.full_name?.trim() || p?.username || "Someone";
const NAMED: AwardType[] = ["judges_pick", "most_shipped", "best_collaboration", "most_likely_to_become_real"];

// Judging for the admin console (Phase 9): every judge's progress, every
// complete submission's scores and averages, and the award board. Admins
// see a ranking here; the public never does (only finalized awards, at the
// reveal). Writes go through adminDb, so the change log names the admin.
export async function GET(req: Request, ctx: Ctx) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  const db = createAdminClient();

  const [{ data: sprint }, { data: derived }] = await Promise.all([
    db
      .from("hackathons")
      .select("id, number, ends_at, judging_ends_at, reveal_at, status_override, awards_finalized_at, awards_finalized_by")
      .eq("id", id)
      .maybeSingle(),
    db.from("hackathon_overview").select("state, phase").eq("id", id).maybeSingle(),
  ]);
  if (!sprint) return NextResponse.json({ error: "No such Buildathon." }, { status: 404 });

  const [teams, subs, scores, judges, awards] = await Promise.all([
    db.from("hackathon_teams").select("id, name, slug, emblem, color").eq("hackathon_id", id),
    db.from("hackathon_submissions").select("id, team_id, project_name, tagline, is_complete").eq("hackathon_id", id),
    db.from("hackathon_scores").select(`${SCORE_COLUMNS}, judge_id`).eq("hackathon_id", id),
    db.from("hackathon_judges").select("id, user_id, invite_email, accepted_at").eq("hackathon_id", id).order("invited_at"),
    db.from("hackathon_awards").select("id, award_type, custom_label, citation, submission_id, created_at").eq("hackathon_id", id).order("created_at"),
  ]);

  const scoreRows = (scores.data ?? []) as unknown as (Score & { judge_id: string })[];
  const peopleIds = Array.from(
    new Set([
      ...(judges.data ?? []).map((j) => j.user_id).filter(Boolean),
      ...scoreRows.map((s) => s.judge_id),
      ...(sprint.awards_finalized_by ? [sprint.awards_finalized_by] : []),
    ]),
  ) as string[];
  const { data: people } = peopleIds.length
    ? await db.from("profiles").select("id, full_name, username, email").in("id", peopleIds)
    : { data: [] };
  const personById = new Map(((people ?? []) as Person[]).map((p) => [p.id, p]));
  const teamById = new Map((teams.data ?? []).map((t) => [t.id as string, t]));

  const complete = (subs.data ?? []).filter((s) => s.is_complete);
  const projects = complete.map((s) => {
    const mine = scoreRows.filter((r) => r.submission_id === s.id);
    const t = teamById.get(s.team_id as string);
    return {
      submission_id: s.id as string,
      project_name: (s.project_name as string | null) ?? null,
      tagline: (s.tagline as string | null) ?? null,
      team: t ? { name: t.name, slug: t.slug, emblem: t.emblem, color: t.color } : null,
      ...summarize(mine),
      scores: mine.map((r) => ({
        judge_id: r.judge_id,
        judge_name: nameOf(personById.get(r.judge_id)),
        score_problem: r.score_problem,
        score_shipped: r.score_shipped,
        score_collaboration: r.score_collaboration,
        score_potential: r.score_potential,
        notes: r.notes,
        updated_at: r.updated_at,
      })),
    };
  });
  const completeIds = new Set(complete.map((s) => s.id as string));

  return NextResponse.json({
    sprint: {
      id: sprint.id,
      number: sprint.number,
      state: derived?.state ?? null,
      phase: derived?.phase ?? null,
      ends_at: sprint.ends_at,
      judging_ends_at: sprint.judging_ends_at,
      reveal_at: sprint.reveal_at,
      awards_finalized_at: sprint.awards_finalized_at,
      awards_finalized_by: sprint.awards_finalized_by ? nameOf(personById.get(sprint.awards_finalized_by)) : null,
    },
    judges: (judges.data ?? []).map((j) => {
      const p = j.user_id ? personById.get(j.user_id) : null;
      return {
        id: j.id,
        user_id: j.user_id,
        name: p ? nameOf(p) : null,
        email: p?.email ?? j.invite_email,
        accepted_at: j.accepted_at,
        scored: j.user_id ? scoreRows.filter((r) => r.judge_id === j.user_id && completeIds.has(r.submission_id)).length : 0,
      };
    }),
    drafts: (subs.data ?? []).length - complete.length,
    no_submission: (teams.data ?? []).filter((t) => !(subs.data ?? []).some((s) => s.team_id === t.id)).length,
    projects,
    awards: awards.data ?? [],
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const op = String(b.op ?? "");
  const read = createAdminClient();

  const ok = (r: { error: unknown }) =>
    r.error ? dbErrorResponse(r.error as { message: string; hint?: string }) : NextResponse.json({ ok: true });
  const projectName = async (submissionId: unknown) => {
    const { data } = await read.from("hackathon_submissions").select("project_name").eq("id", String(submissionId)).eq("hackathon_id", id).maybeSingle();
    return data?.project_name || "a project";
  };
  const citation = typeof b.citation === "string" && b.citation.trim() ? b.citation.trim() : null;
  if (citation && citation.length > 280) return NextResponse.json({ error: "Keep the citation to 280 characters." }, { status: 400 });

  switch (op) {
    // A named award has one winner (031): give it, or move it to another project.
    case "award_set": {
      const type = String(b.award_type) as AwardType;
      if (!NAMED.includes(type)) return NextResponse.json({ error: "Unknown award." }, { status: 400 });
      const name = await projectName(b.submission_id);
      const note = `Gave ${AWARD_LABEL[type]} to ${name}`;
      const { data: existing } = await read.from("hackathon_awards").select("id").eq("hackathon_id", id).eq("award_type", type).maybeSingle();
      return ok(
        existing
          ? await adminDb(g.admin, note)
              .from("hackathon_awards")
              .update({ submission_id: String(b.submission_id), citation })
              .eq("id", existing.id)
          : await adminDb(g.admin, note)
              .from("hackathon_awards")
              .insert({ hackathon_id: id, submission_id: String(b.submission_id), award_type: type, citation }),
      );
    }
    case "award_custom": {
      const label = typeof b.custom_label === "string" ? b.custom_label.trim() : "";
      if (!label) return NextResponse.json({ error: "Give the award a name." }, { status: 400 });
      if (label.length > 80) return NextResponse.json({ error: "Keep the award's name to 80 characters." }, { status: 400 });
      const name = await projectName(b.submission_id);
      return ok(
        await adminDb(g.admin, `Gave "${label}" to ${name}`)
          .from("hackathon_awards")
          .insert({ hackathon_id: id, submission_id: String(b.submission_id), award_type: "custom", custom_label: label, citation }),
      );
    }
    case "award_citation":
      return ok(
        await adminDb(g.admin, "Changed an award's citation")
          .from("hackathon_awards")
          .update({ citation })
          .eq("id", String(b.award_id))
          .eq("hackathon_id", id),
      );
    case "award_remove":
      return ok(await adminDb(g.admin, "Removed an award").from("hackathon_awards").delete().eq("id", String(b.award_id)).eq("hackathon_id", id));

    // Finalizing makes them public at the reveal, and locks them (031).
    case "finalize":
      return ok(await adminDb(g.admin, "Finalized the awards").rpc("hackathon_finalize_awards", { p_hackathon_id: id }));
    case "unfinalize":
      return ok(await adminDb(g.admin, "Reopened the awards").rpc("hackathon_unfinalize_awards", { p_hackathon_id: id }));

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
