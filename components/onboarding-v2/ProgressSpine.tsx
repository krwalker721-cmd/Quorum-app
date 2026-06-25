"use client";

// The persistent HUD that threads the whole experience together — the one
// element that is always on screen, always responding to scroll, regardless of
// which chapter you're in.
//
//   • a hairline progress rail down the left edge that fills with scroll
//   • a chapter counter + name, bottom-left, that updates as chapters cross the
//     viewport centre (discovered from the DOM, so it survives any reordering)
//   • an identity chip, top-right, that materialises and fills in as the founder
//     builds themselves into the room (name → stage → skills → cohort)
//
// All of it is non-interactive and sits above the atmosphere but below modals.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { initials } from "@/lib/stage";
import { useOnboardingScroll } from "./scroll";
import { StagePill } from "./bits";
import { C, MONO, SANS, hexToRgba } from "./theme";

export interface Identity {
  name: string | null;
  stage: string | null;
  skillCount: number;
  cohortName: string | null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function ProgressSpine({ identity }: { identity: Identity }) {
  const { progress } = useOnboardingScroll();
  const [active, setActive] = useState(0);
  const [label, setLabel] = useState("");
  const [total, setTotal] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  // Discover labelled chapters from the DOM and track which one owns the
  // viewport centre. The -50%/-50% rootMargin collapses the trigger zone to a
  // single horizontal line through the middle of the screen.
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-chapter]"),
    ).filter((el) => (el.dataset.chapter ?? "").length > 0);
    setTotal(els.length);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = els.indexOf(entry.target as HTMLElement);
          if (idx === -1) continue;
          setActive(idx);
          setLabel((entry.target as HTMLElement).dataset.chapter ?? "");
        }
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    // Defer observing until initial layout settles — otherwise overlapping
    // zero-height elements at mount can briefly mark the wrong chapter active
    // (e.g. flashing "02" while still on the cold open).
    const start = window.setTimeout(() => els.forEach((el) => observer.observe(el)), 250);
    setLabel(els[0].dataset.chapter ?? "");
    return () => {
      window.clearTimeout(start);
      observer.disconnect();
    };
  }, []);

  const hasIdentity = !!identity.name || identity.skillCount > 0 || !!identity.cohortName;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        pointerEvents: "none",
        fontFamily: MONO,
      }}
    >
      {/* Left progress rail */}
      <div
        ref={railRef}
        style={{
          position: "absolute",
          top: "12vh",
          bottom: "12vh",
          left: 22,
          width: 2,
          background: hexToRgba(C.textPrimary, 0.06),
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <motion.div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "100%",
            transformOrigin: "top",
            scaleY: progress,
            background: `linear-gradient(${hexToRgba(C.amber, 0.0)}, ${C.amber})`,
          }}
        />
      </div>

      {/* Chapter counter + name, bottom-left */}
      <div
        style={{
          position: "absolute",
          left: 18,
          bottom: 26,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 11, color: C.amber, letterSpacing: "0.1em" }}>
          {pad(active + 1)}
          <span style={{ color: C.textDisabled }}> / {pad(total || 1)}</span>
        </span>
        <span
          style={{
            fontSize: 9,
            color: C.textMuted,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>

      {/* Evolving identity chip, top-right */}
      <motion.div
        initial={false}
        animate={{ opacity: hasIdentity ? 1 : 0, y: hasIdentity ? 0 : -8 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px 8px 8px",
          background: hexToRgba(C.surface, 0.7),
          border: `1px solid ${C.border}`,
          borderRadius: 999,
          backdropFilter: "blur(8px)",
          maxWidth: "min(76vw, 320px)",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            flexShrink: 0,
            borderRadius: "50%",
            border: `1.5px solid ${C.amber}`,
            background: hexToRgba(C.amber, 0.12),
            color: C.amber,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            textTransform: "uppercase",
          }}
        >
          {identity.name ? initials(identity.name) : "YOU"}
        </div>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontFamily: SANS,
              fontSize: 11,
              color: C.textPrimary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {identity.name || "Your founder card"}
          </span>
          <span
            style={{
              fontSize: 8,
              color: C.textMuted,
              letterSpacing: "0.08em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {identity.cohortName
              ? `// ${identity.cohortName}`
              : identity.skillCount > 0
                ? `// ${identity.skillCount} strength${identity.skillCount === 1 ? "" : "s"}`
                : "// building you in"}
          </span>
        </div>
        {identity.stage && <StagePill stage={identity.stage} />}
      </motion.div>
    </div>
  );
}
