#!/usr/bin/env node
// Run the app locally against the STAGING Supabase project.
//
//   node scripts/dev-staging.mjs        (port 3100)
//
// Values from .env.staging.local are handed to Next as real environment
// variables, which take priority over .env.local (Next never overrides a
// variable that's already set). The Supabase URL is rebuilt from the project
// ref so a stray path in the file can't break it. The build goes to its own
// folder, .next-staging, so a staging build and a production-pointed build
// never share compiled values.
//
// Refuses to start if the staging file points at the production project.

import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function parseEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const refOf = (url) => /^https?:\/\/([a-z0-9]+)\.supabase\.co/.exec(url ?? "")?.[1] ?? null;

const staging = parseEnv(resolve(root, ".env.staging.local"));
const prodRef = refOf(parseEnv(resolve(root, ".env.local")).NEXT_PUBLIC_SUPABASE_URL);
const ref = refOf(staging.NEXT_PUBLIC_SUPABASE_URL);

if (!ref || !staging.NEXT_PUBLIC_SUPABASE_ANON_KEY || !staging.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.staging.local.");
  process.exit(1);
}
if (ref === prodRef) {
  console.error(`REFUSING: .env.staging.local points at the production project (${prodRef}).`);
  process.exit(1);
}
// The anon key names its project; it must be staging's.
try {
  const payload = JSON.parse(Buffer.from(staging.NEXT_PUBLIC_SUPABASE_ANON_KEY.split(".")[1], "base64url").toString());
  if (payload.ref && payload.ref !== ref) {
    console.error(`REFUSING: the anon key in .env.staging.local is for project ${payload.ref}, not ${ref}.`);
    process.exit(1);
  }
} catch {
  // A newer, non-JWT key: nothing to check.
}

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: staging.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: staging.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_APP_URL: "http://localhost:3100",
  NEXT_DIST_DIR: ".next-staging",
};

console.log(`Running against STAGING project ${ref} on http://localhost:3100`);
const child = spawn(resolve(root, "node_modules/.bin/next"), ["dev", "-p", "3100"], { cwd: root, env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
