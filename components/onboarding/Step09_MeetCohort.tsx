"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/stage";
import type { OnboardingStepProps } from "./types";
import {
  C,
  Eyebrow,
  GhostButton,
  Heading,
  hexToRgba,
  InfoBlock,
  MONO,
  PrimaryButton,
  SANS,
  STAGE_COLORS,
  stageLabel,
  StepFrame,
} from "./ui";

interface Member {
  id: string;
  full_name: string | null;
  stage: string | null;
  building: string | null;
}

function MiniAvatar({ label, color, size = 34 }: { label: string; color: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        border: `1.5px solid ${color}`,
        background: hexToRgba(color, 0.12),
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: MONO,
        fontSize: size * 0.34,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}

function StagePill({ stage }: { stage: string | null }) {
  const color = stage ? STAGE_COLORS[stage] ?? C.textMuted : C.textMuted;
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9,
        padding: "3px 8px",
        borderRadius: 3,
        border: `1px solid ${hexToRgba(color, 0.3)}`,
        background: hexToRgba(color, 0.06),
        color,
      }}
    >
      {stageLabel(stage)}
    </span>
  );
}

export default function Step09_MeetCohort({
  onNext,
  onBack,
  currentStep,
  totalSteps,
}: OnboardingStepProps) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [cohortName, setCohortName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // All cohorts the user belongs to.
        const { data: mine } = await supabase
          .from("cohort_members")
          .select("cohort_id")
          .eq("user_id", user.id);
        const myIds = (mine ?? []).map((r) => r.cohort_id).filter(Boolean) as string[];
        if (myIds.length === 0) return;

        // A founder can sit in several cohorts (including near-empty test rooms),
        // so surface the most-populated one — that's the room they actually
        // collaborate in and the one "meet your cohort" should introduce.
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

        const { data: cohort } = await supabase
          .from("cohorts")
          .select("name")
          .eq("id", chosenId)
          .maybeSingle();
        if (!active) return;

        setCohortName(cohort?.name ?? null);
        const ids = Array.from(new Set(chosenMembers));
        setMemberCount(ids.length);

        const otherIds = ids.filter((id) => id !== user.id);
        if (otherIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name, stage, what_they_are_building")
            .in("id", otherIds);
          if (!active) return;
          setMembers(
            (profs ?? []).map((p) => ({
              id: p.id,
              full_name: p.full_name,
              stage: p.stage,
              building: p.what_they_are_building,
            }))
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const cohortLabel = cohortName ? cohortName.toUpperCase() : "COHORT_01";
  const isPopulated = memberCount >= 3;
  const fillPct = Math.min(100, (memberCount / 12) * 100);

  if (loading) {
    return (
      <StepFrame currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}>
        <div style={{ fontFamily: MONO, fontSize: 12, color: C.textDisabled }}>
          // loading your room...
        </div>
      </StepFrame>
    );
  }

  if (isPopulated) {
    return (
      <StepFrame currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}>
        <Eyebrow>// your room is ready</Eyebrow>
        <Heading>Meet your cohort.</Heading>
        <div style={{ marginTop: 18 }}>
          <InfoBlock>
            These are the founders you&rsquo;ll be building alongside. They&rsquo;ve been vetted,
            they&rsquo;re serious, and they&rsquo;re here for the same reason you are.
          </InfoBlock>
        </div>

        <div
          style={{
            maxWidth: 520,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.textSecondary }}>{cohortLabel}</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.textDisabled }}>
            {memberCount} / 12 members
          </span>
        </div>

        <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Your highlighted card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 4,
              border: `1px solid ${C.amber}`,
              background: "rgba(245,158,11,0.04)",
            }}
          >
            <MiniAvatar label="YO" color={C.amber} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: SANS, fontSize: 13, color: C.textPrimary }}>You</div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: C.textMuted }}>just joined</div>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.amber }}>// you</span>
          </div>

          {/* Other members */}
          {members.map((m) => {
            const color = m.stage ? STAGE_COLORS[m.stage] ?? C.textMuted : C.textMuted;
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 4,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                }}
              >
                <MiniAvatar label={initials(m.full_name)} color={color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: SANS,
                      fontSize: 13,
                      color: C.textPrimary,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.full_name ?? "founder"}
                  </div>
                  <div
                    style={{
                      fontFamily: SANS,
                      fontSize: 12,
                      color: C.textMuted,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.building ?? "—"}
                  </div>
                </div>
                <StagePill stage={m.stage} />
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 24 }}>
          <PrimaryButton onClick={onNext}>I&rsquo;m ready to introduce myself →</PrimaryButton>
        </div>
      </StepFrame>
    );
  }

  // Empty state — room still filling
  return (
    <StepFrame currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}>
      <Eyebrow>// your room is being built</Eyebrow>
      <Heading>You&rsquo;re one of the first here.</Heading>
      <div style={{ marginTop: 18 }}>
        <InfoBlock>
          You&rsquo;re one of the first in this cohort. We&rsquo;re curating the right founders to
          join you — expect your room to fill within 48 hours.
        </InfoBlock>
      </div>

      <div
        style={{
          maxWidth: 520,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: 20,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.amber, letterSpacing: "0.08em" }}>
          // {cohortLabel} — FILLING
        </div>
        <p style={{ fontFamily: SANS, fontSize: 13, color: C.textSecondary, lineHeight: 1.6, margin: "12px 0 16px" }}>
          Your cohort is being built around founders with a similar mindset and stage to you. We
          hand-pick every member — no one gets in by accident.
        </p>
        <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${fillPct}%`, background: C.amber }} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.textDisabled, marginTop: 8 }}>
          {memberCount} / 12 members — you&rsquo;re in
        </div>
      </div>

      <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 4,
              border: `1px dashed ${C.borderMuted}`,
              background: C.surface,
              opacity: 0.35,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: `1px dashed ${C.borderMuted}`,
                color: C.textDisabled,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: MONO,
                fontSize: 13,
              }}
            >
              ?
            </div>
            <div>
              <div style={{ fontFamily: SANS, fontSize: 13, color: C.borderMuted }}>pending curation</div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: C.borderMuted }}>arriving soon</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 24 }}>
        <PrimaryButton onClick={onNext}>invite someone I trust →</PrimaryButton>
        <GhostButton onClick={onNext}>notify me when it fills →</GhostButton>
      </div>
    </StepFrame>
  );
}
