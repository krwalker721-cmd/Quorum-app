#!/usr/bin/env node
// Fake members and a test Sprint on STAGING, for clicking through the admin
// screens (participants, teams, judges, lobby) and, later, the team matcher.
//
//   node scripts/seed-staging.mjs
//
// Creates, if missing: test members member-1 … member-8 @quorum.test (approved,
// on a trial), a published Sprint "UI test" that is open for registration, all
// six registered, a team "Alpha" with two of them, and a few lobby messages.
// Safe to run again. Refuses to run against production.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
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
  global: { headers: { "x-quorum-via": "staging seed script" } },
});
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

// Members 7 and 8 (Phase 9) are a third team and a second judge in the
// judging Sprint (seed-staging-sprints.mjs).
const NAMES = ["Maya Chen", "Leo Okafor", "Priya Nair", "Sam Ortiz", "Jonah Weiss", "Ava Laurent", "Noor Haddad", "Theo Brandt"];
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

console.log(`Seeding STAGING project ${ref}`);

const ids = [];
for (const [i, name] of NAMES.entries()) {
  const email = `member-${i + 1}@quorum.test`;
  let { data: p } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!p) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: randomBytes(16).toString("hex"), // never signed into; nobody needs it
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) throw new Error(`creating ${email}: ${error.message}`);
    p = { id: data.user.id };
  }
  must(
    await db
      .from("profiles")
      .update({ status: "approved", trial_ends_at: new Date(Date.now() + 30 * DAY).toISOString() })
      .eq("id", p.id),
    `approving ${email}`,
  );
  ids.push(p.id);
}
console.log(`  ${ids.length} test members`);

let { data: sprint } = await db.from("hackathons").select("id").eq("slug", "ui-test").maybeSingle();
if (!sprint) {
  const t = Date.now();
  sprint = must(
    await db
      .from("hackathons")
      .insert({
        slug: "ui-test",
        title: "UI test",
        tagline: "A staging Sprint for clicking around",
        theme_hidden: "Staging only",
        max_team_size: 3,
        is_published: true,
        registration_opens_at: new Date(t - DAY).toISOString(),
        team_lock_at: new Date(t + 6 * DAY).toISOString(),
        starts_at: new Date(t + 7 * DAY).toISOString(),
        ends_at: new Date(t + 9 * DAY).toISOString(),
        judging_ends_at: new Date(t + 11 * DAY).toISOString(),
        reveal_at: new Date(t + 11 * DAY).toISOString(),
      })
      .select("id")
      .single(),
    "creating the Sprint",
  );
}
console.log(`  Sprint "UI test" (${sprint.id})`);

// Anyone made a judge of this Sprint in an admin check can't be registered
// (judges can't compete, 018), so they're left as judges.
const { data: judgeRows } = await db.from("hackathon_judges").select("user_id").eq("hackathon_id", sprint.id);
const judgeIds = new Set((judgeRows ?? []).map((j) => j.user_id));
for (const [i, id] of ids.entries()) {
  if (judgeIds.has(id)) continue;
  must(
    await db
      .from("hackathon_registrations")
      .upsert(
        { hackathon_id: sprint.id, user_id: id, mode: i % 2 ? "random" : "team", withdrawn_at: null },
        { onConflict: "hackathon_id,user_id" },
      ),
    "registering",
  );
}

const { data: alpha } = await db.from("hackathon_teams").select("id").eq("hackathon_id", sprint.id).eq("name", "Alpha").maybeSingle();
if (!alpha) {
  must(
    await db.rpc("hackathon_admin_create_team", { p_hackathon_id: sprint.id, p_name: "Alpha", p_member_ids: [ids[0], ids[2]] }),
    "creating team Alpha",
  );
}

const { count } = await db.from("hackathon_lobby_messages").select("id", { count: "exact", head: true }).eq("hackathon_id", sprint.id).eq("is_system", false);
if (!count) {
  must(
    await db.from("hackathon_lobby_messages").insert([
      { hackathon_id: sprint.id, user_id: ids[1], body: "Anyone want a designer? I'm in the random pool." },
      { hackathon_id: sprint.id, user_id: ids[0], body: "Team Alpha has room for one more backend person." },
    ]),
    "lobby messages",
  );
}
console.log("  registrations, team Alpha, lobby messages: done");
