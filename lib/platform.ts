import { createAdminClient } from "@/lib/supabase/server";

// Whether new signups wait for approval. Set from the admin panel (Settings →
// platform_status: "waitlist" or "open") and stored in platform_settings. This
// replaced a hard-coded WAITLIST_ENABLED constant that the admin switch never
// actually reached.
//
// Fails toward the waitlist: if the setting can't be read, nobody gets in
// unapproved.
export async function isWaitlistOn(): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_status")
      .maybeSingle();
    if (error) return true;
    return (data?.value ?? "waitlist") !== "open";
  } catch {
    return true;
  }
}
