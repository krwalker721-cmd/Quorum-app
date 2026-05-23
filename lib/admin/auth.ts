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

// Verify an incoming admin request. Expects the x-admin-code header.
export async function verifyAdminRequest(req: Request): Promise<boolean> {
  const provided = req.headers.get("x-admin-code");
  if (!provided) return false;
  const expected = await getAdminCode();
  if (!expected) return false;
  return provided === expected;
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
