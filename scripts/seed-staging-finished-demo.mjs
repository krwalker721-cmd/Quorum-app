#!/usr/bin/env node
// One finished demo Sprint on STAGING: built, judged and revealed, with a
// complete submission from every team and finalized awards, for seeing the
// results, the gallery and the public recap and project pages.
//
//   node scripts/seed-staging-finished-demo.mjs
//
// Creates or resets "Finished demo" (slug finished-demo): kicked off ten days
// ago, the reveal was yesterday. Times are relative to now, so running it
// again keeps it revealed.
//
// Teams, from the test members (scripts/seed-staging.mjs):
//   Night Owls   the test admin, Sam, Jonah   → "Afterhours"
//   Rockets      Maya, Leo, Priya             → "Pitch Doctor"
//   Solo Studio  Theo, Ava, Noor              → "Standup Bot"
// Awards: Judges' pick (Afterhours), Most shipped and Most likely to become
// real (Pitch Doctor), Best collaboration (Standup Bot). No judges or scores:
// the judging screens show none. The spectator is left out.
//
// Nothing else is touched. scripts/reset-hackathon-data.mjs removes it with
// everything else. Refuses production.

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
  global: { headers: { "x-quorum-via": "staging finished demo script" } },
});
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const t = Date.now();
const at = (offset) => new Date(t + offset).toISOString();

console.log(`Seeding the finished demo Sprint on STAGING project ${ref}`);

const byEmail = async (email, hint) => {
  const { data } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!data) throw new Error(`${email} is missing: run ${hint} first.`);
  return data.id;
};
const [maya, leo, priya, sam, jonah, ava, noor, theo] = await Promise.all(
  [1, 2, 3, 4, 5, 6, 7, 8].map((i) => byEmail(`member-${i}@quorum.test`, "scripts/seed-staging.mjs")),
);
const me = await byEmail("admin-test@quorum.test", "scripts/db.sh staging:seed-admin");

// The Sprint. Kickoff ten days ago; 48 h build; judging until yesterday's reveal.
const kickoff = -10 * DAY;
const row = {
  slug: "finished-demo",
  title: "Finished demo",
  tagline: "48 hours to build a tool founders actually use",
  theme_hidden: "Tools for founders who build at night",
  rules:
    "- Build something **new** during the 48 hours.\n- Teams of 2 to 4, or join the random pool and we'll match you.\n- Submit before the deadline: the form locks on the dot.",
  registration_opens_at: at(kickoff - 7 * DAY),
  team_lock_at: at(kickoff - HOUR),
  starts_at: at(kickoff),
  ends_at: at(kickoff + 2 * DAY),
  judging_ends_at: at(-DAY),
  reveal_at: at(-DAY),
  lobby_closes_at: null,
  max_team_size: 4,
  min_team_size: 2,
  is_published: true,
  show_countdown_in_app: true,
  show_countdown_on_landing: false,
  countdown_headline_override: null,
};
const { data: existing } = await db.from("hackathons").select("id, status_override, awards_finalized_at").eq("slug", row.slug).maybeSingle();
let sprint;
if (existing) {
  sprint = existing.id;
  if (existing.status_override) must(await db.from("hackathons").update({ status_override: null }).eq("id", sprint), "unfreezing");
  // Reopen the awards so they (and the teams under them) can be cleared.
  if (existing.awards_finalized_at) must(await db.rpc("hackathon_unfinalize_awards", { p_hackathon_id: sprint }), "reopening the awards");
  must(await db.from("hackathons").update(row).eq("id", sprint), "resetting the Sprint");
  must(await db.from("hackathon_teams").delete().eq("hackathon_id", sprint), "clearing teams");
  must(await db.from("hackathon_registrations").delete().eq("hackathon_id", sprint), "clearing registrations");
} else {
  sprint = must(await db.from("hackathons").insert(row).select("id").single(), "creating the Sprint").id;
}

