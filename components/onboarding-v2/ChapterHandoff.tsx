"use client";

import { useState } from "react";
import { Section, Reveal, AmberButton, C, MONO, SANS } from "./theme";

// The closing beat of the cinematic scroll. Pricing used to live here; it now
// happens hands-on as the finale of the in-app tour. This chapter's only job is
// to complete onboarding and hand the founder off into the real app, where the
// tour picks up (triggered by the ?tour=1 param). See contexts/TourContext.tsx.
export function ChapterHandoff({
  onComplete,
}: {
  onComplete: (redirectTo: string) => void;
}) {
  const [entering, setEntering] = useState(false);

  return (
    <Section id="chapter-handoff" style={{ textAlign: "center" }}>
      <Reveal>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: C.amber,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            marginBottom: 22,
          }}
        >
          // you&rsquo;re ready
        </div>
      </Reveal>

      <Reveal delay={80}>
        <h2
          style={{
            fontFamily: SANS,
            fontSize: "clamp(30px, 5.5vw, 56px)",
            fontWeight: 700,
            color: C.textPrimary,
            lineHeight: 1.06,
            letterSpacing: "-0.02em",
            margin: "0 0 20px",
          }}
        >
          Your room is ready.
        </h2>
      </Reveal>

      <Reveal delay={160}>
        <p
          style={{
            fontFamily: SANS,
            fontSize: "clamp(15px, 2.2vw, 19px)",
            color: C.textSecondary,
            lineHeight: 1.55,
            maxWidth: 480,
            margin: "0 auto 36px",
          }}
        >
          Step inside and we&rsquo;ll walk you through it — your cohort, the pulse, the board.
          It takes about a minute.
        </p>
      </Reveal>

      <Reveal delay={240}>
        <div style={{ width: "100%", maxWidth: 300, margin: "0 auto" }}>
          <AmberButton
            disabled={entering}
            onClick={() => {
              setEntering(true);
              onComplete("/home?tour=1");
            }}
          >
            {entering ? "Opening the room…" : "Step inside →"}
          </AmberButton>
        </div>
      </Reveal>
    </Section>
  );
}
