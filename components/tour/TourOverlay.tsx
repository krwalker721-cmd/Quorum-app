"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTour, TOUR_STEPS } from "@/contexts/TourContext";
import { openComposer } from "@/lib/tour-bus";

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
  amber: "#f59e0b",
  green: "#22c55e",
};

const PAD = 8; // breathing room around the spotlit element
const GAP = 12; // gap between the spotlight and the card
const EDGE = 16; // minimum distance from any viewport edge
const CARD_W = 280;
const ACTION_CARD_W = 340;

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
// Optional steps use a much shorter window, since their anchor legitimately may
// not exist on this layout (the cohort stats rail is xl-only).
function useAnchorRect(
  anchorId: string | null,
  graceMs: number,
): { rect: Rect | null; timedOut: boolean } {
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
      // An element that's present but not laid out (a hidden tab panel, a
      // display:none rail) has no box — treat it as absent.
      if (!el || el.getClientRects().length === 0) {
        if (Date.now() - startedAt > graceMs) setTimedOut(true);
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
  }, [anchorId, graceMs]);

  return { rect, timedOut };
}

function Panel({ style }: { style: React.CSSProperties }) {
  return <div style={{ position: "fixed", background: C.scrim, ...style }} />;
}

// Place the card against the spotlight without ever letting it leave the
// viewport. Preference is below → above → centered; a spotlight too tall for
// either side (the home page anchors the whole content column) falls through to
// centered rather than being pushed off-screen, which is what the old
// "always render below" placement did.
function placeCard(rect: Rect | null, cardW: number, cardH: number): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampLeft = (l: number) => Math.max(EDGE, Math.min(l, vw - cardW - EDGE));

  if (!rect) {
    return {
      position: "fixed",
      top: Math.max(EDGE, (vh - cardH) / 2),
      left: clampLeft((vw - cardW) / 2),
      width: cardW,
    };
  }

  const spaceBelow = vh - (rect.top + rect.height + PAD + GAP);
  const spaceAbove = rect.top - PAD - GAP;
  const left = clampLeft(rect.left + rect.width / 2 - cardW / 2);

  if (spaceBelow >= cardH + EDGE) {
    return { position: "fixed", top: rect.top + rect.height + PAD + GAP, left, width: cardW };
  }
  if (spaceAbove >= cardH + EDGE) {
    return { position: "fixed", top: rect.top - PAD - GAP - cardH, left, width: cardW };
  }
  // Neither side fits — centre it vertically, still clamped inside the viewport.
  return {
    position: "fixed",
    top: Math.max(EDGE, Math.min((vh - cardH) / 2, vh - cardH - EDGE)),
    left,
    width: cardW,
  };
}

export function TourOverlay() {
  const { step, stepIndex, isLast, next, skip, finishTour } = useTour();
  const router = useRouter();
  const isAction = step?.kind === "action";
  const cardW = isAction ? ACTION_CARD_W : CARD_W;

  const { rect, timedOut } = useAnchorRect(
    step?.kind === "pricing" ? null : step?.anchor ?? null,
    step?.optional ? 1200 : 4000,
  );

  // Measure the card so placement can react to its real height (action cards
  // with four starters are much taller than a two-line coach mark).
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(140);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => setCardH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step]);

  // An optional step whose anchor never showed up on this layout is skipped
  // rather than shown as a stranded, pointless card.
  const optionalMissing = Boolean(step?.optional) && timedOut && rect === null;
  useEffect(() => {
    if (optionalMissing) next();
  }, [optionalMissing, next]);

  // While the founder is actually writing their post, the overlay gets out of
  // the way entirely — its scrim sits above the composer modal and would
  // otherwise block the very thing the step just asked them to do. A small pill
  // keeps the tour reachable if they close the composer without posting.
  const [handedOff, setHandedOff] = useState(false);
  useEffect(() => setHandedOff(false), [stepIndex]);

  const startWith = useCallback(
    (text: string) => {
      if (!step?.action) return;
      openComposer(step.action.target, text);
      setHandedOff(true);
    },
    [step],
  );

  if (!step) return null;

  if (handedOff) {
    return (
      <div
        style={{
          position: "fixed",
          left: 20,
          bottom: 20,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: C.card,
          border: `0.5px solid ${C.border}`,
          borderRadius: 999,
          padding: "8px 8px 8px 14px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        }}
      >
        <span style={{ fontSize: 11.5, color: C.textSecondary }}>
          Post it and the tour picks back up.
        </span>
        <button
          type="button"
          onClick={() => setHandedOff(false)}
          style={{
            background: "transparent",
            border: `0.5px solid ${C.border}`,
            borderRadius: 999,
            color: C.textMuted,
            fontSize: 11,
            padding: "5px 12px",
            cursor: "pointer",
          }}
        >
          back to tour
        </button>
      </div>
    );
  }

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
  const cardStyle = placeCard(anchored ? rect : null, cardW, cardH);

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

      <div
        ref={cardRef}
        style={{
          ...cardStyle,
          visibility: ready ? "visible" : "hidden",
          background: C.card,
          border: `0.5px solid ${C.border}`,
          borderRadius: 12,
          padding: 18,
          boxSizing: "border-box",
          maxHeight: `calc(100vh - ${EDGE * 2}px)`,
          overflowY: "auto",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
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

        {/* Action step — tappable sentence starters that open the real composer
            with the line already typed. The step advances on its own when the
            post actually lands (see TourProvider's onPosted subscription). */}
        {isAction && step.action && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {step.action.starters.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => startWith(s)}
                style={{
                  textAlign: "left",
                  background: "rgba(245,158,11,0.06)",
                  border: "0.5px solid rgba(245,158,11,0.32)",
                  borderRadius: 8,
                  color: "#f8c56a",
                  fontSize: 12.5,
                  lineHeight: 1.4,
                  padding: "9px 12px",
                  cursor: "pointer",
                }}
              >
                {s.trim()}…
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, color: C.textMuted, whiteSpace: "nowrap" }}>
            {isLast ? "" : `${step.section} · ${stepIndex} / ${total}`}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                  whiteSpace: "nowrap",
                }}
              >
                Skip tour
              </button>
            )}
            <button
              type="button"
              onClick={next}
              style={{
                background: isAction ? "transparent" : C.accent,
                border: isAction ? `0.5px solid ${C.border}` : "none",
                color: isAction ? C.textSecondary : "#0d1117",
                fontSize: 12,
                fontWeight: 500,
                padding: "7px 16px",
                borderRadius: 6,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {isLast
                ? "Start exploring"
                : isAction && step.action
                  ? step.action.skipLabel
                  : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
