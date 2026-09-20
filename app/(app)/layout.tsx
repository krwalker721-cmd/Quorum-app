import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { assignUserToCohort } from "@/lib/cohorts";
import { enforceLapse, isEligibleForCohortPlacement } from "@/lib/lapse";
import { resolveEntitlement } from "@/lib/entitlements";
import { isWaitlistOn } from "@/lib/platform";
import { approveUser } from "@/lib/admin/approve";
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

  // Tour state. Onboarding is retired (its pitch moved to the landing page), so
  // this no longer gates the app; it only decides whether the guided tour runs.
  // A member who never finished the old onboarding, which is every new member
  // now, gets the tour from step 1. Fail-safe: if the row can't be read, the
  // tour stays hidden rather than popping up for someone who has seen it.
  let tourStep = 0;
  let tourCompleted = true;
  let startFresh = false;
  try {
    const { data: ob, error: obError } = await supabase
      .from("onboarding_progress")
      .select("completed, tour_step, tour_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!obError) {
      tourStep = (ob?.tour_step as number | null) ?? 0;
      tourCompleted = Boolean(ob?.tour_completed);
      startFresh = !ob?.completed;
    }
  } catch {
    // keep the fail-safe defaults
  }

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

  // Open signup (admin → Settings → platform_status: open): a pending member is
  // approved on arrival, which starts their trial and seats them in a cohort.
  // Done before the lapse and entitlement checks below, so this very render
  // already sees the trial. If approval fails, they're let in anyway, as they
  // always were with the waitlist off, and the next page load retries; sending
  // them to /pending would loop, since /pending sends everyone home when open.
  let status = profile?.status ?? null;
  let waitlistOn = true;
  if (status !== "approved" && status !== "suspended") {
    waitlistOn = await isWaitlistOn();
    if (!waitlistOn && status === "pending") {
      const outcome = await approveUser(createAdminClient(), user.id, { notify: false });
      if (outcome.result === "approved") status = "approved";
    }
  }

  // Resolve (and if the grace window has run out, act on) any lapse before the
  // banner reads subscription state, so both agree on the same render.
  // Best-effort: a failure here must never keep a member out of the app.
  let lapse: Awaited<ReturnType<typeof enforceLapse>> = { state: "ok" };
  try {
    lapse = await enforceLapse(user.id);
  } catch (e) {
    console.error("lapse check failed:", e);
  }

  // Entitlement for the trial banner, resolved through lib/entitlements.ts so the
  // server-rendered shell can't disagree with what TierContext tells the client.
  // It also self-heals here: a member whose webhook was missed is repaired on
  // their next page load rather than staying stuck on "free" (throttled, so a
  // genuinely lapsed account doesn't hit Stripe on every navigation).
  // Best-effort — a failure here must never keep a member out of the app.
  let entitlement: Awaited<ReturnType<typeof resolveEntitlement>> | null = null;
  try {
    entitlement = await resolveEntitlement(user.id, { reconcileIfBlocked: true });
  } catch (e) {
    console.error("entitlement resolve failed:", e);
  }

  if (status === "suspended") redirect("/suspended");
  if (waitlistOn && status !== "approved") redirect("/pending");

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
        <TourProvider tourStep={tourStep} tourCompleted={tourCompleted} startFresh={startFresh}>
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
              marginLeft: "var(--sidebar-w, 208px)",
              transition: "margin-left 0.25s ease",
            }}
          >
            <TrialBanner
              trialEndsAt={entitlement?.trialEndsAt ?? null}
              tier={entitlement?.tier ?? (profile?.tier as "free" | "member" | "partner") ?? "free"}
              status={entitlement?.status ?? "trialing"}
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