// People. The database's own guards don't apply to the service role.
async function team(name, ids, style) {
  for (const u of ids) {
    must(
      await db
        .from("hackathon_registrations")
        .upsert({ hackathon_id: sprint, user_id: u, mode: "team", withdrawn_at: null, checked_in_at: at(kickoff + 10 * 60_000) }, { onConflict: "hackathon_id,user_id" }),
      "registering",
    );
  }
  const id = must(await db.rpc("hackathon_admin_create_team", { p_hackathon_id: sprint, p_name: name, p_member_ids: ids }), `creating ${name}`);
  must(await db.from("hackathon_teams").update({ ...style, is_open_to_requests: false }).eq("id", id), `styling ${name}`);
  return id;
}
const owls = await team("Night Owls", [me, sam, jonah], { emblem: "◉", color: "#a78bfa" });
const rockets = await team("Rockets", [maya, leo, priya], { emblem: "▲", color: "#f59e0b" });
const studio = await team("Solo Studio", [theo, ava, noor], { emblem: "✦", color: "#2dd4bf" });

// One complete submission per team (030: name, tagline, problem and a demo).
async function submit(teamId, by, p) {
  return must(
    await db
      .from("hackathon_submissions")
      .insert({ hackathon_id: sprint, team_id: teamId, submitted_by: by, last_edited_by: by, ...p })
      .select("id")
      .single(),
    `submitting ${p.project_name}`,
  ).id;
}
const afterhours = await submit(owls, sam, {
  project_name: "Afterhours",
  tagline: "A planner that learns when you actually do your best work",
  problem: "Founders who build at night plan their days around office hours, then fight their own calendar every evening.",
  description:
    "Afterhours watches when you ship (commits, docs, messages) and builds your week around those hours instead of nine to five.\n\n" +
    "**What works today**\n- Connects to GitHub and Google Calendar\n- Finds your three most productive windows\n- Blocks them and moves meetings out of the way\n\n" +
    "**Next**: a nudge when you're about to burn out.",
  demo_url: "https://example.com/afterhours",
  repo_url: "https://github.com/example/afterhours",
  built_with: ["Next.js", "Supabase", "Google Calendar API"],
});
const pitchDoctor = await submit(rockets, maya, {
  project_name: "Pitch Doctor",
  tagline: "Paste your deck, get the three questions investors will ask",
  problem: "First-time founders get blindsided by the same questions in every pitch meeting.",
  description:
    "Upload a deck and Pitch Doctor reads it the way a partner would: it flags the slide that raises the hardest question and drafts an answer from your own numbers.\n\n" +
    "- Works with PDF and Google Slides\n- Practice mode reads the questions out loud\n- Shares a one-page prep sheet with your co-founder",
  demo_url: "https://example.com/pitch-doctor",
  repo_url: "https://github.com/example/pitch-doctor",
  video_url: "https://example.com/pitch-doctor/demo-video",
  built_with: ["Python", "FastAPI", "Claude", "React"],
});
const standupBot = await submit(studio, theo, {
  project_name: "Standup Bot",
  tagline: "Your cohort's weekly check-in, written for you",
  problem: "Weekly check-ins take an hour to write and nobody reads the long ones.",
  description:
    "Standup Bot drafts your weekly check-in from what you actually did: merged PRs, closed tickets and calendar notes. You edit it in a minute and post.\n\n" +
    "Built by three people who met in the random pool on Friday night.",
  demo_url: "https://example.com/standup-bot",
  built_with: ["TypeScript", "Slack API", "Linear API"],
});

// Awards, then finalize: public once revealed AND finalized (031).
must(
  await db.from("hackathon_awards").insert([
    { hackathon_id: sprint, submission_id: afterhours, award_type: "judges_pick", citation: "The one every judge wanted to use the next morning." },
    { hackathon_id: sprint, submission_id: pitchDoctor, award_type: "most_shipped", citation: "Three integrations, a practice mode and a demo video in 48 hours." },
    { hackathon_id: sprint, submission_id: pitchDoctor, award_type: "most_likely_to_become_real", citation: "Two founders asked for access during judging." },
    { hackathon_id: sprint, submission_id: standupBot, award_type: "best_collaboration", citation: "Strangers on Friday, a shipped product by Sunday." },
  ]),
  "awards",
);
must(await db.rpc("hackathon_finalize_awards", { p_hackathon_id: sprint }), "finalizing the awards");

const { data: view } = await db.from("hackathon_overview").select("number, title, state").eq("id", sprint).single();
console.log(`  #${view.number}  ${view.title}  ${view.state} · 3 teams, 3 submissions, 4 awards (finalized)`);
console.log(`  Members: /hackathon/${view.number} · public: /hackathon/${view.number}/recap and /hackathon/${view.number}/project/night-owls`);
