import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

// Returns the currently configured admin code. Reads from platform_settings;
// falls back to the ADMIN_CODE env var when the row hasn't been set.
export async function getAdminCode(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "admin_code")
    .maybeSingle();
  if (data?.value) return data.value;
  return process.env.ADMIN_CODE ?? null;
}

// Rate limiting. Every admin route accepts the code, so every one of them was a
// place to guess it, without limit. The limit lives here, in the check they
// all share, rather than on the login screen alone.
const WINDOW_MS = 15 * 60 * 1000;
/** Distinct wrong codes one address may send per window before it's locked out. */
const MAX_FAILURES_PER_IP = 5;
/** Distinct wrong codes from everywhere, per window, before the check closes for
 *  everyone. Stops guessing spread across many addresses, at the cost that an
 *  attacker can lock the admin out for up to one window. */
const MAX_FAILURES_GLOBAL = 50;

export type AdminCodeCheck = "ok" | "wrong" | "locked";

function clientIp(req: Request): string {
  // Vercel sets x-forwarded-for to the real client address.
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function sameCode(a: string, b: string): boolean {
  // Hash both so the comparison takes the same time whatever the input.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Keyed, so the attempt log never holds anything a leak could turn back into
// a near-miss of the real code.
function hashAttempt(code: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "admin-attempts";
  return createHmac("sha256", key).update(code).digest("hex").slice(0, 32);
}

/**
 * Check an admin code, counting wrong ones against the sender. Only distinct
 * wrong codes count, so an admin tab still sending an old code after it was
 * changed counts once, not once per request. Fails closed: if the attempt log
 * can't be read, nothing gets in.
 */
export async function checkAdminCode(
  req: Request,
  provided: string | null | undefined,
): Promise<AdminCodeCheck> {
  if (!provided) return "wrong";

  const admin = createAdminClient();
  const ip = clientIp(req);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const [perIp, global] = await Promise.all([
    admin
      .from("admin_auth_failures")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since),
    admin
      .from("admin_auth_failures")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);
  // A count-only query against a missing table comes back with no error and a
  // null count, so a null count is treated as unreadable too. A working count
  // is always a number.
  if (perIp.error || global.error || perIp.count === null || global.count === null) {
    console.error(
      "[admin] attempt log unreadable:",
      perIp.error?.message || global.error?.message || "count unavailable",
    );
    return "locked";
  }
  if ((perIp.count ?? 0) >= MAX_FAILURES_PER_IP || (global.count ?? 0) >= MAX_FAILURES_GLOBAL) {
    return "locked";
  }

  const expected = await getAdminCode();
  if (expected && sameCode(provided, expected)) return "ok";

  const code_hash = hashAttempt(provided);
  const { count: seen } = await admin
    .from("admin_auth_failures")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("code_hash", code_hash)
    .gte("created_at", since);
  if (!seen) {
    const { error: logErr } = await admin.from("admin_auth_failures").insert({ ip, code_hash });
    if (logErr) console.error("[admin] could not record a wrong code:", logErr.message);
    // Keep the log small: nothing older than a day matters.
    await admin
      .from("admin_auth_failures")
      .delete()
      .lt("created_at", new Date(Date.now() - 86_400_000).toISOString());
  }
  return "wrong";
}

// Verify an incoming admin request. Expects the x-admin-code header.
export async function verifyAdminRequest(req: Request): Promise<boolean> {
  return (await checkAdminCode(req, req.headers.get("x-admin-code"))) === "ok";
}

// Helper to read a platform setting (no auth — caller decides).
export async function getSetting(key: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("platform_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
}
