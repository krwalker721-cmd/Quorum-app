import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { assignUserToCohort } from "@/lib/cohorts";
import { enforceLapse, isEligibleForCohortPlacement } from "@/lib/lapse";
import { WAITLIST_ENABLED } from "@/lib/flags";
import Sidebar from "@/components/Sidebar";
import { PresenceProvider } from "@/components/PresenceProvider";
import NotificationsProvider from "@/components/NotificationsProvider";
import TrialBanner from "@/components/TrialBanner";
import { TierProvider } from "@/contexts/TierContext";
import { TourProvider } from "@/contexts/TourContext";
import { trackLoginEvent } from "@/lib/referral-helpers";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // New users must finish onboarding before reaching any app page. Fail open
  // (skip the gate) if the table can't be read — e.g. the migration hasn't been
  // applied yet — so a read error can never lock a user out of the app. NOTE:
  // redirect() throws, so it must live outside the try/catch.
  let onboardingComplete = true;
  let tourStep = 0;
  let tourCompleted = true; // fail-safe: never surface the tour on a read error
  try {
    const { data: ob } = await supabase
      .from("onboarding_progress")
      .select("completed, tour_step, tour_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    onboardingComplete = Boolean(ob?.completed);
    tourStep = (ob?.tour_step as number | null) ?? 0;
    tourCompleted = Boolean(ob?.tour_completed);
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
    .select("id, full_name, stage, status, tier, username")
    .eq("id", user.id)
    .single();

  // Resolve (and if the grace window has run out, act on) any lapse before the
  // banner reads subscription state, so both agree on the same render.
  // Best-effort: a failure here must never keep a member out of the app.
  let lapse: Awaited<ReturnType<typeof enforceLapse>> = { state: "ok" };
  try {
    lapse = await enforceLapse(user.id);
  } catch (e) {
    console.error("lapse check failed:", e);
  }

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

  // Safety net: an onboarding-complete user who somehow has no cohort (completed
  // before auto-assign shipped, or a transient failure during the completion
  // write) gets placed on their next sign-in. Reuses the membership lookup above
  // so there's no extra query in the common case; assignUserToCohort is
  // idempotent and needs a service-role client to read every cohort. Best-effort.
  // NOTE: gated on placement eligibility. A seat released for non-payment must
  // not be handed straight back by this safety net on the very next page load.
  if (!cohortIdForDots) {
    try {
      if (await isEligibleForCohortPlacement(user.id)) {
        cohortIdForDots = await assignUserToCohort(createAdminClient(), user.id);
      }
    } catch (e) {
      console.error("cohort auto-assign failed on sign-in:", e);
    }
  }

  return (
    <PresenceProvider currentUserId={user.id}>
      <NotificationsProvider currentUserId={user.id} cohortId={cohortIdForDots}>
        <TierProvider>
        <TourProvider tourStep={tourStep} tourCompleted={tourCompleted}>
        <div className="min-h-screen root-layout">
          <Sidebar
            currentUser={{
              full_name: profile?.full_name ?? null,
              stage: profile?.stage ?? null,
              username: (profile as { username?: string | null } | null)?.username ?? null,
            }}
          />
          <div
            className="app-content"
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
              lapse={lapse}
            />
            {children}
          </div>
        </div>
        </TourProvider>
        </TierProvider>
      </NotificationsProvider>
    </PresenceProvider>
  );
}
