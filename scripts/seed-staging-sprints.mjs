#!/usr/bin/env node
// One test Sprint per state on STAGING, for checking the Hackathon tab.
//
//   node scripts/seed-staging-sprints.mjs
//
// Needs the test members from scripts/seed-staging.mjs (run that first) and
// the test admin from `scripts/db.sh staging:seed-admin`.
//
// Creates or resets, with times relative to NOW, so every run puts each one
// back in its state:
//   "State: upcoming", "State: registration", "State: teams locked",
//   "State: live", "State: judging", "State: revealed", "State: paused",
//   "State: cancelled", and "State: flips every 2 min", which walks through
//   every state, two minutes apart, starting two minutes after this runs.
//
// The test admin (admin-test@quorum.test) is registered in the registration
// Sprint (random pool), on team Rockets in the live Sprint, and a judge of the
// judging Sprint; everywhere else they're a spectator.
//
// Judging (Phase 9): the judging Sprint has three complete submissions
// (Rockets, Comets, Meteors) and a second judge, member 8 (Theo Brandt), to
// play from a script. Scores and awards are left as they are between runs.
//
// The flip Sprint is also the team matcher's demo: every run clears its teams
// and puts the test admin and five members in the random pool, with member 6
// on "Open Door", a team open to requests. Teams lock four minutes after the
// run, and the matcher runs when the Sprint page next loads.
// Landing-page countdowns are off for all of them. Refuses production.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = resolve(import.meta.dirname, "..");
const parseEnv = (p) =>
  existsSync(p)
    ? Object.fromEntries(
        readFileSync(p, "utf8")
          .split(/\r?\n/)
          .map((l) => /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l))
          .filter(Boolean)
          .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
      )
    : {};
const refOf = (url) => /^https?:\/\/([a-z0-9]+)\.supabase\.co/.exec(url ?? "")?.[1] ?? null;

const staging = parseEnv(resolve(root, ".env.staging.local"));
const ref = refOf(staging.NEXT_PUBLIC_SUPABASE_URL);
const prodRef = refOf(parseEnv(resolve(root, ".env.local")).NEXT_PUBLIC_SUPABASE_URL);
if (!ref || !staging.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Fill in .env.staging.local first.");
if (ref === prodRef) throw new Error(`REFUSING: .env.staging.local points at production (${prodRef}).`);

const db = createClient(`https://${ref}.supabase.co`, staging.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "x-quorum-via": "staging Sprint seed script" } },
});
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const t = Date.now();
const at = (offset) => new Date(t + offset).toISOString();

console.log(`Seeding test Sprints on STAGING project ${ref}`);

// The cast.
const members = [];
for (let i = 1; i <= 8; i++) {
  const { data } = await db.from("profiles").select("id").eq("email", `member-${i}@quorum.test`).maybeSingle();
  if (!data) throw new Error(`member-${i}@quorum.test is missing: run scripts/seed-staging.mjs first.`);
  members.push(data.id);
}
const { data: adminRow } = await db.from("profiles").select("id").eq("email", "admin-test@quorum.test").maybeSingle();
if (!adminRow) throw new Error("admin-test@quorum.test is missing: run scripts/db.sh staging:seed-admin first.");
const me = adminRow.id;

// Times for each phase, as offsets from now (registration, lock, kickoff,
// deadline, judging ends, reveal).
const times = (reg, lock, start, end, judged) => ({
  registration_opens_at: at(reg),
  team_lock_at: at(lock),
  starts_at: at(start),
  ends_at: at(end),
  judging_ends_at: at(judged),
  reveal_at: at(judged),
});

const SPRINTS = [
  { slug: "state-upcoming", title: "State: upcoming", ...times(2 * DAY, 5 * DAY, 6 * DAY, 8 * DAY, 10 * DAY) },
  { slug: "state-registration", title: "State: registration", ...times(-DAY, 3 * DAY, 4 * DAY, 6 * DAY, 8 * DAY) },
  { slug: "state-teams-locked", title: "State: teams locked", ...times(-5 * DAY, -2 * HOUR, 22 * HOUR, 70 * HOUR, 118 * HOUR) },
  { slug: "state-live", title: "State: live", ...times(-7 * DAY, -DAY, -20 * HOUR, 28 * HOUR, 76 * HOUR) },
  { slug: "state-judging", title: "State: judging", ...times(-10 * DAY, -4 * DAY, -3 * DAY, -DAY, 2 * DAY) },
  { slug: "state-revealed", title: "State: revealed", ...times(-20 * DAY, -15 * DAY, -14 * DAY, -12 * DAY, -10 * DAY) },
  { slug: "state-paused", title: "State: paused", ...times(-7 * DAY, -DAY, -10 * HOUR, 38 * HOUR, 86 * HOUR), pause: "paused" },
  { slug: "state-cancelled", title: "State: cancelled", ...times(-DAY, 3 * DAY, 4 * DAY, 6 * DAY, 8 * DAY), pause: "cancelled" },
  { slug: "state-flip", title: "State: flips every 2 min", ...times(2 * MIN, 4 * MIN, 6 * MIN, 8 * MIN, 10 * MIN) },
];

