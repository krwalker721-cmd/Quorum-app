#!/usr/bin/env node
// Clean slate for the Hackathon feature: deletes every Sprint and everything
// hanging off it, the countdowns, the Hackathon admin logs and the files in
// the hackathon-submissions (screenshots) and hackathon-decks (035) buckets. Rows and files only: no table, function,
// policy or test is touched, and nothing outside the Hackathon feature
// (accounts, profiles, cohorts, payments, Pulse, Collab, Vault, DMs…).
//
//   node scripts/reset-hackathon-data.mjs staging
//   node scripts/reset-hackathon-data.mjs local
//   PRODUCTION_DB_URL=… node scripts/reset-hackathon-data.mjs production --allow-production
//
// What goes:
//   hackathons, which cascades to every hackathon_* table: registrations,
//     teams, team members, invitations, invite codes, join requests, team
//     messages, docs, links, votes, ballots, pulse, member activity, lobby
//     messages, submissions, judges, scores, awards, peer reviews and hackathon_admin_audit
//   site_countdowns (every countdown, the launch one included)
//   admin_change_log, the Hackathon admin screens' history (every row in it)
//   notifications whose kind starts with "hackathon_" (none exist today)
//   every file in the hackathon-submissions storage bucket
// Sprint numbers are max + 1 (migration 018), so the next Sprint is #1.
//
// First it counts, then deletes inside a transaction that is rolled back (a
// practice run, so a blocked delete shows up before anything is removed),
// then asks you to confirm. Test accounts are kept.
//
// Production: refused unless you pass --allow-production AND type the
// production project ref when asked. Its database URL is never stored in a
// file; pass it as PRODUCTION_DB_URL for that one run.
//
// Needs psql (brew install postgresql@16; PG_BIN overrides the folder).

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

const root = resolve(import.meta.dirname, "..");
const PSQL = resolve(process.env.PG_BIN ?? "/opt/homebrew/opt/postgresql@16/bin", "psql");
const BUCKETS = ["hackathon-submissions", "hackathon-decks"];

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
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
const allowProduction = args.includes("--allow-production");
const prodEnv = parseEnv(resolve(root, ".env.local"));
const prodRef = refOf(prodEnv.NEXT_PUBLIC_SUPABASE_URL);

// Where to connect: psql arguments, plus the Storage API for remote projects.
let psqlTarget, api, label;
if (target === "local") {
  // The test database from `scripts/db.sh local`. It has no Storage API.
  const data = resolve(process.env.TMPDIR ?? "/tmp", "quorum-pg16");
  psqlTarget = ["-h", data, "-p", "54329", "-U", "postgres", "-d", "quorum_test"];
  label = "LOCAL test database (quorum_test)";
} else if (target === "staging") {
  const env = parseEnv(resolve(root, ".env.staging.local"));
  const ref = refOf(env.NEXT_PUBLIC_SUPABASE_URL);
  const dbUrl = env.STAGING_DB_URL;
  if (!ref || !dbUrl || !env.SUPABASE_SERVICE_ROLE_KEY)
    fail("Fill in NEXT_PUBLIC_SUPABASE_URL, STAGING_DB_URL and SUPABASE_SERVICE_ROLE_KEY in .env.staging.local.");
  if (ref === prodRef || (prodRef && dbUrl.includes(prodRef)))
    fail(`REFUSING: .env.staging.local points at the production project (${prodRef}).`);
  if (!dbUrl.includes(ref)) fail(`REFUSING: STAGING_DB_URL is not for project ${ref}.`);
  psqlTarget = [dbUrl];
  api = { ref, key: env.SUPABASE_SERVICE_ROLE_KEY };
  label = `STAGING project ${ref}`;
} else if (target === "production") {
  if (!allowProduction)
    fail("REFUSING: this is production. Pass --allow-production as well if you really mean it.");
  if (!prodRef || !prodEnv.SUPABASE_SERVICE_ROLE_KEY)
    fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing in .env.local.");
  const dbUrl = process.env.PRODUCTION_DB_URL;
  if (!dbUrl) fail("Pass the production database URL as PRODUCTION_DB_URL for this run.");
  if (!dbUrl.includes(prodRef)) fail(`REFUSING: PRODUCTION_DB_URL is not for project ${prodRef}.`);
  psqlTarget = [dbUrl];
  api = { ref: prodRef, key: prodEnv.SUPABASE_SERVICE_ROLE_KEY };
  label = `PRODUCTION project ${prodRef}`;
} else {
  fail("Usage: node scripts/reset-hackathon-data.mjs local | staging | production --allow-production");
}
if (!existsSync(PSQL)) fail(`psql not found at ${PSQL} (brew install postgresql@16, or set PG_BIN).`);

