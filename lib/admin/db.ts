import { createClient as createSbClient } from "@supabase/supabase-js";
import type { AdminSession } from "@/lib/admin/auth";

/**
 * A service-role client that tells the database who is acting and why.
 *
 * The change-log triggers (migrations 021 to 023) read these request headers,
 * so every change made through this client is recorded under the admin's name
 * with a one-line note, e.g. "Merged Comets into Rockets". Header values must
 * be ASCII, so the note travels base64-encoded and the name is looked up from
 * the account id in the database.
 *
 * Server only, like createAdminClient().
 */
export function adminDb(admin: AdminSession, action?: string) {
  const headers: Record<string, string> = {
    "x-quorum-actor-id": admin.id,
    "x-quorum-via": `admin console, ${admin.ip.replace(/[^\x20-\x7e]/g, "")}`,
  };
  if (action) {
    headers["x-quorum-action-b64"] = Buffer.from(action.slice(0, 300), "utf8").toString("base64");
  }
  return createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers },
  });
}