const sprintIds = {};
for (const s of SPRINTS) {
  const { pause, ...fields } = s;
  const row = {
    ...fields,
    tagline: "A staging Sprint for checking one state of the Hackathon tab",
    theme_hidden: "Tools for founders who build at night",
    rules:
      "- A business idea, taken to a working MVP or proven with something real.\n- Teams of 2 to 4.\n- Submit before the deadline: the form locks on the dot.",
    max_team_size: 4,
    min_team_size: 2,
    is_published: true,
    show_countdown_on_landing: false,
    show_countdown_in_app: true,
    countdown_headline_override: null,
    lobby_closes_at: null,
  };
  const { data: existing } = await db.from("hackathons").select("id, status_override").eq("slug", s.slug).maybeSingle();
  let id;
  if (existing) {
    // Clear any pause first, so the new times land and the freeze time is fresh.
    if (existing.status_override) must(await db.from("hackathons").update({ status_override: null }).eq("id", existing.id), `unfreezing ${s.slug}`);
    must(await db.from("hackathons").update(row).eq("id", existing.id), `resetting ${s.slug}`);
    id = existing.id;
  } else {
    id = must(await db.from("hackathons").insert(row).select("id").single(), `creating ${s.slug}`).id;
  }
  sprintIds[s.slug] = id;
}

