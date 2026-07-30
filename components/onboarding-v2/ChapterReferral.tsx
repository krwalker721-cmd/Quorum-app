"use client";

import { useRef, type ReactNode } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { C, MONO, SANS, hexToRgba } from "./theme";
import {
  BONUS_LADDER_ASC,
  REFERRAL_MILESTONES,
  REFERRAL_LINK_GATES,
} from "@/lib/referral-model";

// The badge ladder. Recognition only — the money is the standing monthly bonus,
// which beat 1 covers. This used to promise a second pile of free months at each
// rung, which the app never paid.
function BadgeLadder({ lit }: { lit: boolean }) {
  return (
    <div style={{ width: 260, margin: "22px auto 0" }}>
      {REFERRAL_MILESTONES.map((m) => (
        <div
          key={m.count}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              padding: "3px 8px",
              borderRadius: 3,
              flexShrink: 0,
              minWidth: 34,
              textAlign: "center",
              background: lit ? hexToRgba(C.amber, 0.1) : C.surface,
              border: `1px solid ${lit ? hexToRgba(C.amber, 0.25) : C.border}`,
              color: lit ? C.amber : C.textDisabled,
              transition: "all 250ms ease",
            }}
          >
            {m.count}
          </span>
          <span
            style={{
              fontFamily: SANS,
              fontSize: 12,
              color: lit ? C.textPrimary : C.textMuted,
              transition: "color 250ms ease",
            }}
          >
            {m.reward}
          </span>
        </div>
      ))}
    </div>
  );
}

function Beat({
  opacity,
  y,
  children,
}: {
  opacity: MotionValue<number>;
  y: MotionValue<number>;
  children: ReactNode;
}) {
  return (
    <motion.div
      style={{
        opacity,
        y,
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 20px",
        textAlign: "center",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </motion.div>
  );
}

// The referral chapter, three cinematic beats — and the same three facts the
// /referrals dashboard shows once they're inside:
//
//   1. one month of Member per founder who activates, uncapped   (the money)
//   2. the milestone ladder is badges                            (the status)
//   3. the link unlocks on the real activity gates               (the catch)
//
// Kept in step with the app by reading lib/referral-model.ts.
export function ChapterReferral() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);

  const b1Opacity = useTransform(scrollYProgress, [0.02, 0.18, 0.28, 0.34], [0, 1, 1, 0]);
  const b1Y = useTransform(scrollYProgress, [0.02, 0.18], [30, 0]);
  const b2Opacity = useTransform(scrollYProgress, [0.36, 0.5, 0.6, 0.66], [0, 1, 1, 0]);
  const b2Y = useTransform(scrollYProgress, [0.36, 0.5], [30, 0]);
  const b3Opacity = useTransform(scrollYProgress, [0.68, 0.82], [0, 1]);
  const b3Y = useTransform(scrollYProgress, [0.68, 0.82], [30, 0]);

  return (
    <Chapter ref={ref} id="chapter-14" label="grow it" heightVh={400}>
      <StickyStage>
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {/* Beat 1 — the actual economics. */}
          <Beat opacity={b1Opacity} y={b1Y}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: C.amber,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 16,
              }}
            >
              // one more thing
            </div>
            <p
              style={{
                fontFamily: SANS,
                fontSize: "clamp(20px, 3.5vw, 24px)",
                color: C.textPrimary,
                maxWidth: 500,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Every founder you bring in who <span style={{ color: C.amber }}>stays active</span>{" "}
              brings your own price down — and keeps it down.
            </p>
            <div
              style={{
                background: C.surface,
                border: `1px solid ${hexToRgba(C.amber, 0.25)}`,
                borderRadius: 4,
                padding: "14px 20px",
                margin: "24px auto 0",
                maxWidth: 320,
              }}
            >
              <div
                style={{ fontFamily: MONO, fontSize: 8, color: C.textDisabled, marginBottom: 8 }}
              >
                // your monthly bonus
              </div>
              {BONUS_LADDER_ASC.map((t) => (
                <div
                  key={t.min}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "3px 0",
                    fontFamily: SANS,
                    fontSize: 12,
                    color: C.textSecondary,
                  }}
                >
                  <span>{t.min}+ active</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber }}>
                    {t.amountOff === null ? "free" : `$${t.amountOff} off / mo`}
                  </span>
                </div>
              ))}
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.amber, marginTop: 10 }}>
                fill a room of 12 and quorum is free
              </div>
            </div>
          </Beat>

          {/* Beat 2 — the ladder, correctly labelled as recognition. */}
          <Beat opacity={b2Opacity} y={b2Y}>
            <p
              style={{
                fontFamily: SANS,
                fontSize: "clamp(18px, 3vw, 22px)",
                color: C.textPrimary,
                maxWidth: 480,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Bring enough of them and the room starts to know it.
            </p>
            <p
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: C.textDisabled,
                marginTop: 10,
              }}
            >
              // badges, on top of the credit — not instead of it
            </p>
            <BadgeLadder lit />
          </Beat>

          {/* Beat 3 — the gates, named exactly as the dashboard names them. */}
          <Beat opacity={b3Opacity} y={b3Y}>
            <p
              style={{
                fontFamily: SANS,
                fontSize: "clamp(16px, 2.6vw, 20px)",
                color: C.textSecondary,
                maxWidth: 480,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Your referral link unlocks once you&rsquo;ve earned it.
            </p>
            <div style={{ width: 300, margin: "20px auto 0", textAlign: "left" }}>
              {REFERRAL_LINK_GATES.map((gate, i) => (
                <div
                  key={gate.key}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0" }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      color: C.textDisabled,
                      border: `1px solid ${C.border}`,
                      borderRadius: "50%",
                      width: 18,
                      height: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span
                      style={{
                        fontFamily: SANS,
                        fontSize: 13,
                        color: C.textPrimary,
                        display: "block",
                      }}
                    >
                      {gate.title}
                    </span>
                    <span
                      style={{
                        fontFamily: SANS,
                        fontSize: 11,
                        color: C.textMuted,
                        display: "block",
                        lineHeight: 1.4,
                      }}
                    >
                      {gate.sub}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: "10px 16px",
                fontFamily: MONO,
                fontSize: 12,
                color: C.textDisabled,
                maxWidth: 300,
                margin: "20px auto 0",
              }}
            >
              quorum.app/signup?ref=••••••
            </div>
          </Beat>
        </div>
      </StickyStage>
    </Chapter>
  );
}
