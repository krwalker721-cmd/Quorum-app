#!/usr/bin/env node
// One busy demo Sprint on STAGING, in its signup period or live.
//
//   node scripts/seed-staging-signup-demo.mjs         signup period, test admin not in it
//   node scripts/seed-staging-signup-demo.mjs live    live, test admin on Night Owls
//   node scripts/seed-staging-signup-demo.mjs watch   live, test admin watching from outside
//   node scripts/seed-staging-signup-demo.mjs judging judging, test admin is a judge
//
// Creates or resets "Signup demo" (slug signup-demo): published, registration
// opened a day ago, teams lock in 3 days, kickoff an hour after that, then the
// usual 48 h build and 48 h of judging. Times are relative to now, so running
// it again puts it back in its signup period.
//
// Signed up, from the test members (scripts/seed-staging.mjs):
//   Rockets     Maya, Leo, Priya   (3 of 4, closed to requests)
//   Night Owls  Sam, Jonah         (2 of 4, open to requests)
//   Solo Studio Theo               (1 of 4, open to requests)
//   random pool Ava, Noor
// plus a few lobby messages. The test admin and the spectator are left out,
// so either sees it as someone who hasn't joined.
//
// live: kicked off two hours ago, deadline in 46 h. The test admin is on
// Night Owls with Sam and Jonah (a few messages in the room), Ava and Noor
// joined Solo Studio, so nobody is left for the matcher. Everyone but the
// test admin has checked in. The spectator is still left out.
//
// watch: the same live Sprint seen from outside. Night Owls is Sam and Jonah;
// the test admin and the spectator are in no team. All three rooms have
// recent activity, Rockets has a complete (sealed) submission and Solo Studio
// a draft, so the arena reads "1 of 3 teams submitted".
//
// judging: the deadline was yesterday and judging closes in two days. Teams
// as in watch, every team with a complete submission. The test admin is an
// accepted judge with nothing scored yet; the spectator (the only other
// account in no team) is a second judge who has scored two of the three.
//
// Nothing else is touched.
// scripts/reset-hackathon-data.mjs removes it with everything else.
// Refuses production.

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
  global: { headers: { "x-quorum-via": "staging signup demo script" } },
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
const mode = process.argv[2] ?? "signup";
if (!["signup", "live", "watch", "judging"].includes(mode))
  throw new Error("Usage: node scripts/seed-staging-signup-demo.mjs [live | watch | judging]");
const live = mode !== "signup";
const meIn = mode === "live";

console.log(
  `Seeding the demo Sprint (${{ signup: "signup period", live: "live, test admin on Night Owls", watch: "live, test admin outside", judging: "judging, test admin judges" }[mode]}) on STAGING project ${ref}`,
);

const byEmail = async (email) => {
  const { data } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!data) throw new Error(`${email} is missing: run scripts/seed-staging.mjs first.`);
  return data.id;
};
const [maya, leo, priya, sam, jonah, ava, noor, theo] = await Promise.all(
  [1, 2, 3, 4, 5, 6, 7, 8].map((i) => byEmail(`member-${i}@quorum.test`)),
);
const me = await byEmail("admin-test@quorum.test").catch(() => {
  throw new Error("admin-test@quorum.test is missing: run scripts/db.sh staging:seed-admin first.");
});
const outsiders = meIn ? [] : [me];
{
  const { data } = await db.from("profiles").select("id").eq("email", "spectator-test@quorum.test").maybeSingle();
  if (data) outsiders.push(data.id);
}

