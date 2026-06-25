"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { C } from "@/components/onboarding-v2/theme";
import type { CohortData, CohortMember } from "@/components/onboarding-v2/types";

import { OnboardingScrollProvider } from "@/components/onboarding-v2/scroll";
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
import { ChapterCohort } from "@/components/onboarding-v2/ChapterCohort";
import { ChapterFirstPost } from "@/components/onboarding-v2/ChapterFirstPost";
import { ChapterCheckin } from "@/components/onboarding-v2/ChapterCheckin";
import { ChapterCollabHorizontal } from "@/components/onboarding-v2/ChapterCollabHorizontal";
import { ChapterSummary } from "@/components/onboarding-v2/ChapterSummary";
import { ChapterReferral } from "@/components/onboarding-v2/ChapterReferral";
import { ChapterPricing } from "@/components/onboarding-v2/ChapterPricing";

// Saved current_step → chapter anchor, so a returning user lands where they left
// off. Steps align with the chapter ids for the interactive chapters.
const STEP_TO_CHAPTER: Record<number, string> = {
  7: "chapter-7",
  8: "chapter-8",
  9: "chapter-9",
  10: "chapter-10",
  11: "chapter-11",
  12: "chapter-12",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [cohort, setCohort] = useState<CohortData | null>(null);
  const [cohortId, setCohortId] = useState<string | null>(null);
  const restored = useRef(false);

  // The founder identity the ProgressSpine renders — fills in as the user builds
  // themselves into the room across the action chapters.
  const [identity, setIdentity] = useState<Identity>({
    name: null,
    stage: null,
    skillCount: 0,
    cohortName: null,
  });

  // Mount: trial init (once), prefetch cohort, restore scroll position.
  useEffect(() => {
    let active = true;

    (async () => {
      // 1. Progress + trial init.
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
          // Restore scroll position on return visits.
          if (!restored.current && typeof data.current_step === "number" && data.current_step > 1) {
            const target = STEP_TO_CHAPTER[data.current_step];
            if (target) {
              restored.current = true;
              setTimeout(() => {
                document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
              }, 400);
            }
          }
        }
      } catch {
        // best-effort
      }

      // 2. Prefetch cohort data so there's no loading flash mid-scroll.
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: mine } = await supabase
          .from("cohort_members")
          .select("cohort_id")
          .eq("user_id", user.id);
        const myIds = (mine ?? []).map((r) => r.cohort_id).filter(Boolean) as string[];
        if (myIds.length === 0) {
          if (active) setCohort({ members: [], memberCount: 0, cohortName: null });
          return;
        }

        // Surface the most-populated cohort the user sits in.
        const { data: allRows } = await supabase
          .from("cohort_members")
          .select("user_id, cohort_id")
          .in("cohort_id", myIds);

        const byCohort = new Map<string, string[]>();
        for (const row of allRows ?? []) {
          if (!row.cohort_id) continue;
          const list = byCohort.get(row.cohort_id) ?? [];
          if (row.user_id) list.push(row.user_id);
          byCohort.set(row.cohort_id, list);
        }

        let chosenId = myIds[0];
        let chosenMembers = byCohort.get(chosenId) ?? [];
        for (const id of myIds) {
          const list = byCohort.get(id) ?? [];
          if (list.length > chosenMembers.length) {
            chosenId = id;
            chosenMembers = list;
          }
        }

        const { data: cohortRow } = await supabase
          .from("cohorts")
          .select("name")
          .eq("id", chosenId)
          .maybeSingle();

        const ids = Array.from(new Set(chosenMembers));
        const otherIds = ids.filter((id) => id !== user.id);
        let members: CohortMember[] = [];
        if (otherIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name, stage, what_they_are_building")
            .in("id", otherIds);
          members = (profs ?? []).map((p) => ({
            id: p.id,
            full_name: p.full_name,
            stage: p.stage,
            building: p.what_they_are_building,
          }));
        }

        if (!active) return;
        setCohortId(chosenId);
        setCohort({ members, memberCount: ids.length, cohortName: cohortRow?.name ?? null });
      } catch {
        if (active) setCohort({ members: [], memberCount: 0, cohortName: null });
      }
    })();

    return () => {
      active = false;
    };
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
          title="Your strengths"
          blurb="Skills are how founders find each other here — name what you're great at, so the right people reach out."
          accent={C.amber}
          motif="skills"
        />
        <ChapterSkills
          onComplete={() => markComplete(8)}
          onIdentity={(skillCount) => setIdentity((p) => ({ ...p, skillCount }))}
        />

        <ChapterIntro
          id="intro-cohort"
          index="08"
          title="Your cohort"
          blurb="Twelve founders at your stage, matched to you. This is the room you'll actually grow with."
          accent={C.blue}
          motif="cohort"
        />
        <ChapterCohort
          cohort={cohort}
          onComplete={() => {
            markComplete(9);
            setIdentity((p) => ({ ...p, cohortName: cohort?.cohortName ?? p.cohortName }));
          }}
        />

        <ChapterIntro
          id="intro-post"
          index="09"
          title="Your first post"
          blurb="A post puts something real in front of your cohort — a decision, a question, a blocker, a win."
          accent={C.amber}
          motif="post"
        />
        <ChapterFirstPost cohortId={cohortId} onComplete={() => markComplete(10)} />

        <ChapterIntro
          id="intro-checkin"
          index="10"
          title="The weekly check-in"
          blurb="Every week, three short questions. It's the rhythm that keeps your cohort close and honest."
          accent={C.green}
          motif="checkin"
        />
        <ChapterCheckin onComplete={() => markComplete(11)} />

        <ChapterCollabHorizontal onComplete={() => markComplete(12)} />

        {/* Act III — the payoff + the decision. */}
        <ChapterSummary />

        <ChapterIntro
          id="intro-referral"
          index="13"
          title="Bring founders in"
          blurb="Refer founders you rate. The more you bring in, the less you pay — and the stronger the room gets."
          accent={C.amber}
          motif="referral"
        />
        <ChapterReferral />
        <ChapterPricing onComplete={completeOnboarding} />
      </div>
      </OnboardingScrollProvider>
    </div>
  );
}
