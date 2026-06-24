"use client";

import { useRef, type ReactNode } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { initials } from "@/lib/stage";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { Avatar, StagePill } from "./bits";
import { C, MONO, SANS, hexToRgba, STAGE_COLORS } from "./theme";
import type { CohortData } from "./types";

// A member card that fades/slides in over its own slice of the chapter scroll.
function ScrollCard({
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

// Chapter 9 — the cohort reveal. Heading fades in, then member cards stagger in
// one by one as the user scrolls. Populated (3+) shows real members; otherwise a
// single "being curated" progress card.
export function ChapterCohort({
  cohort,
  onComplete,
}: {
  cohort: CohortData | null;
  onComplete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);

  const headingOpacity = useTransform(scrollYProgress, [0.05, 0.2], [0, 1]);
  const headingY = useTransform(scrollYProgress, [0.05, 0.2], [20, 0]);
  const ctaOpacity = useTransform(scrollYProgress, [0.8, 0.9], [0, 1]);

  const memberCount = cohort?.memberCount ?? 0;
  const isPopulated = memberCount >= 3;
  const fillPct = Math.min(100, (memberCount / 12) * 100);

  // Cards stagger from 0.25 onward, each 0.1 of scroll apart.
  const cardRange = (i: number): [number, number] => [0.25 + i * 0.1, 0.35 + i * 0.1];

  return (
    <Chapter ref={ref} id="chapter-9" heightVh={300}>
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
          <div
            style={{
              fontFamily: MONO,
              fontSize: 12,
              color: C.amber,
              letterSpacing: "0.08em",
              marginBottom: 14,
            }}
          >
            // your room is ready
          </div>
          <h2
            style={{
              fontFamily: SANS,
              fontSize: "clamp(24px, 4vw, 32px)",
              fontWeight: 500,
              color: C.textPrimary,
              margin: 0,
            }}
          >
            Meet your cohort.
          </h2>
        </motion.div>

        {isPopulated ? (
          <div
            style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 8 }}
          >
            <ScrollCard progress={scrollYProgress} range={cardRange(0)}>
              <div
                style={{
                  background: hexToRgba(C.amber, 0.04),
                  border: `1px solid ${C.amber}`,
                  borderRadius: 4,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <Avatar label="YO" color={C.amber} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SANS, fontSize: 13, color: C.textPrimary }}>
                    You — just joined
                  </div>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 9, color: C.amber }}>// you</span>
              </div>
            </ScrollCard>

            {cohort?.members.map((m, i) => {
              const color = m.stage ? STAGE_COLORS[m.stage] ?? C.textMuted : C.textMuted;
              return (
                <ScrollCard key={m.id} progress={scrollYProgress} range={cardRange(i + 1)}>
                  <div
                    style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <Avatar label={initials(m.full_name)} color={color} />
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
                </ScrollCard>
              );
            })}
          </div>
        ) : (
          <ScrollCard progress={scrollYProgress} range={cardRange(0)}>
            <div
              style={{
                width: "100%",
                maxWidth: 520,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: 24,
                textAlign: "center",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{ fontFamily: MONO, fontSize: 9, color: C.amber, letterSpacing: "0.08em" }}
              >
                // cohort being curated
              </div>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: 13,
                  color: C.textSecondary,
                  lineHeight: 1.6,
                  margin: "12px 0 16px",
                }}
              >
                We&rsquo;re building your cohort around founders with the same mindset and stage.
                Expect your room to fill within 48 hours.
              </p>
              <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${fillPct}%`, background: C.amber }} />
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.textDisabled, marginTop: 8 }}>
                {memberCount} / 12 — you&rsquo;re in
              </div>
            </div>
          </ScrollCard>
        )}

        <motion.div style={{ opacity: ctaOpacity, marginTop: 24, willChange: "opacity" }}>
          <button
            type="button"
            onClick={onComplete}
            style={{
              background: C.amber,
              color: C.bg,
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.06em",
              padding: "14px 28px",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            I&rsquo;m ready →
          </button>
        </motion.div>
      </StickyStage>
    </Chapter>
  );
}