// What the counts cover, in the order they're printed.
const TABLES = [
  ["hackathons", "Sprints"],
  ["hackathon_registrations", "registrations"],
  ["hackathon_teams", "teams"],
  ["hackathon_team_members", "team members"],
  ["hackathon_team_invitations", "team invitations"],
  ["hackathon_team_invite_codes", "team invite codes"],
  ["hackathon_team_join_requests", "join requests"],
  ["hackathon_team_messages", "team messages"],
  ["hackathon_team_docs", "team docs"],
  ["hackathon_team_links", "team links"],
  ["hackathon_team_votes", "team votes"],
  ["hackathon_team_ballots", "team ballots"],
  ["hackathon_team_pulse", "team pulse"],
  ["hackathon_team_member_activity", "team member activity"],
  ["hackathon_lobby_messages", "lobby messages"],
  ["hackathon_submissions", "submissions"],
  ["hackathon_judges", "judges"],
  ["hackathon_scores", "scores"],
  ["hackathon_awards", "awards"],
  ["hackathon_reviews", "peer reviews (036)"],
  ["hackathon_admin_audit", "admin audit (post-deadline edits)"],
  ["admin_change_log", "admin change log"],
  ["site_countdowns", "countdowns"],
  ["notifications", "Hackathon notifications", "where kind like 'hackathon\\_%'"],
];

const COUNT_SQL = TABLES.map(
  ([t, , where = ""]) => `select '${t}', count(*) from public.${t} ${where}`,
).join("\nunion all\n");

// Deleting the Sprints first lets every append-only guard see that its Sprint
// is gone (021, 031). The change log goes last, after the cascade has written
// its own "delete" entries. Its trigger refuses every DELETE (022), but a
// trigger on delete doesn't fire on TRUNCATE, which psql may run as the table
// owner. Its area check (022, 031) only allows the Hackathon admin screens'
// areas, so emptying it removes nothing else; the guard below refuses if that
// ever stops being true.
const CHANGE_LOG_AREAS = "('sprint', 'countdown', 'team', 'member', 'registration', 'judge', 'lobby', 'award')";
const DELETE_SQL = `
delete from public.hackathons;
delete from public.site_countdowns;
delete from public.notifications where kind like 'hackathon\\_%';
do $$ begin
  if exists (select 1 from public.admin_change_log where not (area in ${CHANGE_LOG_AREAS})) then
    raise exception 'admin_change_log holds rows from outside the Hackathon admin screens; not emptying it.';
  end if;
end $$;
truncate public.admin_change_log;
`;

function psql(sql) {
  const r = spawnSync(PSQL, [...psqlTarget, "-X", "-q", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
    env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" },
  });
  if (r.status !== 0) fail(`psql failed:\n${(r.stderr || r.stdout).trim()}`);
  return r.stdout;
}
const parseCounts = (out) =>
  Object.fromEntries(
    out
      .trim()
      .split("\n")
      .filter((l) => l.includes("\t"))
      .map((l) => l.split("\t"))
      .map(([t, n]) => [t, Number(n)]),
  );

