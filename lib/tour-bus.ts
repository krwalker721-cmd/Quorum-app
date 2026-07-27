"use client";

// A tiny window-event bus that lets the guided tour drive the app's real
// composers instead of mocking them.
//
// Two directions:
//   openComposer(target, text)  tour → page   "open your composer, prefilled"
//   reportPosted(target)        page → tour   "they actually posted"
//
// Window events (rather than context) keep the coupling one-way and optional:
// the composers work exactly as before when no tour is running, and the tour
// can't break a page that hasn't opted in. Everything here is a no-op on the
// server.

export type TourTarget = "pulse-post" | "cohort-post" | "collab-project";

const OPEN_EVENT = "quorum:tour-open-composer";
const POSTED_EVENT = "quorum:tour-posted";

interface OpenDetail {
  target: TourTarget;
  text: string;
}

// Tour → page. Ask the page owning `target` to open its composer with `text`
// already in the field.
export function openComposer(target: TourTarget, text: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenDetail>(OPEN_EVENT, { detail: { target, text } }),
  );
}

// Page side. Subscribe to open requests for one target; returns an unsubscribe.
export function onOpenComposer(
  target: TourTarget,
  handler: (text: string) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<OpenDetail>).detail;
    if (detail?.target === target) handler(detail.text ?? "");
  };
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}

// Page → tour. Fired after a successful post/create so an action step can
// advance itself. Safe to call whether or not a tour is running.
export function reportPosted(target: TourTarget) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TourTarget>(POSTED_EVENT, { detail: target }));
}

// Tour side. Subscribe to completions for one target; returns an unsubscribe.
export function onPosted(target: TourTarget, handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    if ((e as CustomEvent<TourTarget>).detail === target) handler();
  };
  window.addEventListener(POSTED_EVENT, listener);
  return () => window.removeEventListener(POSTED_EVENT, listener);
}
