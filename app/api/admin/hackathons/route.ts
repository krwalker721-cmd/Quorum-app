import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/admin/db";
import { dbErrorResponse, guard, sprintFields } from "@/lib/admin/hackathons";

// Every Sprint, drafts included, with its derived state and head counts.
export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const db = createAdminClient();

  const { data: sprints, error } = await db
    .from("hackathon_overview")
    .select("id, number, slug, title, state, phase, is_published, registration_opens_at, starts_at, ends_at, reveal_at, status_override")
    .order("number", { ascending: false });
  if (error) return dbErrorResponse(error, 500);

  const counts = await Promise.all(
    (sprints ?? []).map(async (s) => {
      const [participants, teams, submissions] = await Promise.all([
        db.from("hackathon_registrations").select("id", { count: "exact", head: true }).eq("hackathon_id", s.id).is("withdrawn_at", null),
        db.from("hackathon_teams").select("id", { count: "exact", head: true }).eq("hackathon_id", s.id),
        db.from("hackathon_submissions").select("id", { count: "exact", head: true }).eq("hackathon_id", s.id),
      ]);
      return {
        ...s,
        participant_count: participants.count ?? 0,
        team_count: teams.count ?? 0,
        submission_count: submissions.count ?? 0,
      };
    }),
  );
  return NextResponse.json({ sprints: counts });
}

// A new draft Sprint. Dates are optional until it's published.
export async function POST(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const body = await req.json().catch(() => ({}));
  const parsed = sprintFields(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!parsed.values.title) return NextResponse.json({ error: "Give the Sprint a title." }, { status: 400 });

  const { data, error } = await adminDb(g.admin, `Created Sprint "${parsed.values.title}"`)
    .from("hackathons")
    .insert({ ...parsed.values, created_by: g.admin.id, is_published: false })
    .select("id")
    .single();
  if (error) return dbErrorResponse(error);
  return NextResponse.json({ id: data.id });
}
