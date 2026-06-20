// Shared types for the onboarding flow. The page renders one step component at a
// time and hands every step the same prop bag, so a single interface keeps the
// page and all 15 step components in sync.

export interface OnboardingStepProps {
  // Advance to the next step and persist progress. On the final step this
  // completes onboarding and routes to /home.
  onNext: () => void;
  // Go back one step. Optional — not every step offers a way back.
  onBack?: () => void;
  currentStep: number;
  totalSteps: number;
  // The free-text answer captured on step 3, surfaced again on step 11.
  // Only meaningful for those two steps.
  screen3Answer?: string;
  setScreen3Answer?: (answer: string) => void;
}

// Body shape accepted by POST /api/onboarding.
export interface OnboardingPostBody {
  current_step?: number;
  screen3_answer?: string;
  completed?: boolean;
  trial_initialized?: boolean;
}
