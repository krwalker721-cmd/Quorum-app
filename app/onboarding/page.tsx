"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/components/onboarding-v2/theme";

import { OnboardingScrollProvider, useOnboardingScroll } from "@/components/onboarding-v2/scroll";
import { Atmosphere } from "@/components/onboarding-v2/Atmosphere";
import { ProgressSpine, type Identity } from "@/components/onboarding-v2/ProgressSpine";
import { ChapterOpening } from "@/components/onboarding-v2/ChapterOpening";
import { ChapterQuestion } from "@/components/onboarding-v2/ChapterQuestion";
import { ChapterBarGraph } from "@/components/onboarding-v2/ChapterBarGraph";
import { ChapterManifesto } from "@/components/onboarding-v2/ChapterManifesto";
import { ChapterIntroduction } from "@/components/onboarding-v2/ChapterIntroduction";
import { ChapterIntro } from "@/components/onboarding-v2/ChapterIntro";
import { ChapterFounderNames } from "@/components/onboarding-v2/ChapterFounderNames";
import { ChapterProfile } from "@/components/onboarding-v2/ChapterProfile";
import { ChapterSkills } from "@/components/onboarding-v2/ChapterSkills";
import { ChapterReferral } from "@/components/onboarding-v2/ChapterReferral";
import { ChapterHandoff } from "@/components/onboarding-v2/ChapterHandoff";

// Saved current_step → chapter anchor, so a returning user lands where they left
// off. Steps align with the chapter ids for the interactive chapters — each
// markComplete(n) fires when the matching chapter-n is finished, so resuming to
// chapter-n drops the user back on the last chapter they actually completed.
const STEP_TO_CHAPTER: Record<number, string> = {
  7: "chapter-7",
  8: "chapter-8",
};

// Restores the saved scroll position once, from inside the scroll provider so it
// can drive Lenis's own scrollTo (a native scrollIntoView would be clobbered by
// Lenis on the next frame). Rendered as a child of OnboardingScrollProvider.
function ScrollRestorer({ targetId }: { targetId: string | null }) {
  const { scrollTo } = useOnboardingScroll();
  const done = useRef(false);

  useEffect(() => {
    if (!targetId || done.current) return;
    done.current = true;
    // A short delay lets the tall chapter runways lay out so the target offset
    // is final before we jump. Lenis recomputes limits on scrollTo regardless.
    const t = setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) scrollTo(el);
    }, 300);
    return () => clearTimeout(t);
  }, [targetId, scrollTo]);

  return null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [resumeTargetId, setResumeTargetId] = useState<string | null>(null);

  // The founder identity the ProgressSpine renders — fills in as the user builds
  // themselves into the room across the action chapters.
  const [identity, setIdentity] = useState<Identity>({
    name: null,
    stage: null,
    skillCount: 0,
    cohortName: null,
  });

  // Mount: trial init (once) + restore scroll position.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/onboarding");
        if (res.ok) {
          const data = await res.json();
          if (!data.trial_initialized) {
            void fetch("/api/onboarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ trial_initialized: true }),
            });
            void fetch("/api/subscription/initialize", { method: "POST" });
          }
          // Restore scroll position on return visits. Hand the resolved target
          // to <ScrollRestorer/>, which drives Lenis from inside the provider —
          // a native scroll here would be overwritten by Lenis a frame later.
          if (!data.completed && typeof data.current_step === "number") {
            const target = STEP_TO_CHAPTER[data.current_step];
            if (target) setResumeTargetId(target);
          }
        }
      } catch {
        // best-effort
      }
    })();
  }, []);

  // Persist progress at a completion moment. Best-effort — scroll never blocks
  // on the write.
  function markComplete(step: number) {
    void fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_step: step }),
    }).catch(() => {});
  }

  async function completeOnboarding(redirectTo: string) {
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, current_step: 18 }),
      });
    } catch {
      // best-effort — still route the user on
    }
    router.push(redirectTo);
  }

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        width: "100%",
        // NOTE: must be `clip`, not `hidden`. `overflow-x: hidden` implicitly
        // turns this div into a scroll container, which breaks `position: sticky`
        // on every chapter (no pin, animations fire after scrolling past). `clip`
        // still suppresses horizontal scroll without creating a scroll container.
        overflowX: "clip",
        position: "relative",
      }}
    >
      <OnboardingScrollProvider>
      {/* Resumes a returning user to their last completed chapter. */}
      <ScrollRestorer targetId={resumeTargetId} />
      {/* The living background — rides document scroll behind everything. */}
      <Atmosphere />
      {/* The persistent HUD — progress rail, chapter counter, founder card. */}
      <ProgressSpine identity={identity} />

      {/* Content sits above the fixed atmosphere. */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Cold open. */}
        <ChapterOpening />

        {/* Act I — the case. */}
        <ChapterQuestion />
        <ChapterBarGraph />
        <ChapterManifesto />
        <ChapterIntroduction />
        <ChapterFounderNames />

        {/* Act II — build yourself into the room. Each step gets its own intro
            slide that says what it is before you fill it in. */}
        <ChapterIntro
          id="intro-profile"
          index="06"
          title="Your profile"
          blurb="Before anything else, your cohort needs to know who you are and what you're building."
          accent={C.green}
          motif="profile"
        />
        <ChapterProfile
          onComplete={() => markComplete(7)}
          onIdentity={(d) => setIdentity((p) => ({ ...p, name: d.name, stage: d.stage }))}
        />

        <ChapterIntro
          id="intro-skills"
          index="07"
          title="Your experience"
          blurb="Experience is how founders find each other here — name what you've actually done, so the right people reach out."
          accent={C.amber}
          motif="skills"
        />
        <ChapterSkills
          onComplete={() => markComplete(8)}
          onIdentity={(skillCount) => setIdentity((p) => ({ ...p, skillCount }))}
        />

        {/* The rest of "building yourself in" — meeting the cohort, first post,
            the weekly check-in, the collab board — now happens hands-on in the
            in-app guided tour that runs the moment onboarding completes. See
            contexts/TourContext.tsx. */}

        {/* Act III — the last ask before the handoff. The journey recap used to
            sit here; it restated work the founder had just done a screen ago, so
            it's cut. */}
        <ChapterIntro
          id="intro-referral"
          index="08"
          title="Referrals"
          blurb="Refer founders you rate. The more you bring in, the less you pay — and the stronger the room gets."
          accent={C.amber}
          motif="referral"
        />
        <ChapterReferral />
        {/* Closing beat — completes onboarding and hands off into the app,
            where the tour runs and the pricing decision is its finale. */}
        <ChapterHandoff onComplete={completeOnboarding} />
      </div>
      </OnboardingScrollProvider>
    </div>
  );
}
