#!/usr/bin/env node
// Test members "working" in the live test Sprint on STAGING, so the arena's
// pulse has something to show.
//
//   node scripts/simulate-sprint-activity.mjs            # 3 minutes, a post every 8 s
//   node scripts/simulate-sprint-activity.mjs 10 5       # 10 minutes, every 5 s
//   node scripts/simulate-sprint-activity.mjs --submit   # also submit for one team, halfway
//
// Each tick, a random member of a random team in "State: live" (#6, from
// seed-staging-sprints.mjs) posts a message in their team room. The text is
// a marker ("simulated activity") so a network check can look for it: it
// must never reach a spectator. Refuses to run against production.

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

const args = process.argv.slice(2);
const submit = args.includes("--submit");
const [minutes = 3, everySeconds = 8] = args.filter((a) => !a.startsWith("--")).map(Number);

const db = createClient(`https://${ref}.supabase.co`, staging.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "x-quorum-via": "staging activity simulator" } },
});

const { data: sprint } = await db.from("hackathons").select("id, number").eq("slug", "state-live").maybeSingle();
if (!sprint) throw new Error('No "State: live" Sprint: run scripts/seed-staging-sprints.mjs first.');
const { data: teams } = await db.from("hackathon_teams").select("id, name").eq("hackathon_id", sprint.id);
const { data: members } = await db.from("hackathon_team_members").select("team_id, user_id").eq("hackathon_id", sprint.id);
if (!teams?.length) throw new Error("The live test Sprint has no teams.");

const LINES = [
  "simulated activity: pushed a commit",
  "simulated activity: new screen is up",
  "simulated activity: fixed the login bug",
  "simulated activity: who's on the landing copy?",
  "simulated activity: demo video recorded",
];
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

console.log(`Simulating activity in Sprint #${sprint.number} on STAGING ${ref} for ${minutes} min, every ${everySeconds} s`);
const end = Date.now() + minutes * 60_000;
let submitted = false;
while (Date.now() < end) {
  const team = pick(teams);
  const who = pick((members ?? []).filter((m) => m.team_id === team.id));
  if (who) {
    const { error } = await db.from("hackathon_team_messages").insert({ team_id: team.id, user_id: who.user_id, body: pick(LINES) });
    console.log(`  ${new Date().toLocaleTimeString()}  ${team.name}${error ? `  (failed: ${error.message})` : ""}`);
  }
  if (submit && !submitted && Date.now() > end - (minutes * 60_000) / 2) {
    const team0 = teams[0];
    const { error } = await db
      .from("hackathon_submissions")
      .upsert({ team_id: team0.id, hackathon_id: sprint.id, project_name: "simulated activity: sealed project" }, { onConflict: "team_id" });
    console.log(`  ${new Date().toLocaleTimeString()}  ${team0.name} submitted${error ? `  (failed: ${error.message})` : ""}`);
    submitted = true;
  }
  await new Promise((r) => setTimeout(r, everySeconds * 1000));
}
console.log("Done.");
