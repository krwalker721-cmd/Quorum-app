import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/admin/db";
import { dbErrorResponse, guard } from "@/lib/admin/hackathons";

type Ctx = { params: Promise<{ id: string }> };

// Team management. Anything that would take a team over its size limit is
// refused with hint "team_full" unless the request says raise_limit, which the
// screen only sends after asking.
export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const op = String(b.op ?? "");
  const raise = Boolean(b.raise_limit);
  const read = createAdminClient();

  // Names for the change-log note.
  const teamName = async (teamId: unknown) =>
    (await read.from("hackathon_teams").select("name").eq("id", String(teamId)).eq("hackathon_id", id).maybeSingle()).data?.name ?? null;
  const personName = async (userId: unknown) => {
    const { data } = await read.from("profiles").select("full_name, username").eq("id", String(userId)).maybeSingle();
    return data?.full_name?.trim() || data?.username || "someone";
  };
  const done = ({ error, data }: { error: unknown; data?: unknown }) =>
    error ? dbErrorResponse(error as { message: string; hint?: string }) : NextResponse.json({ ok: true, data: data ?? null });

  switch (op) {
    case "create": {
      const name = String(b.name ?? "").trim();
      const memberIds = Array.isArray(b.member_ids) ? b.member_ids.map(String) : [];
      if (!name) return NextResponse.json({ error: "Name the team." }, { status: 400 });
      return done(
        await adminDb(g.admin, `Created team ${name}${raise ? " (over the size limit)" : ""}`).rpc("hackathon_admin_create_team", {
          p_hackathon_id: id,
          p_name: name,
          p_member_ids: memberIds,
          p_raise_limit: raise,
        }),
      );
    }
    case "rename": {
      const from = await teamName(b.team_id);
      const name = String(b.name ?? "").trim();
      if (!from) return NextResponse.json({ error: "No such team." }, { status: 404 });
      if (name.length < 2 || name.length > 40) return NextResponse.json({ error: "Team names are 2 to 40 characters." }, { status: 400 });
      return done(await adminDb(g.admin, `Renamed team ${from} to ${name}`).from("hackathon_teams").update({ name }).eq("id", String(b.team_id)));
    }
    case "set_limit": {
      const team = await teamName(b.team_id);
      if (!team) return NextResponse.json({ error: "No such team." }, { status: 404 });
      const limit = b.limit === null || b.limit === "" ? null : Number(b.limit);
      if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 50)) {
        return NextResponse.json({ error: "A size limit is a whole number from 1 to 50." }, { status: 400 });
      }
      const note = limit === null ? `Removed team ${team}'s size override` : `Let team ${team} have up to ${limit}`;
      return done(await adminDb(g.admin, note).from("hackathon_teams").update({ max_size_override: limit }).eq("id", String(b.team_id)));
    }
    case "move": {
      const to = await teamName(b.to_team_id);
      if (!to) return NextResponse.json({ error: "No such team." }, { status: 404 });
      const who = await personName(b.user_id);
      return done(
        await adminDb(g.admin, `Moved ${who} to team ${to}${raise ? " (over the size limit)" : ""}`).rpc("hackathon_admin_move_member", {
          p_user_id: String(b.user_id),
          p_to_team: String(b.to_team_id),
          p_raise_limit: raise,
        }),
      );
    }
    case "remove": {
      const team = await teamName(b.team_id);
      if (!team) return NextResponse.json({ error: "No such team." }, { status: 404 });
      const who = await personName(b.user_id);
      const { error, count } = await adminDb(g.admin, `Removed ${who} from team ${team}`)
        .from("hackathon_team_members")
        .delete({ count: "exact" })
        .eq("team_id", String(b.team_id))
        .eq("user_id", String(b.user_id));
      if (error) return dbErrorResponse(error);
      if (!count) return NextResponse.json({ error: "They're not on that team." }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case "merge": {
      const [source, target] = await Promise.all([teamName(b.source_id), teamName(b.target_id)]);
      if (!source || !target) return NextResponse.json({ error: "No such team." }, { status: 404 });
      return done(
        await adminDb(g.admin, `Merged team ${source} into ${target}${raise ? " (over the size limit)" : ""}`).rpc("hackathon_admin_merge_teams", {
          p_source: String(b.source_id),
          p_target: String(b.target_id),
          p_raise_limit: raise,
        }),
      );
    }
    default:
      return NextResponse.json({ error: "Unknown team action." }, { status: 400 });
  }
}
