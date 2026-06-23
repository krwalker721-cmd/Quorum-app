import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { WAITLIST_ENABLED } from "@/lib/flags";
import Sidebar from "@/components/Sidebar";
import { PresenceProvider } from "@/components/PresenceProvider";
import NotificationsProvider from "@/components/NotificationsProvider";
import AppOverlay from "@/components/AppOverlay";
import TrialBanner from "@/components/TrialBanner";
import { TierProvider } from "@/contexts/TierContext";
import { trackLoginEvent } from "@/lib/referral-helpers";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // New users must finish onboarding before reaching any app page. Fail open
  // (skip the gate) if the table can't be read — e.g. the migration hasn't been
  // applied yet — so a read error can never lock a user out of the app. NOTE:
  // redirect() throws, so it must live outside the try/catch.
  let onboardingComplete = true;
  try {
    const { data: ob } = await supabase
      .from("onboarding_progress")
      .select("completed")
      .eq("user_id", user.id)
      .maybeSingle();
    onboardingComplete = Boolean(ob?.completed);
  } catch {
    onboardingComplete = true;
  }
  if (!onboardingComplete) redirect("/onboarding");

  // Record a login event for the referral 3-day activity gate. Fire-and-forget,
  // never awaited — the daily upsert dedups, and a failure must never block the
  // page render.
  trackLoginEvent(user.id).catch((e) =>
    console.error("trackLoginEvent failed:", e),
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, stage, status, tier")
    .eq("id", user.id)
    .single();

  // Subscription status + trial info for the trial banner (best-effort).
  let subStatus = "trialing";
  let trialEndsAt: string | null = null;
  try {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sub) {
      subStatus = sub.status ?? "trialing";
      trialEndsAt = (sub.trial_ends_at as string | null) ?? null;
    }
  } catch {}

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

  // Total approved nodes for the status bar — best-effort.
  let nodeCount = cohort.length;
  try {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved");
    if (typeof count === "number") nodeCount = count;
  } catch {}

  // Pick the first cohort the user is a member of (used to scope cohort dot).
  let cohortIdForDots: string | null = null;
  try {
    const { data: membership } = await supabase
      .from("cohort_members")
      .select("cohort_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    cohortIdForDots = (membership?.cohort_id as string | null) ?? null;
  } catch {}

  return (
    <PresenceProvider currentUserId={user.id}>
      <NotificationsProvider currentUserId={user.id} cohortId={cohortIdForDots}>
        <TierProvider>
        <div className="min-h-screen root-layout">
          <Sidebar cohort={cohort} currentUserId={user.id} />
          <div
            style={{
              marginLeft: "var(--sidebar-w, 240px)",
              paddingBottom: 20,
              transition: "margin-left 0.25s ease",
            }}
          >
            <TrialBanner
              trialEndsAt={trialEndsAt}
              tier={(profile?.tier as "free" | "member" | "partner") ?? "free"}
              status={subStatus}
            />
            {children}
          </div>
          <AppOverlay nodeCount={nodeCount} />
        </div>
        </TierProvider>
      </NotificationsProvider>
    </PresenceProvider>
  );
}
