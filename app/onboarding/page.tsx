"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingPostBody, OnboardingStepProps } from "@/components/onboarding/types";

import Step01_HookQuestion from "@/components/onboarding/Step01_HookQuestion";
import Step02_Mirror from "@/components/onboarding/Step02_Mirror";
import Step03_PersonalQuestion from "@/components/onboarding/Step03_PersonalQuestion";
import Step04_ProfileExplainer from "@/components/onboarding/Step04_ProfileExplainer";
import Step05_BuildProfile from "@/components/onboarding/Step05_BuildProfile";
import Step06_SkillsExplainer from "@/components/onboarding/Step06_SkillsExplainer";
import Step07_PickSkills from "@/components/onboarding/Step07_PickSkills";
import Step08_CohortExplainer from "@/components/onboarding/Step08_CohortExplainer";
import Step09_MeetCohort from "@/components/onboarding/Step09_MeetCohort";
import Step10_FirstPostExplainer from "@/components/onboarding/Step10_FirstPostExplainer";
import Step11_FirstPost from "@/components/onboarding/Step11_FirstPost";
import Step12_CheckinExplainer from "@/components/onboarding/Step12_CheckinExplainer";
import Step13_DoCheckin from "@/components/onboarding/Step13_DoCheckin";
import Step14_CollabExplainer from "@/components/onboarding/Step14_CollabExplainer";
import Step15_ExploreCollab from "@/components/onboarding/Step15_ExploreCollab";
import Step16_JourneySummary from "@/components/onboarding/Step16_JourneySummary";
import Step17_ReferralSell from "@/components/onboarding/Step17_ReferralSell";
import Step18_Pricing from "@/components/onboarding/Step18_Pricing";

const TOTAL_STEPS = 18;

const STEPS: Record<number, React.ComponentType<OnboardingStepProps>> = {
  1: Step01_HookQuestion,
  2: Step02_Mirror,
  3: Step03_PersonalQuestion,
  4: Step04_ProfileExplainer,
  5: Step05_BuildProfile,
  6: Step06_SkillsExplainer,
  7: Step07_PickSkills,
  8: Step08_CohortExplainer,
  9: Step09_MeetCohort,
  10: Step10_FirstPostExplainer,
  11: Step11_FirstPost,
  12: Step12_CheckinExplainer,
  13: Step13_DoCheckin,
  14: Step14_CollabExplainer,
  15: Step15_ExploreCollab,
  16: Step16_JourneySummary,
  17: Step17_ReferralSell,
  18: Step18_Pricing,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [screen3Answer, setScreen3Answer] = useState("");

  // Start the trial on first onboarding load: stamp the flag so this runs once,
  // then create the trialing subscription (30 days if referred, else 7).
  const initializeTrial = async () => {
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trial_initialized: true }),
      });
      await fetch("/api/subscription/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // best-effort — onboarding still proceeds without the trial stamped
    }
  };

  // On mount, load saved progress. An optional ?step=X query param overrides the
  // saved step for admin/testing, but progress is still saved as the user moves.
  useEffect(() => {
    let active = true;

    const bypassStep = (() => {
      const raw = new URLSearchParams(window.location.search).get("step");
      if (!raw) return null;
      const n = parseInt(raw, 10);
      return Number.isInteger(n) && n >= 1 && n <= TOTAL_STEPS ? n : null;
    })();

    (async () => {
      try {
        const res = await fetch("/api/onboarding");
        if (res.ok) {
          const data = await res.json();
          if (!active) return;
          if (typeof data.screen3_answer === "string") {
            setScreen3Answer(data.screen3_answer);
          }
          if (bypassStep !== null) {
            setCurrentStep(bypassStep);
          } else if (typeof data.current_step === "number") {
            setCurrentStep(data.current_step);
          }
          // First time through: start the trial. Idempotent — the flag guards
          // re-entry and the initialize endpoint won't reset an existing trial.
          if (!data.trial_initialized) {
            void initializeTrial();
          }
        } else if (bypassStep !== null && active) {
          setCurrentStep(bypassStep);
        }
      } catch {
        if (bypassStep !== null && active) setCurrentStep(bypassStep);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const postProgress = async (body: OnboardingPostBody) => {
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // Best-effort: local state still advances so the user isn't stuck.
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "auto" });

  const completeFlow = async () => {
    await postProgress({ completed: true, current_step: TOTAL_STEPS });
    router.push("/home");
  };

  const onNext = async () => {
    const nextStep = currentStep + 1;
    if (nextStep > TOTAL_STEPS) {
      await completeFlow();
      return;
    }
    // Carry the step-3 answer along so it persists once it has been entered.
    await postProgress({
      current_step: nextStep,
      ...(screen3Answer ? { screen3_answer: screen3Answer } : {}),
    });
    setCurrentStep(nextStep);
    scrollToTop();
  };

  const onBack = async () => {
    const prevStep = Math.max(1, currentStep - 1);
    if (prevStep === currentStep) return;
    await postProgress({ current_step: prevStep });
    setCurrentStep(prevStep);
    scrollToTop();
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0d1117",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            fontSize: 12,
            color: "#484f58",
          }}
        >
          // loading...
        </span>
      </div>
    );
  }

  const StepComponent = STEPS[currentStep] ?? STEPS[1];

  return (
    <StepComponent
      onNext={onNext}
      onBack={onBack}
      currentStep={currentStep}
      totalSteps={TOTAL_STEPS}
      screen3Answer={screen3Answer}
      setScreen3Answer={setScreen3Answer}
    />
  );
}
