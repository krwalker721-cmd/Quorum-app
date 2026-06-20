"use client";

import { useEffect, useState } from "react";
import type { OnboardingStepProps } from "./types";
import CinematicShell from "./CinematicShell";
import { useCinematicBeats } from "./useCinematicBeats";
import { C, MONO, SANS, hexToRgba } from "./ui";

const BEATS = 3;

const CAPTIONS = [
  "Refer a founder. <span>Get rewarded.</span> Make Quorum more accessible.",
  "The more founders you bring, <span>the less you pay.</span>",
  "Your referral link is <span>almost ready.</span> Complete your profile to unlock it.",
];

const MILESTONES: { count: string; reward: string }[] = [
  { count: "1 →", reward: "$10 off next month" },
  { count: "3 →", reward: "1 free month" },
  { count: "5 →", reward: "2 free months" },
  { count: "10 →", reward: "50% off 6 months" },
  { count: "25 →", reward: "free for a year" },
];

interface ReferralData {
  link: string | null;
  linkActive: boolean;
  gates: {
    profileComplete: boolean;
    returnedThreeDays: boolean;
    engagedWithPulse: boolean;
    allComplete: boolean;
  } | null;
}

const LADDER_KEYFRAMES = `
@keyframes ladderRowIn {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes ladderLight { from { opacity: 0; } to { opacity: 1; } }
@keyframes bonusIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
`;

// The reward ladder. Beat 0 fades each row in (120ms stagger, dim). Beat 1
// re-renders with each row lit amber, staggered (150ms) so they appear to light
// up one at a time, then the monthly-bonus card fades in beneath them.
function RewardLadder({ lit }: { lit: boolean }) {
  return (
    <div style={{ width: 170, margin: "0 auto" }}>
      <style>{LADDER_KEYFRAMES}</style>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {MILESTONES.map((m, i) => (
          <div
            key={m.count}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 0",
              animation: lit
                ? `ladderLight 350ms ease both`
                : `ladderRowIn 350ms ease both`,
              animationDelay: `${i * (lit ? 150 : 120)}ms`,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                padding: "3px 8px",
                borderRadius: 3,
                flexShrink: 0,
                background: lit ? hexToRgba(C.amber, 0.1) : C.surface,
                border: `1px solid ${lit ? hexToRgba(C.amber, 0.2) : C.border}`,
                color: lit ? C.amber : C.textDisabled,
                transition: "all 250ms ease",
              }}
            >
              {m.count}
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: 11,
                color: lit ? C.textPrimary : C.textMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                transition: "color 250ms ease",
              }}
            >
              {m.reward}
            </span>
          </div>
        ))}
      </div>

      {lit && (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: "10px 12px",
            marginTop: 10,
            textAlign: "left",
            animation: "bonusIn 500ms ease 600ms both",
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDisabled, marginBottom: 4 }}>
            // monthly bonus
          </div>
          <div style={{ fontFamily: SANS, fontSize: 11, color: C.textSecondary, lineHeight: 1.4 }}>
            5+ active referrals → $30 off every month
          </div>
        </div>
      )}
    </div>
  );
}

function ReferralLink({ data }: { data: ReferralData | null }) {
  const active = !!data?.linkActive;
  const value = active && data?.link ? data.link : "quorum.app/signup?ref=••••••";
  const gates = data?.gates;

  // Only surface the gates the user hasn't cleared yet.
  const missing: string[] = [];
  if (gates && !gates.profileComplete) missing.push("// complete profile to activate");
  if (gates && !gates.returnedThreeDays) missing.push("// return 3 days to activate");
  if (gates && !gates.engagedWithPulse) missing.push("// post on pulse to activate");

  return (
    <div style={{ width: 170, margin: "0 auto", textAlign: "left" }}>
      <div
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: "10px 14px",
          fontFamily: MONO,
          fontSize: 11,
          color: active ? C.textSecondary : C.textDisabled,
          letterSpacing: "0.04em",
          width: 170,
          boxSizing: "border-box",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>

      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        {active ? (
          <span style={{ fontFamily: MONO, fontSize: 9, color: C.green }}>// link active</span>
        ) : (
          missing.map((m) => (
            <span key={m} style={{ fontFamily: MONO, fontSize: 8, color: C.textDisabled }}>
              {m}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export default function Step17_ReferralSell({
  onNext,
  onBack,
  currentStep,
  totalSteps,
}: OnboardingStepProps) {
  const { currentBeat, isComplete, advance } = useCinematicBeats(BEATS);
  const beat = Math.max(0, currentBeat);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);

  useEffect(() => {
    fetch("/api/referrals")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setReferralData({
            link: d.link ?? null,
            linkActive: !!d.linkActive,
            gates: d.gates ?? null,
          });
        }
      })
      .catch(console.error);
  }, []);

  let visual: React.ReactNode;
  if (beat >= 2) visual = <ReferralLink data={referralData} />;
  else visual = <RewardLadder lit={beat >= 1} />;

  return (
    <CinematicShell
      currentStep={currentStep}
      totalSteps={totalSteps}
      eyebrow="// one more thing"
      beats={BEATS}
      currentBeat={currentBeat}
      isComplete={isComplete}
      caption={currentBeat < 0 ? "" : CAPTIONS[beat]}
      onAdvance={advance}
      ctaLabel="Got it — let's talk pricing →"
      onCta={onNext}
      onStepBack={onBack}
    >
      {visual}
    </CinematicShell>
  );
}