// Storage: every file in each bucket, walking the team folders.
const storage = api
  ? createClient(`https://${api.ref}.supabase.co`, api.key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-quorum-via": "reset-hackathon-data script" } },
    }).storage
  : null;
async function listBucket(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) {
      if (/not found/i.test(error.message)) return files; // no bucket: nothing to delete
      fail(`Listing ${bucket}/${prefix}: ${error.message}`);
    }
    for (const o of data) {
      const path = prefix ? `${prefix}/${o.name}` : o.name;
      if (o.id === null) files.push(...(await listBucket(bucket, path)));
      else files.push(path);
    }
    if (data.length < 1000) return files;
  }
}
/** { bucket: [paths] } for every bucket, or null without a Storage API. */
async function listFiles() {
  if (!storage) return null;
  const out = {};
  for (const b of BUCKETS) out[b] = await listBucket(b);
  return out;
}
const fileCount = (files) => (files ? Object.values(files).reduce((n, l) => n + l.length, 0) : 0);

function printCounts(counts, files) {
  for (const [t, name] of TABLES) console.log(`  ${String(counts[t] ?? 0).padStart(6)}  ${name} (${t})`);
  if (files) for (const b of BUCKETS) console.log(`  ${String(files[b].length).padStart(6)}  files in the ${b} bucket`);
  else console.log(`       –  storage (no Storage API on the local test database)`);
}

// 1. What's there.
console.log(`Hackathon data on ${label}:\n`);
const before = parseCounts(psql(COUNT_SQL));
const files = await listFiles();
printCounts(before, files);

const total = Object.values(before).reduce((a, b) => a + b, 0) + fileCount(files);
if (total === 0) {
  console.log("\nNothing to delete: the Hackathon feature is already a clean slate here.");
  process.exit(0);
}

// 2. Practice run: delete inside a transaction, then roll it back.
const practice = parseCounts(psql(`begin;\n${DELETE_SQL}\n${COUNT_SQL};\nrollback;`));
const leftover = Object.entries(practice).filter(([, n]) => n > 0);
if (leftover.length) fail(`The practice run left rows behind (${leftover.map(([t, n]) => `${t}: ${n}`).join(", ")}). Nothing was deleted.`);
console.log("\nPractice run (rolled back): every row above can be deleted.");
console.log("Kept: every account and profile, and everything outside the Hackathon feature.");

// 3. Confirm.
const rl = createInterface({ input: process.stdin, output: process.stdout });
if (target === "production") {
  const typed = await rl.question(`\nThis deletes PRODUCTION data. Type the production project ref (${"*".repeat(prodRef.length)}) to continue: `);
  if (typed.trim() !== prodRef) {
    rl.close();
    fail("That isn't the production project ref. Nothing was deleted.");
  }
} else {
  const typed = await rl.question(`\nDelete all of this on ${label}? Type "delete" to continue: `);
  if (typed.trim().toLowerCase() !== "delete") {
    rl.close();
    fail("Not confirmed. Nothing was deleted.");
  }
}
rl.close();

// 4. Rows (one transaction), then files.
psql(`begin;\n${DELETE_SQL}\ncommit;`);
for (const [bucket, list] of Object.entries(files ?? {})) {
  for (let i = 0; i < list.length; i += 100) {
    const { error } = await storage.from(bucket).remove(list.slice(i, i + 100));
    if (error) fail(`Removing files from ${bucket}: ${error.message}. The rows are gone; run this again to finish the files.`);
  }
}

// 5. Check.
const after = parseCounts(psql(COUNT_SQL));
const filesAfter = await listFiles();
console.log(`\nAfter the reset on ${label}:\n`);
printCounts(after, filesAfter);
const left = Object.values(after).reduce((a, b) => a + b, 0) + fileCount(filesAfter);
if (left) fail("\nSomething was left behind (see above).");
console.log("\nClean slate. The next Sprint you create will be Sprint #1.");
