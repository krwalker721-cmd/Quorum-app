"use client";

import type { OnboardingStepProps } from "./types";
import { Eyebrow, Heading, InfoBlock, PrimaryButton, StepFrame } from "./ui";

export default function Step01_HookQuestion({ onNext, currentStep, totalSteps }: OnboardingStepProps) {
  return (
    <StepFrame currentStep={currentStep} totalSteps={totalSteps}>
      <Eyebrow>// introduction</Eyebrow>
      <Heading maxWidth={680}>
        Have you ever wanted a room full of founders who have the same mindset as you — and
        have already solved the problems you&rsquo;re about to face?
      </Heading>

      <div style={{ marginTop: 24 }}>
        <InfoBlock>
          The people around you shape how far you go. Being in a room with driven founders
          who&rsquo;ve been there pushes you faster than any advice, course, or mentor ever could.
        </InfoBlock>
      </div>

      <div style={{ marginTop: 8 }}>
        <PrimaryButton onClick={onNext}>That&rsquo;s exactly what I&rsquo;ve been missing →</PrimaryButton>
      </div>
    </StepFrame>
  );
}
