import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { WAITLIST_ENABLED } from "@/lib/flags";
import Sidebar from "@/components/Sidebar";
import { PresenceProvider } from "@/components/PresenceProvider";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, stage, status, tier")
    .eq("id", user.id)
    .single();

  if (profile?.status === "suspended") redirect("/suspended");
  if (WAITLIST_ENABLED && profile?.status !== "approved") redirect("/pending");

  // Maintenance mode check (skips for admin section — admin uses its own route).
  try {
    const admin = createAdminClient();
    const { data: maint } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();
    if (maint?.value === "true") redirect("/maintenance");
  } catch {}

  // Best-effort activity log (powers admin "active this week" metric).
  // Throttle: skip if a session row exists for this user in the last hour.
  try {
    const admin = createAdminClient();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("sessions")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", hourAgo)
      .limit(1);
    if (!recent || recent.length === 0) {
      await admin.from("sessions").insert({ user_id: user.id });
    }
  } catch {}

  const { data: cohortRaw } = await supabase
    .from("profiles")
    .select("id, full_name, stage, username")
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(20);

  const cohort = cohortRaw ?? [];

  return (
    <PresenceProvider currentUserId={user.id}>
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar cohort={cohort} currentUserId={user.id} />
        <div style={{ marginLeft: 192 }}>{children}</div>
      </div>
    </PresenceProvider>
  );
}