// People and teams. The database's own guards don't apply to the service
// role, so registering and teaming up works whatever the Sprint's state.
async function register(sprint, userId, mode) {
  must(
    await db
      .from("hackathon_registrations")
      .upsert({ hackathon_id: sprint, user_id: userId, mode, withdrawn_at: null }, { onConflict: "hackathon_id,user_id" }),
    "registering",
  );
}
async function team(sprint, name, ids) {
  const { data } = await db.from("hackathon_teams").select("id").eq("hackathon_id", sprint).eq("name", name).maybeSingle();
  if (data) return data.id;
  for (const u of ids) await register(sprint, u, "team");
  return must(
    await db.rpc("hackathon_admin_create_team", { p_hackathon_id: sprint, p_name: name, p_member_ids: ids }),
    `creating team ${name}`,
  );
}
// A complete submission (030): name, tagline, problem and a demo. An older
// one missing the problem or demo is filled in (same values: no log entry).
async function submit(sprint, teamId, name, tagline, problem, demo) {
  const fields = {
    project_name: name,
    tagline,
    problem: problem ?? `Founders lose hours to work ${name} could do for them.`,
    demo_url: demo ?? `https://example.com/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  };
  const { data } = await db.from("hackathon_submissions").select("id, is_complete").eq("team_id", teamId).maybeSingle();
  if (data) {
    if (!data.is_complete) must(await db.from("hackathon_submissions").update(fields).eq("id", data.id), `completing ${name}`);
    return data.id;
  }
  return must(
    await db
      .from("hackathon_submissions")
      .insert({ hackathon_id: sprint, team_id: teamId, ...fields })
      .select("id")
      .single(),
    `submitting ${name}`,
  ).id;
}
async function judge(sprint, userId) {
  const { data } = await db.from("hackathon_judges").select("id").eq("hackathon_id", sprint).eq("user_id", userId).maybeSingle();
  if (!data) {
    must(
      await db.from("hackathon_judges").insert({ hackathon_id: sprint, user_id: userId, accepted_at: new Date().toISOString() }),
      "adding a judge",
    );
  }
}

const [m1, m2, m3, m4, m5, m6, m7, m8] = members;

// Registration: some in the pool, one team forming, the test admin in the pool.
{
  const s = sprintIds["state-registration"];
  await team(s, "Rockets", [m1, m2]);
  for (const u of [m3, m4, m5]) await register(s, u, "random");
  await register(s, me, "random");
}
// Teams locked: final teams.
{
  const s = sprintIds["state-teams-locked"];
  await team(s, "Rockets", [m1, m2, m3]);
  await team(s, "Comets", [m4, m5, m6]);
}
// Live and paused: the test admin is on Rockets.
for (const slug of ["state-live", "state-paused"]) {
  const s = sprintIds[slug];
  const rockets = await team(s, "Rockets", [me, m1, m2]);
  const comets = await team(s, "Comets", [m3, m4, m5]);
  {
    const { count } = await db.from("hackathon_team_messages").select("id", { count: "exact", head: true }).eq("team_id", rockets).eq("is_system", false);
    if (!count) {
      must(
        await db.from("hackathon_team_messages").insert([
          { team_id: rockets, user_id: m1, body: "Pushed the first screen.", created_at: at(-4 * MIN) },
          { team_id: comets, user_id: m3, body: "Landing page is up.", created_at: at(-3 * HOUR) },
        ]),
        "team messages",
      );
    }
  }
}
// The flip Sprint: a fresh random pool for the matcher each run.
{
  const s = sprintIds["state-flip"];
  must(await db.from("hackathon_teams").delete().eq("hackathon_id", s), "clearing the flip Sprint's teams");
  must(await db.from("hackathons").update({ matched_at: null, match_report: null }).eq("id", s), "resetting the matcher");
  for (const u of [me, m1, m2, m3, m4, m5]) await register(s, u, "random");
  await team(s, "Open Door", [m6]);
  must(await db.from("hackathon_teams").update({ is_open_to_requests: true }).eq("hackathon_id", s).eq("name", "Open Door"), "opening Open Door");
}
// Judging: three complete submissions; the test admin and Theo (member 8) judge.
{
  const s = sprintIds["state-judging"];
  const rockets = await team(s, "Rockets", [m1, m2, m3]);
  const comets = await team(s, "Comets", [m4, m5, m6]);
  const meteors = await team(s, "Meteors", [m7]);
  await submit(s, rockets, "Nightshift", "A focus timer for founders who work after midnight",
    "Late-night builders lose track of time and burn out by Wednesday.");
  await submit(s, comets, "Standup Bot", "Your cohort's weekly check-in, written for you",
    "Weekly check-ins take an hour to write and nobody reads the long ones.");
  await submit(s, meteors, "Pitch Doctor", "Paste your deck, get the three questions investors will ask",
    "First-time founders get blindsided by the same questions in every pitch.");
  await judge(s, me);
  await judge(s, m8);
}
// Revealed: both submitted, two awards.
{
  const s = sprintIds["state-revealed"];
  const rockets = await team(s, "Rockets", [m1, m2, m3]);
  const comets = await team(s, "Comets", [m4, m5, m6]);
  const a = await submit(s, rockets, "Nightshift", "A focus timer for founders who work after midnight");
  const b = await submit(s, comets, "Standup Bot", "Your cohort's weekly check-in, written for you");
  // Shown at the reveal once finalized (031). Finalizing again is a no-op.
  const { count } = await db.from("hackathon_awards").select("id", { count: "exact", head: true }).eq("hackathon_id", s);
  if (!count) {
    must(
      await db.from("hackathon_awards").insert([
        { hackathon_id: s, submission_id: a, award_type: "judges_pick" },
        { hackathon_id: s, submission_id: b, award_type: "most_shipped" },
      ]),
      "awards",
    );
  }
  must(await db.rpc("hackathon_finalize_awards", { p_hackathon_id: s }), "finalizing the awards");
}
// Cancelled: a few people had registered.
{
  const s = sprintIds["state-cancelled"];
  await team(s, "Rockets", [m1, m2]);
}

// Pause and cancel last, so the setup above happened on a running Sprint.
for (const s of SPRINTS.filter((x) => x.pause)) {
  must(await db.from("hackathons").update({ status_override: s.pause }).eq("id", sprintIds[s.slug]), `${s.pause} ${s.slug}`);
}

const { data: rows } = await db
  .from("hackathon_overview")
  .select("number, title, state")
  .in("id", Object.values(sprintIds))
  .order("number");
for (const r of rows ?? []) console.log(`  #${r.number}  ${r.title.padEnd(26)} ${r.state}`);
console.log(`The flip Sprint opens registration at ${new Date(t + 2 * MIN).toLocaleTimeString()} and changes state every 2 minutes.`);
