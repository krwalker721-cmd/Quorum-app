"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { C } from "@/components/onboarding-v2/theme";
import type { CohortData, CohortMember } from "@/components/onboarding-v2/types";

import { ChapterQuestion } from "@/components/onboarding-v2/ChapterQuestion";
import { ChapterBarGraph } from "@/components/onboarding-v2/ChapterBarGraph";
import { ChapterBridge } from "@/components/onboarding-v2/ChapterBridge";
import { ChapterPivot } from "@/components/onboarding-v2/ChapterPivot";
import { ChapterIntroduction } from "@/components/onboarding-v2/ChapterIntroduction";
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
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <ChapterQuestion />
      <ChapterBarGraph />
      <ChapterBridge />
      <ChapterPivot />
      <ChapterIntroduction />
      <ChapterFounderNames />

      <ChapterProfile onComplete={() => markComplete(7)} />
      <ChapterSkills onComplete={() => markComplete(8)} />
      <ChapterCohort cohort={cohort} onComplete={() => markComplete(9)} />
      <ChapterFirstPost cohortId={cohortId} onComplete={() => markComplete(10)} />
      <ChapterCheckin onComplete={() => markComplete(11)} />
      <ChapterCollabHorizontal onComplete={() => markComplete(12)} />

      <ChapterSummary />
      <ChapterReferral />
      <ChapterPricing onComplete={completeOnboarding} />
    </div>
  );
}
