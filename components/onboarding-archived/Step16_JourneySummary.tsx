"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingStepProps } from "./types";
import OnboardingShell from "./OnboardingShell";
import {
  C,
  MONO,
  SANS,
  PrimaryButton,
  STAGE_COLORS,
  TYPE_COLORS,
  hexToRgba,
  stageLabel,
} from "./ui";

// Real onboarding data, reconciled to the actual schema:
//  - profile uses `what_they_are_building` (no `bio` column exists)
//  - a post's decision/question/blocker/win lives in `room_type`, not post_type
//  - check-ins are their own `check_ins` table, not posts
interface JourneyData {
  profile: {
    full_name: string | null;
    stage: string | null;
    building: string | null;
    skills: string[] | null;
  } | null;
  cohortName: string | null;
  cohortMemberCount: number;
  firstPost: {
    content: string;
    room_type: string | null;
  } | null;
  hasCheckin: boolean;
}

export default function Step16_JourneySummary({
  onNext,
  currentStep,
  totalSteps,
}: OnboardingStepProps) {
  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (active) setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, stage, what_they_are_building, skills")
          .eq("id", user.id)
          .maybeSingle();

        const { data: membership } = await supabase
          .from("cohort_members")
          .select("cohort_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        let cohortName: string | null = null;
        let cohortMemberCount = 0;
        if (membership?.cohort_id) {
          const { data: cohort } = await supabase
            .from("cohorts")
            .select("name")
            .eq("id", membership.cohort_id)
            .maybeSingle();
          cohortName = cohort?.name ?? null;
          const { count } = await supabase
            .from("cohort_members")
            .select("*", { count: "exact", head: true })
            .eq("cohort_id", membership.cohort_id);
          cohortMemberCount = count ?? 0;
        }

        const { data: firstPost } = await supabase
          .from("posts")
          .select("content, room_type")
          .eq("author_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        const { count: checkinCount } = await supabase
          .from("check_ins")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (!active) return;
        setData({
          profile: profile
            ? {
                full_name: profile.full_name ?? null,
                stage: profile.stage ?? null,
                building: profile.what_they_are_building ?? null,
                skills: (profile.skills as string[] | null) ?? null,
              }
            : null,
          cohortName,
          cohortMemberCount,
          firstPost: firstPost
            ? { content: firstPost.content, room_type: firstPost.room_type ?? null }
            : null,
          hasCheckin: (checkinCount ?? 0) > 0,
        });
      } catch {
        // best-effort — show whatever loaded
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Kick the stagger off just after mount so cards fade up in sequence.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => setAnimateIn(true), 100);
    return () => clearTimeout(t);
  }, [loading]);

  const profile = data?.profile;
  const skills = profile?.skills ?? [];
  const postType = data?.firstPost?.room_type ?? "";
  const postColor = TYPE_COLORS[postType] ?? C.borderMuted;

  const cards: { key: string; node: React.ReactNode }[] = [
    // Card 1 — Profile
    {
      key: "profile",
      node: (
        <RecapCard accent={C.green}>
          <Tag color={C.green}>// profile</Tag>
          {profile?.full_name || profile?.building || profile?.stage ? (
            <>
              <Value>{profile?.full_name || "Your profile"}</Value>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                {profile?.stage && <StagePill stage={profile.stage} />}
                {profile?.building && <SubText truncate>{profile.building}</SubText>}
              </div>
            </>
          ) : (
            <NotFilled>// not filled in</NotFilled>
          )}
        </RecapCard>
      ),
    },
    // Card 2 — Skills
    {
      key: "skills",
      node: (
        <RecapCard accent={C.amber}>
          <Tag color={C.amber}>// skills</Tag>
          {skills.length > 0 ? (
            <>
              <Value>
                {skills.length} skill{skills.length === 1 ? "" : "s"} listed
              </Value>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {skills.slice(0, 3).map((s) => (
                  <SkillPill key={s}>{s}</SkillPill>
                ))}
                {skills.length > 3 && <SkillPill>+{skills.length - 3} more</SkillPill>}
              </div>
            </>
          ) : (
            <NotFilled>// none added</NotFilled>
          )}
        </RecapCard>
      ),
    },
    // Card 3 — Cohort
    {
      key: "cohort",
      node: (
        <RecapCard accent={C.blue}>
          <Tag color={C.blue}>// cohort</Tag>
          {data?.cohortName ? (
            <>
              <Value>{data.cohortName}</Value>
              <SubText style={{ marginTop: 5, fontSize: 11 }}>
                {data.cohortMemberCount} member{data.cohortMemberCount === 1 ? "" : "s"}
              </SubText>
            </>
          ) : (
            <NotFilled>// being curated</NotFilled>
          )}
        </RecapCard>
      ),
    },
    // Card 4 — First Post
    {
      key: "first-post",
      node: (
        <RecapCard accent={data?.firstPost ? postColor : C.border}>
          <Tag color={data?.firstPost ? postColor : C.textDisabled}>// first post</Tag>
          {data?.firstPost ? (
            <div
              style={{
                fontFamily: SANS,
                fontSize: 12,
                color: C.textSecondary,
                lineHeight: 1.5,
                marginTop: 4,
              }}
            >
              {data.firstPost.content.length > 60
                ? `${data.firstPost.content.slice(0, 60)}...`
                : data.firstPost.content}
            </div>
          ) : (
            <NotFilled>// skipped</NotFilled>
          )}
        </RecapCard>
      ),
    },
    // Card 5 — Check-in
    {
      key: "checkin",
      node: (
        <RecapCard accent={data?.hasCheckin ? C.green : C.border}>
          <Tag color={data?.hasCheckin ? C.green : C.textDisabled}>// check-in</Tag>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 13,
              color: data?.hasCheckin ? C.green : C.textDisabled,
              marginTop: 4,
            }}
          >
            {data?.hasCheckin ? "First check-in done" : "Skipped for now"}
          </div>
          <SubText style={{ marginTop: 5, fontSize: 11, color: C.textMuted }}>
            {data?.hasCheckin
              ? "your cohort knows where you are"
              : "you can do this anytime"}
          </SubText>
        </RecapCard>
      ),
    },
    // Card 6 — Collab Board
    {
      key: "collab",
      node: (
        <RecapCard accent={C.purple}>
          <Tag color={C.purple}>// collab</Tag>
          <Value>Board explored</Value>
          <SubText style={{ marginTop: 5, fontSize: 11 }}>projects, needs, and hiring</SubText>
        </RecapCard>
      ),
    },
  ];

  return (
    <OnboardingShell currentStep={currentStep} totalSteps={totalSteps}>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", width: "100%" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 600,
            padding: "40px 60px",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: C.amber,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            // conclusion
          </div>
          <h1
            style={{
              fontFamily: SANS,
              fontSize: 28,
              fontWeight: 600,
              color: C.textPrimary,
              margin: "0 0 8px",
            }}
          >
            Here&rsquo;s what you built.
          </h1>
          <p
            style={{
              fontFamily: SANS,
              fontSize: 15,
              color: C.textSecondary,
              margin: "0 0 36px",
            }}
          >
            In the last few minutes you went from zero to ready.
          </p>

          {loading ? (
            <RecapSkeleton />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                maxWidth: 540,
                marginBottom: 36,
              }}
            >
              {cards.map((card, i) => (
                <div
                  key={card.key}
                  style={{
                    opacity: animateIn ? 1 : 0,
                    transform: animateIn ? "translateY(0)" : "translateY(12px)",
                    transition: "opacity 400ms ease, transform 400ms ease",
                    transitionDelay: `${i * 80}ms`,
                  }}
                >
                  {card.node}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              background: hexToRgba(C.amber, 0.06),
              border: `1px solid ${hexToRgba(C.amber, 0.15)}`,
              borderRadius: 4,
              padding: "12px 20px",
              maxWidth: 540,
              marginBottom: 32,
              textAlign: "center",
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber, letterSpacing: "0.04em" }}>
              // you&rsquo;re in. your cohort is waiting.
            </span>
          </div>

          <div>
            <PrimaryButton onClick={onNext}>See what you earned →</PrimaryButton>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}

// ─── Card primitives ─────────────────────────────────────────────────────────
function RecapCard({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderLeft: `2px solid ${accent}`,
        borderRadius: "0 4px 4px 0",
        padding: 14,
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 8, color, letterSpacing: "0.08em", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: SANS,
        fontSize: 13,
        color: C.textPrimary,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function SubText({
  children,
  truncate,
  style,
}: {
  children: React.ReactNode;
  truncate?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: SANS,
        fontSize: 11,
        color: C.textSecondary,
        ...(truncate
          ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }
          : {}),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function NotFilled({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 11, color: C.textDisabled, marginTop: 4 }}>
      {children}
    </div>
  );
}

function StagePill({ stage }: { stage: string }) {
  const color = STAGE_COLORS[stage] ?? C.textSecondary;
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 8,
        padding: "2px 6px",
        borderRadius: 2,
        background: hexToRgba(color, 0.1),
        border: `1px solid ${hexToRgba(color, 0.25)}`,
        color,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {stageLabel(stage)}
    </span>
  );
}

function SkillPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 8,
        padding: "2px 6px",
        borderRadius: 2,
        background: C.border,
        color: C.textSecondary,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function RecapSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        maxWidth: 540,
        marginBottom: 36,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderLeft: `2px solid ${C.borderMuted}`,
            borderRadius: "0 4px 4px 0",
            padding: 14,
            height: 64,
            opacity: 0.5,
          }}
        />
      ))}
    </div>
  );
}
