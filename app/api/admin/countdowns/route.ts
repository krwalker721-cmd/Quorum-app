import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/admin/db";
import { dbErrorResponse, guard } from "@/lib/admin/hackathons";
import { nextMilestone, labelFor } from "@/lib/hackathons/timeline";
import { formatNy } from "@/lib/time/newYork";

// The countdown control panel: standalone countdowns (site_countdowns) and the
// countdown switches of each Sprint. Every change is logged in
// admin_change_log with a note starting "Countdown:".

const SITE_FIELDS = [
  "key", "label", "subtext", "target_at", "is_enabled", "show_on_landing", "show_in_app",
  "zero_behavior", "zero_message", "cta_label", "cta_url", "is_launch",
] as const;

function siteValues(body: Record<string, unknown>): { ok: true; values: Record<string, unknown> } | { ok: false; error: string } {
  const v: Record<string, unknown> = {};
  for (const f of SITE_FIELDS) {
    if (!(f in body)) continue;
    const x = body[f];
    if (f === "is_enabled" || f === "show_on_landing" || f === "show_in_app" || f === "is_launch") v[f] = Boolean(x);
    else if (f === "target_at") {
      const ms = typeof x === "string" ? Date.parse(x) : NaN;
      if (Number.isNaN(ms)) return { ok: false, error: "Pick a target time." };
      v[f] = new Date(ms).toISOString();
    } else {
      const s = typeof x === "string" ? x.trim() : "";
      v[f] = s === "" ? null : s;
    }
  }
  if ("key" in v && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(v.key ?? ""))) {
    return { ok: false, error: "The key uses lower-case letters, numbers and single dashes, e.g. launch." };
  }
  if ("label" in v && !v.label) return { ok: false, error: "Give it a headline." };
  if (v.zero_behavior === "show_message" && "zero_message" in v && !v.zero_message) {
    return { ok: false, error: "Write the message to show at zero, or choose to hide it." };
  }
  if (("cta_label" in v || "cta_url" in v) && Boolean(v.cta_label) !== Boolean(v.cta_url)) {
    return { ok: false, error: "A button needs both a label and a link." };
  }
  if (v.cta_url && !/^(https?:\/\/|\/)\S*$/.test(String(v.cta_url))) {
    return { ok: false, error: "The link should start with / or https://." };
  }
  return { ok: true, values: v };
}

export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const db = createAdminClient();

  const [site, sprints, status, log] = await Promise.all([
    db.from("site_countdowns").select("*").order("target_at"),
    db
      .from("hackathon_overview")
      .select("id, number, title, state, is_published, status_override, registration_opens_at, starts_at, ends_at, reveal_at, show_countdown_in_app, show_countdown_on_landing, countdown_headline_override")
      .order("number", { ascending: false }),
    db.from("platform_settings").select("value").eq("key", "platform_status").maybeSingle(),
    db
      .from("admin_change_log")
      .select("id, area, action, summary, subject, changes, actor, created_at")
      .or(`area.eq.countdown,summary.ilike."Countdown:*"`)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);
  if (site.error) return dbErrorResponse(site.error, 500);

  const editorIds = Array.from(new Set((site.data ?? []).map((c) => c.updated_by).filter(Boolean))) as string[];
  const { data: editors } = editorIds.length
    ? await db.from("profiles").select("id, full_name, username").in("id", editorIds)
    : { data: [] };
  const nameOf = new Map((editors ?? []).map((p) => [p.id, p.full_name?.trim() || p.username || "admin"]));

  return NextResponse.json({
    // kind: "site" so the shared countdown logic (and its previews) treat
    // these as standalone countdowns.
    site: (site.data ?? []).map((c) => ({ kind: "site", ...c, updated_by_name: c.updated_by ? nameOf.get(c.updated_by) ?? null : null })),
    sprints: (sprints.data ?? []).filter((s) => s.state !== "revealed"),
    platform_status: status.data?.value ?? "waitlist",
    log: log.data ?? [],
  });
}

function minutesText(n: number) {
  if (n % 1440 === 0) return `${n / 1440} day${n === 1440 ? "" : "s"}`;
  if (n % 60 === 0) return `${n / 60} hour${n === 60 ? "" : "s"}`;
  return `${n} minutes`;
}

