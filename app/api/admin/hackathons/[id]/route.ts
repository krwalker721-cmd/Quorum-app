import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/admin/db";
import { dbErrorResponse, guard, sprintFields } from "@/lib/admin/hackathons";
import { TIME_FIELDS, labelFor, type Timeline } from "@/lib/hackathons/timeline";
import { formatNy } from "@/lib/time/newYork";
import { parseDbTime } from "@/lib/stage";

type Ctx = { params: Promise<{ id: string }> };

type Person = { id: string; full_name: string | null; username: string | null; email: string | null };

function nameOf(p: Person | undefined | null) {
  return p?.full_name?.trim() || p?.username || "Someone";
}

// Everything the Sprint's admin page shows, in one read.
export async function GET(req: Request, ctx: Ctx) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  const db = createAdminClient();

  const [{ data: sprint }, { data: derived }] = await Promise.all([
    db.from("hackathons").select("*").eq("id", id).maybeSingle(),
    db.from("hackathon_overview").select("state, phase").eq("id", id).maybeSingle(),
  ]);
  if (!sprint) return NextResponse.json({ error: "No such Sprint." }, { status: 404 });

  const [regs, teams, members, subs, judges, lobby, log] = await Promise.all([
    db.from("hackathon_registrations").select("user_id, mode, team_id, checked_in_at, created_at, withdrawn_at").eq("hackathon_id", id).order("created_at"),
    db.from("hackathon_teams").select("id, name, slug, emblem, color, is_random_matched, is_open_to_requests, max_size_override, created_at").eq("hackathon_id", id).order("created_at"),
    db.from("hackathon_team_members").select("team_id, user_id, role, joined_at").eq("hackathon_id", id).order("joined_at"),
    db.from("hackathon_submissions").select("team_id, project_name, updated_at").eq("hackathon_id", id),
    db.from("hackathon_judges").select("id, user_id, invite_email, invited_at, accepted_at").eq("hackathon_id", id).order("invited_at"),
    db.from("hackathon_lobby_messages").select("id, user_id, body, is_system, is_pinned, created_at, edited_at, deleted_at").eq("hackathon_id", id).order("created_at", { ascending: false }).limit(150),
    db.from("admin_change_log").select("id, area, action, summary, subject, changes, actor, created_at").eq("hackathon_id", id).order("created_at", { ascending: false }).limit(150),
  ]);

  const userIds = Array.from(
    new Set([
      ...(regs.data ?? []).map((r) => r.user_id),
      ...(judges.data ?? []).map((j) => j.user_id).filter(Boolean),
      ...(lobby.data ?? []).map((m) => m.user_id).filter(Boolean),
    ]),
  ) as string[];

  const teamIds = (teams.data ?? []).map((t) => t.id);
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [people, cohorts, sessions, teamMsgs, lobbyMsgs] = await Promise.all([
    userIds.length ? db.from("profiles").select("id, full_name, username, email").in("id", userIds) : { data: [] },
    userIds.length ? db.from("cohort_members").select("user_id, cohorts(name)").in("user_id", userIds) : { data: [] },
    userIds.length ? db.from("sessions").select("user_id, created_at").in("user_id", userIds).gte("created_at", since).order("created_at", { ascending: false }).limit(5000) : { data: [] },
    teamIds.length ? db.from("hackathon_team_messages").select("user_id, created_at").in("team_id", teamIds).eq("is_system", false).order("created_at", { ascending: false }).limit(5000) : { data: [] },
    db.from("hackathon_lobby_messages").select("user_id, created_at").eq("hackathon_id", id).eq("is_system", false).order("created_at", { ascending: false }).limit(5000),
  ]);

  const personById = new Map((people.data ?? []).map((p: Person) => [p.id, p]));
  const cohortByUser = new Map<string, string>();
  for (const c of (cohorts.data ?? []) as { user_id: string; cohorts: { name: string } | { name: string }[] | null }[]) {
    const name = Array.isArray(c.cohorts) ? c.cohorts[0]?.name : c.cohorts?.name;
    if (name && !cohortByUser.has(c.user_id)) cohortByUser.set(c.user_id, name);
  }
  // Last active: the latest app visit or Sprint message.
  const lastActive = new Map<string, string>();
  const bump = (uid: string | null, at: string) => {
    if (!uid) return;
    const prev = lastActive.get(uid);
    if (!prev || new Date(at) > new Date(prev)) lastActive.set(uid, at);
  };
  // sessions.created_at has no time zone (it's UTC); parseDbTime reads it right.
  for (const r of (sessions.data ?? []) as { user_id: string; created_at: string }[]) bump(r.user_id, parseDbTime(r.created_at).toISOString());
  for (const r of (teamMsgs.data ?? []) as { user_id: string | null; created_at: string }[]) bump(r.user_id, r.created_at);
  for (const r of (lobbyMsgs.data ?? []) as { user_id: string | null; created_at: string }[]) bump(r.user_id, r.created_at);

  const teamName = new Map((teams.data ?? []).map((t) => [t.id, t.name]));
  const submitted = new Map((subs.data ?? []).map((s) => [s.team_id, s]));

  return NextResponse.json({
    sprint: { ...sprint, state: derived?.state ?? null, phase: derived?.phase ?? null },
    participants: (regs.data ?? []).map((r) => ({
      ...r,
      name: nameOf(personById.get(r.user_id)),
      email: personById.get(r.user_id)?.email ?? null,
      cohort: cohortByUser.get(r.user_id) ?? null,
      team_name: r.team_id ? teamName.get(r.team_id) ?? null : null,
      last_active_at: lastActive.get(r.user_id) ?? null,
    })),
    teams: (teams.data ?? []).map((t) => ({
      ...t,
      limit: t.max_size_override ?? sprint.max_team_size,
      submission: submitted.get(t.id) ?? null,
      members: (members.data ?? [])
        .filter((m) => m.team_id === t.id)
        .map((m) => ({ ...m, name: nameOf(personById.get(m.user_id)) })),
    })),
    judges: (judges.data ?? []).map((j) => ({
      ...j,
      name: j.user_id ? nameOf(personById.get(j.user_id)) : null,
      email: j.user_id ? personById.get(j.user_id)?.email ?? null : j.invite_email,
    })),
    lobby: (lobby.data ?? []).map((m) => ({
      ...m,
      author: m.is_system ? "System" : nameOf(personById.get(m.user_id ?? "")),
    })),
    log: log.data ?? [],
  });
}

// Edit a Sprint's settings and times. The note in the change log lists the
// times that moved, in New York time.
export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const { data: current } = await createAdminClient()
    .from("hackathons")
    .select(TIME_FIELDS.join(", ") + ", title")
    .eq("id", id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "No such Sprint." }, { status: 404 });
  const cur = current as unknown as Timeline & { title: string };

  const parsed = sprintFields(body, cur);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  // A blank slug means "leave it"; only a new Sprint gets one made up.
  if ("slug" in parsed.values && !parsed.values.slug) delete parsed.values.slug;
  if (Object.keys(parsed.values).length === 0) return NextResponse.json({ ok: true });

  const moved = TIME_FIELDS.filter(
    (f) => f in parsed.values && new Date(parsed.values[f] as string).getTime() !== new Date(cur[f] as string).getTime(),
  );
  const note = moved.length
    ? `Edited Sprint settings; ${moved.map((f) => `${labelFor(f)} → ${formatNy(parsed.values[f] as string | null)}`).join(", ")}`
    : "Edited Sprint settings";

  const { error } = await adminDb(g.admin, note).from("hackathons").update(parsed.values).eq("id", id);
  if (error) return dbErrorResponse(error);
  return NextResponse.json({ ok: true });
}