// The Sprint.
const row = {
  slug: "signup-demo",
  title: "Signup demo",
  tagline: "48 hours to build a tool founders actually use",
  theme_hidden: "Tools for founders who build at night",
  rules:
    "- Build something **new** during the 48 hours.\n- Teams of 2 to 4, or join the random pool and we'll match you.\n- Submit before the deadline: the form locks on the dot.",
  ...(mode === "judging"
    ? {
        registration_opens_at: at(-6 * DAY),
        team_lock_at: at(-3 * DAY - HOUR),
        starts_at: at(-3 * DAY),
        ends_at: at(-DAY),
        judging_ends_at: at(2 * DAY),
        reveal_at: at(2 * DAY),
      }
    : live
    ? {
        registration_opens_at: at(-4 * DAY),
        team_lock_at: at(-3 * HOUR),
        starts_at: at(-2 * HOUR),
        ends_at: at(46 * HOUR),
        judging_ends_at: at(94 * HOUR),
        reveal_at: at(94 * HOUR),
      }
    : {
        registration_opens_at: at(-DAY),
        team_lock_at: at(3 * DAY),
        starts_at: at(3 * DAY + HOUR),
        ends_at: at(5 * DAY + HOUR),
        judging_ends_at: at(7 * DAY + HOUR),
        reveal_at: at(7 * DAY + HOUR),
      }),
  lobby_closes_at: null,
  max_team_size: 4,
  min_team_size: 2,
  is_published: true,
  show_countdown_in_app: true,
  show_countdown_on_landing: false,
  countdown_headline_override: null,
  lobby_welcome: "Welcome! Say hi, post what you'd like to build, and find a team before the lock.",
};
const { data: existing } = await db.from("hackathons").select("id, status_override").eq("slug", row.slug).maybeSingle();
let sprint;
if (existing) {
  if (existing.status_override) must(await db.from("hackathons").update({ status_override: null }).eq("id", existing.id), "unfreezing");
  must(await db.from("hackathons").update({ ...row, matched_at: null, match_report: null }).eq("id", existing.id), "resetting the Sprint");
  sprint = existing.id;
  // A fresh start for its people, so every run looks the same.
  must(await db.from("hackathon_teams").delete().eq("hackathon_id", sprint), "clearing teams");
  must(await db.from("hackathon_registrations").delete().eq("hackathon_id", sprint), "clearing registrations");
  must(await db.from("hackathon_judges").delete().eq("hackathon_id", sprint), "clearing judges");
  must(await db.from("hackathon_lobby_messages").delete().eq("hackathon_id", sprint).eq("is_system", false), "clearing the lobby");
} else {
  sprint = must(await db.from("hackathons").insert(row).select("id").single(), "creating the Sprint").id;
}
// Left out on purpose (in case an earlier run or a manual check signed them up).
if (outsiders.length) {
  must(await db.from("hackathon_registrations").delete().eq("hackathon_id", sprint).in("user_id", outsiders), "leaving the test admin and spectator out");
}

// People. The database's own guards don't apply to the service role.
async function register(userId, mode) {
  must(
    await db
      .from("hackathon_registrations")
      .upsert({ hackathon_id: sprint, user_id: userId, mode, withdrawn_at: null }, { onConflict: "hackathon_id,user_id" }),
    "registering",
  );
}
async function team(name, ids, style) {
  for (const u of ids) await register(u, "team");
  const id = must(await db.rpc("hackathon_admin_create_team", { p_hackathon_id: sprint, p_name: name, p_member_ids: ids }), `creating ${name}`);
  must(await db.from("hackathon_teams").update(style).eq("id", id), `styling ${name}`);
  return id;
}
const rockets = await team("Rockets", [maya, leo, priya], { emblem: "▲", color: "#f59e0b", is_open_to_requests: false });
const owls = await team("Night Owls", meIn ? [me, sam, jonah] : [sam, jonah], { emblem: "◉", color: "#a78bfa", is_open_to_requests: !live });
const studio = await team("Solo Studio", live ? [theo, ava, noor] : [theo], { emblem: "✦", color: "#2dd4bf", is_open_to_requests: !live });
if (!live) for (const u of [ava, noor]) await register(u, "random");

