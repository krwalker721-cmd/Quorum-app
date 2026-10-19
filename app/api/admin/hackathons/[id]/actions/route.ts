import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/admin/db";
import { dbErrorResponse, guard } from "@/lib/admin/hackathons";
import { MILESTONES, labelFor, missingMilestones, type Timeline } from "@/lib/hackathons/timeline";

type Ctx = { params: Promise<{ id: string }> };

function minutesText(n: number) {
  if (n % 1440 === 0) return `${n / 1440} day${n === 1440 ? "" : "s"}`;
  if (n % 60 === 0) return `${n / 60} hour${n === 60 ? "" : "s"}`;
  return `${n} minute${n === 1 ? "" : "s"}`;
}

// Sprint-wide actions. Each one is recorded in the change log with a note.
export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");

  const { data: sprint } = await createAdminClient().from("hackathons").select("*").eq("id", id).maybeSingle();
  if (!sprint) return NextResponse.json({ error: "No such Buildathon." }, { status: 404 });

  const run = async (note: string, f: (db: ReturnType<typeof adminDb>) => PromiseLike<{ error: unknown; data?: unknown }>) => {
    const { error, data } = await f(adminDb(g.admin, note));
    if (error) return dbErrorResponse(error as { message: string; hint?: string });
    return NextResponse.json({ ok: true, data: data ?? null });
  };

  switch (action) {
    case "publish": {
      const missing = missingMilestones(sprint as Timeline);
      if (missing.length) {
        return NextResponse.json({ error: `Set every date before publishing. Missing: ${missing.join(", ")}.` }, { status: 400 });
      }
      return run("Published the Buildathon", (db) => db.from("hackathons").update({ is_published: true }).eq("id", id));
    }
    case "unpublish":
      return run("Unpublished the Buildathon", (db) => db.from("hackathons").update({ is_published: false }).eq("id", id));

    case "pause":
      if (sprint.status_override) return NextResponse.json({ error: `The Buildathon is already ${sprint.status_override}.` }, { status: 400 });
      return run("Paused the Buildathon", (db) => db.from("hackathons").update({ status_override: "paused" }).eq("id", id));

    case "resume": {
      const extend = Boolean(body.extend);
      return run(extend ? "Resumed the Buildathon and gave back the paused time" : "Resumed the Buildathon", (db) =>
        db.rpc("hackathon_resume", { p_hackathon_id: id, p_extend: extend }),
      );
    }

    case "cancel":
      if (sprint.status_override === "cancelled") return NextResponse.json({ error: "The Buildathon is already cancelled." }, { status: 400 });
      return run("Cancelled the Buildathon", (db) => db.from("hackathons").update({ status_override: "cancelled" }).eq("id", id));

    case "uncancel":
      if (sprint.status_override !== "cancelled") return NextResponse.json({ error: "The Buildathon isn't cancelled." }, { status: 400 });
      return run("Reversed the cancellation", (db) => db.from("hackathons").update({ status_override: null }).eq("id", id));

    // Extend the deadline, or push any milestone (and everything after it)
    // back. Used by the emergency control and the countdown panel.
    case "shift": {
      const from = String(body.from ?? "ends_at");
      const minutes = Number(body.minutes);
      if (!MILESTONES.some((m) => m.key === from)) return NextResponse.json({ error: "Unknown milestone." }, { status: 400 });
      if (!Number.isInteger(minutes) || minutes < 1) return NextResponse.json({ error: "Enter a whole number of minutes." }, { status: 400 });
      const note =
        from === "ends_at"
          ? `Extended the deadline by ${minutesText(minutes)}`
          : `Pushed ${labelFor(from).toLowerCase()} and everything after it back by ${minutesText(minutes)}`;
      return run(note, (db) => db.rpc("hackathon_admin_shift", { p_hackathon_id: id, p_from: from, p_minutes: minutes }));
    }

    case "duplicate":
      return run(`Duplicated Buildathon #${sprint.number}`, (db) => db.rpc("hackathon_admin_duplicate", { p_hackathon_id: id }));

    // Once only (migration 026): a second run returns the first run's report.
    case "run_matcher":
      return run(`Ran the team matcher for Buildathon #${sprint.number}`, (db) =>
        db.rpc("hackathon_run_matcher", { p_hackathon_id: id }),
      );

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
