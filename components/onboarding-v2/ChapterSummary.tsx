"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { StagePill } from "./bits";
import { C, MONO, SANS, hexToRgba, TYPE_COLORS } from "./theme";

interface JourneyData {
  profile: {
    full_name: string | null;
    stage: string | null;
    building: string | null;
    skills: string[] | null;
  } | null;
  cohortName: string | null;
  cohortMemberCount: number;
  firstPost: { content: string; room_type: string | null } | null;
  hasCheckin: boolean;
}

function StaggerCard({
  progress,
  range,
  children,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  children: ReactNode;
}) {
  const opacity = useTransform(progress, range, [0, 1]);
  const y = useTransform(progress, range, [24, 0]);
  return (
    <motion.div style={{ opacity, y, willChange: "opacity, transform" }}>{children}</motion.div>
  );
}

// Chapter 13 — the journey recap. Heading fades in, then six recap cards stagger
// in against scroll, populated from the user's real onboarding actions.
export function ChapterSummary() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);
  const headingOpacity = useTransform(scrollYProgress, [0.05, 0.18], [0, 1]);
  const headingY = useTransform(scrollYProgress, [0.05, 0.18], [20, 0]);
  const bannerOpacity = useTransform(scrollYProgress, [0.75, 0.85], [0, 1]);

  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);

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
        // best-effort
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const profile = data?.profile;
  const skills = profile?.skills ?? [];
  const postType = data?.firstPost?.room_type ?? "";
  const postColor = TYPE_COLORS[postType] ?? C.border;

  const cards: ReactNode[] = [
    <RecapCard key="profile" accent={C.green}>
      <RecapTag color={C.green}>// profile</RecapTag>
      {profile?.full_name || profile?.building || profile?.stage ? (
        <>
          <RecapValue>{profile?.full_name || "Your profile"}</RecapValue>
          {profile?.stage && (
            <div style={{ marginTop: 6 }}>
              <StagePill stage={profile.stage} />
            </div>
          )}
        </>
      ) : (
        <RecapMuted>// skipped</RecapMuted>
      )}
    </RecapCard>,
    <RecapCard key="skills" accent={C.amber}>
      <RecapTag color={C.amber}>// skills</RecapTag>
      {skills.length > 0 ? (
        <>
          <RecapValue>
            {skills.length} skill{skills.length === 1 ? "" : "s"} listed
          </RecapValue>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {skills.slice(0, 3).map((s) => (
              <SkillPill key={s}>{s}</SkillPill>
            ))}
          </div>
        </>
      ) : (
        <RecapMuted>// skipped</RecapMuted>
      )}
    </RecapCard>,
    <RecapCard key="cohort" accent={C.blue}>
      <RecapTag color={C.blue}>// cohort</RecapTag>
      {data?.cohortName ? (
        <>
          <RecapValue>{data.cohortName}</RecapValue>
          <RecapSub>
            {data.cohortMemberCount} member{data.cohortMemberCount === 1 ? "" : "s"}
          </RecapSub>
        </>
      ) : (
        <RecapMuted>// being curated</RecapMuted>
      )}
    </RecapCard>,
    <RecapCard key="first-post" accent={data?.firstPost ? postColor : C.border}>
      <RecapTag color={data?.firstPost ? postColor : C.textDisabled}>// first post</RecapTag>
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
        <RecapMuted>// skipped</RecapMuted>
      )}
    </RecapCard>,
    <RecapCard key="checkin" accent={data?.hasCheckin ? C.green : C.border}>
      <RecapTag color={data?.hasCheckin ? C.green : C.textDisabled}>// check-in</RecapTag>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 13,
          color: data?.hasCheckin ? C.green : C.textDisabled,
          marginTop: 4,
        }}
      >
        {data?.hasCheckin ? "done" : "skipped"}
      </div>
    </RecapCard>,
    <RecapCard key="collab" accent={C.purple}>
      <RecapTag color={C.purple}>// collab</RecapTag>
      <RecapValue>board explored</RecapValue>
    </RecapCard>,
  ];

  return (
    <Chapter ref={ref} id="chapter-13" heightVh={300}>
      <StickyStage style={{ overflow: "visible" }}>
        <motion.div
          style={{
            opacity: headingOpacity,
            y: headingY,
            textAlign: "center",
            marginBottom: 32,
            willChange: "opacity, transform",
          }}
        >
          <div style={{ height: 1, width: 120, background: C.border, margin: "0 auto 24px" }} />
          <h2
            style={{
              fontFamily: SANS,
              fontSize: "clamp(24px, 4vw, 32px)",
              fontWeight: 500,
              color: C.textPrimary,
              margin: "0 0 8px",
            }}
          >
            Here&rsquo;s what you built.
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 15, color: C.textSecondary, margin: 0 }}>
            In the last few minutes you went from zero to ready.
          </p>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            width: "100%",
            maxWidth: 540,
            opacity: loading ? 0.6 : 1,
            transition: "opacity 300ms ease",
          }}
        >
          {cards.map((card, i) => (
            <StaggerCard
              key={i}
              progress={scrollYProgress}
              range={[0.2 + i * 0.08, 0.3 + i * 0.08]}
            >
              {card}
            </StaggerCard>
          ))}
        </div>

        <motion.div
          style={{
            opacity: bannerOpacity,
            background: hexToRgba(C.amber, 0.06),
            border: `1px solid ${hexToRgba(C.amber, 0.15)}`,
            borderRadius: 4,
            padding: "12px 20px",
            maxWidth: 540,
            margin: "24px auto 0",
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 11,
            color: C.amber,
            willChange: "opacity",
          }}
        >
          // you&rsquo;re in. your cohort is waiting.
        </motion.div>
      </StickyStage>
    </Chapter>
  );
}

function RecapCard({ accent, children }: { accent: string; children: ReactNode }) {
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
function RecapTag({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div
      style={{ fontFamily: MONO, fontSize: 8, color, letterSpacing: "0.08em", marginBottom: 6 }}
    >
      {children}
    </div>
  );
}
function RecapValue({ children }: { children: ReactNode }) {
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
function RecapSub({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: SANS, fontSize: 11, color: C.textSecondary, marginTop: 5 }}>
      {children}
    </div>
  );
}
function RecapMuted({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 11, color: C.textDisabled, marginTop: 4 }}>
      {children}
    </div>
  );
}
function SkillPill({ children }: { children: ReactNode }) {
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