if (live) {
  // Everyone but the test admin checked in at kickoff, so the check-in is theirs to try.
  must(
    await db.from("hackathon_registrations").update({ checked_in_at: at(-110 * MIN) }).eq("hackathon_id", sprint).neq("user_id", me),
    "checking people in",
  );
}
if (mode === "watch" || mode === "judging") {
  // Something for the arena's pulses and counts to show.
  must(
    await db.from("hackathon_team_messages").insert([
      { team_id: rockets, user_id: maya, body: "Deck parser works on PDFs. Moving to the question generator.", created_at: at(-80 * MIN) },
      { team_id: rockets, user_id: priya, body: "Submitted a first version so we're safe, will keep improving it.", created_at: at(-6 * MIN) },
      { team_id: studio, user_id: theo, body: "Slack bot posts a draft check-in now!", created_at: at(-50 * MIN) },
      { team_id: studio, user_id: noor, body: "Started the submission draft, fill in the demo link when it's deployed.", created_at: at(-14 * MIN) },
    ]),
    "team messages",
  );
  must(
    await db.from("hackathon_submissions").insert([
      {
        hackathon_id: sprint,
        team_id: rockets,
        project_name: "Pitch Doctor",
        tagline: "Paste your deck, get the three questions investors will ask",
        problem: "First-time founders get blindsided by the same questions in every pitch meeting.",
        demo_url: "https://example.com/pitch-doctor",
        built_with: ["Python", "FastAPI", "Claude"],
        submitted_by: priya,
        last_edited_by: priya,
      },
      { hackathon_id: sprint, team_id: studio, project_name: "Standup Bot", submitted_by: noor, last_edited_by: noor },
    ]),
    "submissions",
  );
}
if (mode === "judging") {
  // Every team finished before the deadline.
  must(
    await db
      .from("hackathon_submissions")
      .update({
        tagline: "Your cohort's weekly check-in, written for you",
        problem: "Weekly check-ins take an hour to write and nobody reads the long ones.",
        description: "Drafts your weekly check-in from merged PRs, closed tickets and calendar notes. Edit it in a minute and post.",
        demo_url: "https://example.com/standup-bot",
        built_with: ["TypeScript", "Slack API"],
      })
      .eq("team_id", studio),
    "finishing Standup Bot",
  );
  must(
    await db.from("hackathon_submissions").insert({
      hackathon_id: sprint,
      team_id: owls,
      project_name: "Afterhours",
      tagline: "A planner that learns when you actually do your best work",
      problem: "Founders who build at night plan their days around office hours, then fight their own calendar every evening.",
      description:
        "Watches when you ship (commits, docs, messages) and builds your week around those hours.\n\n- GitHub and Google Calendar\n- Finds your three best windows\n- Moves meetings out of the way",
      demo_url: "https://example.com/afterhours",
      repo_url: "https://github.com/example/afterhours",
      built_with: ["Next.js", "Supabase"],
      submitted_by: sam,
      last_edited_by: sam,
    }),
    "submitting Afterhours",
  );

  // Judges: the test admin (nothing scored yet) and the spectator (two of three).
  const { data: spectator } = await db.from("profiles").select("id").eq("email", "spectator-test@quorum.test").maybeSingle();
  must(
    await db.from("hackathon_judges").insert(
      [me, spectator?.id].filter(Boolean).map((user_id) => ({ hackathon_id: sprint, user_id, accepted_at: at(-2 * DAY) })),
    ),
    "adding judges",
  );
  if (spectator) {
    const { data: subs } = await db.from("hackathon_submissions").select("id, team_id").eq("hackathon_id", sprint);
    const sub = (teamId) => subs.find((x) => x.team_id === teamId).id;
    must(
      await db.from("hackathon_scores").insert([
        { hackathon_id: sprint, submission_id: sub(rockets), judge_id: spectator.id, score_problem: 5, score_shipped: 5, score_collaboration: 4, score_potential: 5, notes: "Clear problem, polished demo." },
        { hackathon_id: sprint, submission_id: sub(owls), judge_id: spectator.id, score_problem: 4, score_shipped: 3, score_collaboration: 5, score_potential: 4, notes: "Would use it. Calendar sync was flaky in the demo." },
      ]),
      "the spectator's scores",
    );
  }
}
if (live) {
  must(
    await db.from("hackathon_team_messages").insert([
      { team_id: owls, user_id: sam, body: "Kickoff! Theme's up. I'm thinking a night-mode planner that knows when you actually work.", created_at: at(-115 * MIN) },
      { team_id: owls, user_id: jonah, body: "Love it. I'll sketch the screens tonight, can someone take the data side?", created_at: at(-90 * MIN) },
      { team_id: owls, user_id: sam, body: "Repo's set up, link in the links tab soon. Let's sync at midnight.", created_at: at(-25 * MIN) },
    ]),
    "Night Owls messages",
  );
}

// A lobby with a little life in it.
must(
  await db.from("hackathon_lobby_messages").insert([
    { hackathon_id: sprint, user_id: maya, body: "Rockets has one seat left, looking for someone who can design.", created_at: at(-20 * HOUR) },
    { hackathon_id: sprint, user_id: sam, body: "Night Owls is building something for people who work after midnight. Requests open!", created_at: at(-9 * HOUR) },
    { hackathon_id: sprint, user_id: ava, body: "In the random pool. Happy to go anywhere, I do frontend.", created_at: at(-3 * HOUR) },
    { hackathon_id: sprint, user_id: theo, body: "Solo for now. Anyone into AI tools for pitch decks?", created_at: at(-40 * MIN) },
  ]),
  "lobby messages",
);

const { data: view } = await db.from("hackathon_overview").select("number, title, state").eq("id", sprint).single();
const { count: regs } = await db.from("hackathon_registrations").select("*", { count: "exact", head: true }).eq("hackathon_id", sprint).is("withdrawn_at", null);
if (live) {
  console.log(
    `  #${view.number}  ${view.title}  ${view.state} · ${regs} in 3 teams · the test admin ${meIn ? "is on Night Owls" : mode === "judging" ? "is a judge" : "is watching from outside"}`,
  );
  console.log(
    mode === "judging"
      ? `  Judging closes ${new Date(t + 2 * DAY).toLocaleString()}. Judge: /hackathon/${view.number}/judge · admin: Sprints → #${view.number} → judging.`
      : `  Deadline ${new Date(t + 46 * HOUR).toLocaleString()}. Open /hackathon/${view.number}.`,
  );
} else {
  console.log(`  #${view.number}  ${view.title}  ${view.state} · ${regs} signed up · 3 teams + 2 in the random pool`);
  console.log(`  Teams lock ${new Date(t + 3 * DAY).toLocaleString()}. Open /hackathon/${view.number}.`);
}
