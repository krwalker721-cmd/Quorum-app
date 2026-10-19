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
// Peer reviews (036): everyone reviews the two projects that aren't theirs,
// with ratings, a line of feedback and a favourite, and the awards are then
// worked out by the database exactly as at a real reveal (Community pick,
// Most shipped, Most likely to become real, Crowd favourite). Night Owls'
// room shows its anonymous feedback. The spectator is left out.
//
// Decks (035): Afterhours and Pitch Doctor get a short generated PDF in the
// hackathon-decks bucket, for the demo day stage; Standup Bot has none, to
// show a team presenting without slides.
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

// The standard tagline, rules and welcome, read from lib/hackathons/defaults.ts
// so the demo says exactly what a new Buildathon starts with.
const defaultsSrc = readFileSync(resolve(root, "lib/hackathons/defaults.ts"), "utf8");
const standard = (name) => {
  const m = new RegExp(`export const ${name} =\\s*(?:\`([\\s\\S]*?)\`|"((?:[^"\\\\]|\\\\.)*)");`).exec(defaultsSrc);
  if (!m) throw new Error(`${name} not found in lib/hackathons/defaults.ts`);
  return m[1] ?? JSON.parse(`"${m[2]}"`);
};

// The Sprint. Kickoff ten days ago; 48 h build; judging until yesterday's reveal.
const kickoff = -10 * DAY;
const row = {
  slug: "finished-demo",
  title: "Buildathon",
  tagline: standard("DEFAULT_TAGLINE"),
  theme_hidden: "Tools for founders who build at night",
  rules: standard("DEFAULT_RULES"),
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
  must(await db.from("hackathons").update({ ...row, reviews_assigned_at: null }).eq("id", sprint), "resetting the Sprint");
  must(await db.from("hackathon_teams").delete().eq("hackathon_id", sprint), "clearing teams");
  await clearDecks(sprint);
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

// Decks for two of the three (035).
await addDeck(sprint, owls, afterhours, "Afterhours.pdf", [
  ["Afterhours", "A planner that learns when you actually do your best work"],
  ["The problem", "Founders who build at night plan around office hours, then fight their calendar every evening."],
  ["What we built", "It reads your commits, docs and messages, finds your three best windows, and moves meetings out of them."],
  ["Next", "A nudge before you burn out. Try it: example.com/afterhours"],
]);
await addDeck(sprint, rockets, pitchDoctor, "Pitch Doctor.pdf", [
  ["Pitch Doctor", "Paste your deck, get the three questions investors will ask"],
  ["Why", "First-time founders get blindsided by the same questions in every pitch meeting."],
  ["How it works", "It reads the deck like a partner would and drafts answers from your own numbers."],
]);

// Peer reviews (036), then the awards, worked out as at a real reveal.
must(await db.rpc("hackathon_assign_reviews", { p_hackathon_id: sprint }), "handing out the reviews");
const { data: given } = await db.from("hackathon_reviews").select("id, reviewer_id, submission_id").eq("hackathon_id", sprint).order("position");
const RATINGS = {
  [afterhours]: [5, 4, 5],
  [pitchDoctor]: [4, 5, 4],
  [standupBot]: [4, 3, 4],
};
const NOTES = {
  [afterhours]: [["The calendar move is genuinely clever.", "Show what happens on a day with no free windows."], ["I'd use this tonight.", null], ["Clean, calm design.", "Let me pick my own focus hours too."]],
  [pitchDoctor]: [["The practice mode is great.", "Shorter answers would read faster."], ["Most complete demo I saw.", null], ["Useful for every first pitch.", "Add a pricing slide."]],
  [standupBot]: [["Writing check-ins is a real pain; this fixes it.", "Support more than Slack."], ["Simple and quick.", "The draft could sound more like me."], [null, "Show a before and after."]],
};
const seen = {};
const favouredBy = new Set();
for (const r of given ?? []) {
  const i = (seen[r.submission_id] = (seen[r.submission_id] ?? -1) + 1);
  const [p, w, u] = RATINGS[r.submission_id];
  const [strength, suggestion] = NOTES[r.submission_id][i % 3];
  // Each reviewer's favourite: Standup Bot when they saw it, else Afterhours.
  const fav = !favouredBy.has(r.reviewer_id) && (r.submission_id === standupBot || (r.submission_id === afterhours && !(given ?? []).some((x) => x.reviewer_id === r.reviewer_id && x.submission_id === standupBot)));
  if (fav) favouredBy.add(r.reviewer_id);
  must(
    await db.from("hackathon_reviews").update({ score_problem: p, score_works: w, score_use: u, strength, suggestion, is_favourite: fav }).eq("id", r.id),
    "filling a review",
  );
}
const awarded = must(await db.rpc("hackathon_compute_awards", { p_hackathon_id: sprint, p_force: true }), "working out the awards");

const { data: view } = await db.from("hackathon_overview").select("number, title, state").eq("id", sprint).single();
console.log(`  #${view.number}  ${view.title}  ${view.state} · 3 teams, 3 submissions, ${(given ?? []).length} reviews, ${awarded} awards worked out`);
console.log(`  Members: /hackathon/${view.number} · public: /hackathon/${view.number}/recap and /hackathon/${view.number}/project/night-owls`);

// ── Decks: a tiny PDF, one slide per page, in the team's folder.
async function clearDecks(sprintId) {
  const { data: folders } = await db.storage.from("hackathon-decks").list(sprintId, { limit: 1000 });
  for (const f of folders ?? []) {
    const { data: files } = await db.storage.from("hackathon-decks").list(`${sprintId}/${f.name}`, { limit: 1000 });
    const paths = (files ?? []).map((x) => `${sprintId}/${f.name}/${x.name}`);
    if (paths.length) await db.storage.from("hackathon-decks").remove(paths);
  }
}
async function addDeck(sprintId, teamId, submissionId, name, slides) {
  const bytes = makePdf(slides);
  const path = `${sprintId}/${teamId}/deck-demo.pdf`;
  const up = await db.storage.from("hackathon-decks").upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(`uploading ${name}: ${up.error.message}`);
  must(
    await db.from("hackathon_submissions").update({ presentation_path: path, presentation_name: name, presentation_size: bytes.length }).eq("id", submissionId),
    `attaching ${name}`,
  );
}
/** A valid little PDF: 16:9 pages, a dark slide with a title and a line of text. */
function makePdf(slides) {
  const esc = (t) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const wrap = (t, n) => t.split(" ").reduce((lines, w) => {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= n) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
    return lines;
  }, []);
  const objs = [];
  const add = (body) => objs.push(body) && objs.length;
  const catalog = add("<< /Type /Catalog /Pages 2 0 R >>");
  add("PAGES");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const font2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pages = [];
  slides.forEach(([title, text], i) => {
    const lines = wrap(text, 52);
    const content =
      `0.05 0.07 0.09 rg 0 0 960 540 re f 0.96 0.62 0.04 rg 60 470 120 4 re f ` +
      `BT /F1 44 Tf 0.95 0.95 0.95 rg 60 400 Td (${esc(title)}) Tj ET ` +
      lines.map((l, k) => `BT /F2 24 Tf 0.75 0.78 0.82 rg 60 ${330 - k * 34} Td (${esc(l)}) Tj ET`).join(" ") +
      ` BT /F2 14 Tf 0.5 0.53 0.58 rg 60 40 Td (Quorum Sprint demo deck - ${i + 1} / ${slides.length}) Tj ET`;
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    pages.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Resources << /Font << /F1 ${font} 0 R /F2 ${font2} 0 R >> >> /Contents ${stream} 0 R >>`));
  });
  objs[1] = `<< /Type /Pages /Kids [${pages.map((p) => `${p} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
