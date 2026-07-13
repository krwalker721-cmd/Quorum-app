"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTour, TOUR_STEPS } from "@/contexts/TourContext";

// The pricing decision only loads when the tour reaches its finale.
const PricingSection = dynamic(() => import("@/components/onboarding-v2/PricingSection"), {
  ssr: false,
});

// Palette pinned to the app's dark theme so the overlay reads as native chrome.
const C = {
  scrim: "rgba(6, 8, 12, 0.68)",
  card: "#1c2128",
  border: "#30363d",
  ring: "#58a6ff",
  textPrimary: "#e6edf3",
  textSecondary: "#8b949e",
  textMuted: "#6e7681",
  accent: "#e6edf3",
  green: "#22c55e",
};

const PAD = 8; // breathing room around the spotlit element
const CARD_W = 280;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Tracks the on-screen rect of the [data-tour-id] element, polling until it
// mounts (the step may have just navigated) and following it through scroll and
// layout shifts. `rect` is null while the anchor isn't present; `timedOut` goes
// true if it never appears within the grace window — the overlay then falls
// back to a centered card so a missing anchor can never dead-end the user.
function useAnchorRect(anchorId: string | null): { rect: Rect | null; timedOut: boolean } {
  const [rect, setRect] = useState<Rect | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const scrolled = useRef(false);

  useEffect(() => {
    if (!anchorId) {
      setRect(null);
      setTimedOut(false);
      return;
    }
    scrolled.current = false;
    setRect(null);
    setTimedOut(false);
    const startedAt = Date.now();

    const read = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour-id="${anchorId}"]`);
      if (!el) {
        // Give the page ~4s to render the anchor (route change + data fetch)
        // before falling back to a centered card.
        if (Date.now() - startedAt > 4000) setTimedOut(true);
        setRect(null);
        return;
      }
      if (!scrolled.current) {
        scrolled.current = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    read();
    const interval = window.setInterval(read, 150);
    window.addEventListener("scroll", read, true);
    window.addEventListener("resize", read);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("scroll", read, true);
      window.removeEventListener("resize", read);
    };
  }, [anchorId]);

  return { rect, timedOut };
}

function Panel({ style }: { style: React.CSSProperties }) {
  return <div style={{ position: "fixed", background: C.scrim, ...style }} />;
}

export function TourOverlay() {
  const { step, stepIndex, isLast, next, skip, finishTour } = useTour();
  const router = useRouter();
  const { rect, timedOut } = useAnchorRect(
    step?.kind === "pricing" ? null : step?.anchor ?? null,
  );

  if (!step) return null;

  // Finale — the real pricing decision, in-app, after the walkthrough. Any
  // outcome (subscribe, stay free, decide later) ends the tour and cleans the
  // ?tour=1 param off the URL.
  if (step.kind === "pricing") {
    const done = () => {
      finishTour();
      router.replace("/home");
    };
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(6, 8, 12, 0.82)",
          overflowY: "auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div style={{ width: "100%", maxWidth: 1040, padding: "48px 20px" }}>
          <PricingSection onComplete={done} />
        </div>
      </div>
    );
  }

  const total = TOUR_STEPS.length;
  // An anchored step that has timed out is treated as unanchored — centered
  // card over a full scrim — so the user can always advance.
  const anchored = Boolean(step.anchor) && !timedOut;
  const ready = !anchored || rect !== null;

  // The coach-mark / final card. Positioned near the anchor when we have a
  // rect, otherwise centered (final step, or while an anchor is still loading).
  let cardStyle: React.CSSProperties;
  if (anchored && rect) {
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const below = spaceBelow > 200;
    const top = below ? rect.top + rect.height + PAD + 12 : rect.top - PAD - 12;
    let left = rect.left + rect.width / 2 - CARD_W / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - CARD_W - 16));
    cardStyle = {
      position: "fixed",
      top,
      left,
      width: CARD_W,
      transform: below ? "none" : "translateY(-100%)",
    };
  } else {
    cardStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      width: CARD_W,
      transform: "translate(-50%, -50%)",
    };
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999 }} aria-live="polite">
      {anchored && rect ? (
        <>
          {/* Four scrim panels leave the spotlit element uncovered — so it stays
              visible and still clickable, while the rest of the page dims. */}
          <Panel style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - PAD) }} />
          <Panel
            style={{
              top: Math.max(0, rect.top - PAD),
              left: 0,
              width: Math.max(0, rect.left - PAD),
              height: rect.height + PAD * 2,
            }}
          />
          <Panel
            style={{
              top: Math.max(0, rect.top - PAD),
              left: rect.left + rect.width + PAD,
              right: 0,
              height: rect.height + PAD * 2,
            }}
          />
          <Panel style={{ top: rect.top + rect.height + PAD, left: 0, right: 0, bottom: 0 }} />
          {/* Highlight ring around the hole. */}
          <div
            style={{
              position: "fixed",
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              border: `2px solid ${C.ring}`,
              borderRadius: 10,
              boxShadow: `0 0 0 1px ${C.ring}`,
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        // Full scrim while an anchor loads, or for the centered final card.
        <div style={{ position: "fixed", inset: 0, background: C.scrim }} />
      )}

      {ready && (
        <div
          style={{
            ...cardStyle,
            background: C.card,
            border: `0.5px solid ${C.border}`,
            borderRadius: 12,
            padding: 18,
            boxSizing: "border-box",
            zIndex: 1,
          }}
        >
          {isLast && (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(34,197,94,0.16)",
                color: C.green,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
                fontSize: 20,
              }}
              aria-hidden
            >
              ✓
            </div>
          )}
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: C.textPrimary,
              marginBottom: 6,
              textAlign: isLast ? "center" : "left",
            }}
          >
            {step.title}
          </div>
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.6,
              color: C.textSecondary,
              marginBottom: 14,
              textAlign: isLast ? "center" : "left",
            }}
          >
            {step.body}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 11, color: C.textMuted }}>
              {isLast ? "" : `${stepIndex} / ${total}`}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {!isLast && (
                <button
                  type="button"
                  onClick={skip}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: C.textMuted,
                    fontSize: 12,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  Skip tour
                </button>
              )}
              <button
                type="button"
                onClick={next}
                style={{
                  background: C.accent,
                  border: "none",
                  color: "#0d1117",
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "7px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {isLast ? "Start exploring" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