export async function POST(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const op = String(b.op ?? "");
  const read = createAdminClient();
  const done = (r: { error: unknown }) =>
    r.error ? dbErrorResponse(r.error as { message: string; hint?: string }) : NextResponse.json({ ok: true });

  switch (op) {
    case "create": {
      const parsed = siteValues((b.values ?? {}) as Record<string, unknown>);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      if (!parsed.values.key || !parsed.values.label || !parsed.values.target_at) {
        return NextResponse.json({ error: "A countdown needs a key, a headline and a target time." }, { status: 400 });
      }
      return done(
        await adminDb(g.admin, `Countdown: created "${parsed.values.key}"`)
          .from("site_countdowns")
          .insert({ ...parsed.values, updated_by: g.admin.id }),
      );
    }

    case "update": {
      const id = String(b.id ?? "");
      const { data: current } = await read.from("site_countdowns").select("key, target_at, is_enabled").eq("id", id).maybeSingle();
      if (!current) return NextResponse.json({ error: "No such countdown." }, { status: 404 });
      const parsed = siteValues((b.values ?? {}) as Record<string, unknown>);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const v = parsed.values;
      const note =
        "is_enabled" in v && Object.keys(v).length === 1
          ? `Countdown: turned "${current.key}" ${v.is_enabled ? "on" : "off"}`
          : "target_at" in v && Object.keys(v).length === 1
            ? `Countdown: moved "${current.key}" from ${formatNy(current.target_at)} to ${formatNy(String(v.target_at))}`
            : `Countdown: edited "${current.key}"`;
      return done(await adminDb(g.admin, note).from("site_countdowns").update({ ...v, updated_by: g.admin.id }).eq("id", id));
    }

    case "push_back": {
      const minutes = Number(b.minutes);
      if (!Number.isInteger(minutes) || minutes < 1) return NextResponse.json({ error: "Push back by a whole number of minutes." }, { status: 400 });

      if (b.kind === "site") {
        const id = String(b.id ?? "");
        const { data: c } = await read.from("site_countdowns").select("key, target_at").eq("id", id).maybeSingle();
        if (!c) return NextResponse.json({ error: "No such countdown." }, { status: 404 });
        const next = new Date(Date.parse(c.target_at) + minutes * 60_000).toISOString();
        return done(
          await adminDb(g.admin, `Countdown: pushed "${c.key}" back ${minutesText(minutes)}, to ${formatNy(next)}`)
            .from("site_countdowns")
            .update({ target_at: next, updated_by: g.admin.id })
            .eq("id", id),
        );
      }

      // A Sprint countdown moves by moving the Sprint: the milestone it counts
      // to right now, and everything after it.
      const id = String(b.id ?? "");
      const { data: s } = await read
        .from("hackathons")
        .select("number, registration_opens_at, starts_at, ends_at, reveal_at")
        .eq("id", id)
        .maybeSingle();
      if (!s) return NextResponse.json({ error: "No such Buildathon." }, { status: 404 });
      const { data: dbNow } = await read.rpc("server_now");
      const next = nextMilestone(s, dbNow ? Date.parse(dbNow as string) : Date.now());
      if (!next) return NextResponse.json({ error: "This Buildathon has nothing left to count down to." }, { status: 400 });
      return done(
        await adminDb(g.admin, `Countdown: pushed Buildathon #${s.number}'s ${labelFor(next.key).toLowerCase()} and everything after it back ${minutesText(minutes)}`).rpc(
          "hackathon_admin_shift",
          { p_hackathon_id: id, p_from: next.key, p_minutes: minutes },
        ),
      );
    }

    case "sprint_toggle": {
      const field = String(b.field ?? "");
      if (field !== "show_countdown_in_app" && field !== "show_countdown_on_landing") {
        return NextResponse.json({ error: "Unknown switch." }, { status: 400 });
      }
      const { data: s } = await read.from("hackathons").select("number").eq("id", String(b.id ?? "")).maybeSingle();
      if (!s) return NextResponse.json({ error: "No such Buildathon." }, { status: 404 });
      const where = field === "show_countdown_in_app" ? "in the app" : "on the landing page";
      return done(
        await adminDb(g.admin, `Countdown: ${b.value ? "showing" : "hiding"} Buildathon #${s.number}'s countdown ${where}`)
          .from("hackathons")
          .update({ [field]: Boolean(b.value) })
          .eq("id", String(b.id)),
      );
    }

    case "delete": {
      const { data: c } = await read.from("site_countdowns").select("key").eq("id", String(b.id ?? "")).maybeSingle();
      if (!c) return NextResponse.json({ error: "No such countdown." }, { status: 404 });
      return done(await adminDb(g.admin, `Countdown: deleted "${c.key}"`).from("site_countdowns").delete().eq("id", String(b.id)));
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
