"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { TourOverlay } from "@/components/tour/TourOverlay";

/**
 * TourContext drives the in-app guided walkthrough that replaces the old
 * "build yourself in" chapters of onboarding. It lives in the (app) layout, so
 * it survives every route change while the tour steps you across real pages.
 *
 * State model (onboarding_progress):
 *   completed       Act I cinematic scroll done → the layout lets the user in.
 *   tour_step       last completed tour step (0 = not started). Resumes here.
 *   tour_completed  walkthrough finished; the overlay never shows again.
 *
 * The tour runs when `!tour_completed` AND either the handoff param `?tour=1`
 * is present (fresh from onboarding) or `tour_step > 0` (resuming). A user who
 * finished onboarding before this feature shipped (tour_step 0, no param) is
 * never retro-triggered.
 */

export interface TourStep {
  // Route to navigate to for this step.
  route: string;
  // Prefix used to decide we've already arrived — some routes redirect (e.g.
  // /profile/me → /profile/:username, /cohort → /cohort/:id), so match on the
  // shared prefix to avoid re-pushing and looping. Defaults to `route`.
  match?: string;
  // data-tour-id of the element to spotlight. null = centered card (no anchor).
  anchor: string | null;
  // "spotlight" (default) draws the coach mark. "pricing" renders the in-app
  // pricing decision as the tour's finale instead of a coach mark.
  kind?: "spotlight" | "pricing";
  title: string;
  body: string;
}

// 1-indexed to line up with tour_step (0 = not started, N = step N completed).
export const TOUR_STEPS: TourStep[] = [
  {
    route: "/home",
    anchor: "home-tiles",
    title: "This is home base",
    body: "Every part of Quorum launches from here. Let's walk through the ones that matter.",
  },
  {
    route: "/pulse",
    anchor: "pulse-composer",
    title: "Your composer",
    body: "Post a decision, a blocker, or a win here. Your cohort sees it and replies — this is the heartbeat of the room.",
  },
  {
    route: "/cohort",
    match: "/cohort",
    anchor: "cohort-members",
    title: "Your cohort",
    body: "These founders are matched to your stage. This is the room you'll actually grow with.",
  },
  {
    route: "/collab",
    anchor: "collab-new",
    title: "Build together",
    body: "Start or join a collab to work on something real with another founder. Real projects live here.",
  },
  {
    route: "/profile/me",
    match: "/profile",
    anchor: "profile-edit",
    title: "Your profile",
    body: "Fill this in whenever you're ready — your name, what you're building, and the skills founders reach out for.",
  },
  {
    route: "/referrals",
    anchor: "referrals-link",
    title: "Bring founders in",
    body: "Share your link with founders who belong here. The more who join and stay, the less you pay.",
  },
  {
    route: "/home",
    anchor: null,
    kind: "pricing",
    title: "One last thing",
    body: "You've seen the room. Here's how to keep it.",
  },
];

interface TourContextValue {
  active: boolean;
  stepIndex: number; // 1-based; 0 when inactive
  step: TourStep | null;
  isLast: boolean;
  next: () => void;
  skip: () => void;
  // Ends the tour from the pricing finale (any pricing outcome closes it).
  finishTour: () => void;
}

const TourContext = createContext<TourContextValue>({
  active: false,
  stepIndex: 0,
  step: null,
  isLast: false,
  next: () => {},
  skip: () => {},
  finishTour: () => {},
});

function persist(body: Record<string, unknown>) {
  void fetch("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function TourProvider({
  tourStep = 0,
  tourCompleted = false,
  demo = false,
  children,
}: {
  tourStep?: number;
  tourCompleted?: boolean;
  // Demo mode (unused in the shipping flow, kept as a seam for a future preview
  // harness): forces the tour active from step 1, never navigates between
  // routes, never writes to the DB, and loops at the end.
  demo?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const started = useRef(false);

  // Decide once on mount whether the tour should run, and at which step.
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (demo) {
      setStepIndex(1);
      setActive(true);
      return;
    }
    if (tourCompleted) return;

    const hasParam =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("tour") === "1";

    if (tourStep > 0) {
      // Resume: reopen on the step after the last one completed (clamped).
      const resume = Math.min(tourStep + 1, TOUR_STEPS.length);
      setStepIndex(resume);
      setActive(true);
    } else if (hasParam) {
      // Fresh handoff from onboarding — begin at step 1.
      setStepIndex(1);
      setActive(true);
      persist({ tour_step: 1 });
    }
  }, [tourStep, tourCompleted, demo]);

  const step = active ? TOUR_STEPS[stepIndex - 1] ?? null : null;
  const isLast = stepIndex >= TOUR_STEPS.length;

  // Route to the step's page if we're not already there. Match on the step's
  // prefix so redirecting routes (/cohort → /cohort/:id) don't re-push and loop.
  // The overlay then waits for the anchor to appear. Skipped in demo mode.
  useEffect(() => {
    if (demo || !active || !step) return;
    const prefix = step.match ?? step.route;
    if (!pathname.startsWith(prefix)) router.push(step.route);
  }, [demo, active, step, pathname, router]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i >= TOUR_STEPS.length) {
        // Finished the last step. Demo loops back to the start; the real tour
        // closes for good.
        if (demo) {
          setActive(true);
          return 1;
        }
        setActive(false);
        persist({ tour_completed: true, tour_step: TOUR_STEPS.length });
        return i;
      }
      const nextIndex = i + 1;
      // Persist the step we just *completed* (i), mirroring markComplete.
      if (!demo) persist({ tour_step: i });
      return nextIndex;
    });
  }, [demo]);

  const skip = useCallback(() => {
    if (demo) {
      setStepIndex(1);
      return;
    }
    setActive(false);
    persist({ tour_completed: true });
  }, [demo]);

  // Called when the pricing finale resolves (subscribe, stay free, or defer).
  // Closes the tour for good; in demo mode it just loops back to the start.
  const finishTour = useCallback(() => {
    if (demo) {
      setStepIndex(1);
      return;
    }
    setActive(false);
    persist({ tour_completed: true, tour_step: TOUR_STEPS.length });
  }, [demo]);

  return (
    <TourContext.Provider value={{ active, stepIndex, step, isLast, next, skip, finishTour }}>
      {children}
      {active && step && <TourOverlay />}
    </TourContext.Provider>
  );
}

export function useTour() {
  return useContext(TourContext);
}
