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
import { onPosted, type TourTarget } from "@/lib/tour-bus";

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
  // Route to navigate to for this step. May carry a query string (the collab
  // board's tab lives in `?tab=`), which is matched and pushed like any other.
  route: string;
  // Prefix used to decide we've already arrived — some routes redirect (e.g.
  // /profile/me → /profile/:username, /cohort → /cohort/:id), so match on the
  // shared prefix to avoid re-pushing and looping. Defaults to `route`'s path.
  match?: string;
  // data-tour-id of the element to spotlight. null = centered card (no anchor).
  anchor: string | null;
  // "spotlight" (default) draws the coach mark. "action" asks the founder to
  // actually do the thing, with sentence starters that prefill the real
  // composer. "pricing" renders the in-app pricing decision as the finale.
  kind?: "spotlight" | "action" | "pricing";
  // Short section name shown beside the step counter, so a long walkthrough
  // reads as a few short chapters rather than one endless queue.
  section: string;
  title: string;
  body: string;
  // Some anchors only exist on certain layouts (the cohort stats rail is
  // xl-only) or when there's data (a project card on an empty board). Optional
  // steps auto-advance instead of stranding the user on a card with no target.
  optional?: boolean;
  // Present on action steps: what to prefill, and what "done" looks like.
  action?: {
    target: TourTarget;
    starters: string[];
    // Shown under the starters as the "just get me past this" escape.
    skipLabel: string;
  };
}

// 1-indexed to line up with tour_step (0 = not started, N = step N completed).
export const TOUR_STEPS: TourStep[] = [
  // ── Home ────────────────────────────────────────────────────────────────
  {
    route: "/home",
    anchor: "home-tiles",
    section: "home",
    title: "This is home base",
    body: "Everything launches from here — what needs you today, your check-in, your cohort. Let's walk the parts that matter.",
  },

  // ── Pulse ───────────────────────────────────────────────────────────────
  {
    route: "/pulse",
    anchor: "pulse-composer",
    section: "pulse",
    title: "The pulse",
    body: "Post a decision, a blocker, or a win here and every founder on Quorum can answer. This is the fastest way to get unstuck.",
  },
  {
    route: "/pulse",
    anchor: "pulse-composer",
    kind: "action",
    section: "pulse",
    title: "Post something real",
    body: "Rooms go quiet when everyone waits to go second. Pick a starter — it opens the composer with the line already in it.",
    action: {
      target: "pulse-post",
      starters: [
        "I'm stuck on ",
        "This week I shipped ",
        "Trying to decide between ",
        "Does anyone here have experience with ",
      ],
      skipLabel: "I'll post later",
    },
  },

  // ── Cohort ──────────────────────────────────────────────────────────────
  {
    route: "/cohort",
    match: "/cohort",
    anchor: "cohort-members",
    // The roster rail is hidden on narrow viewports, same as the stats rail
    // below — without this the step would wait on an anchor that never appears.
    optional: true,
    section: "cohort",
    title: "Your cohort",
    body: "The same small group of founders, matched to your stage, every week. These are the people who'll actually know what you're working on.",
  },
  {
    route: "/cohort",
    match: "/cohort",
    anchor: "cohort-checkins",
    section: "cohort",
    title: "Weekly check-ins",
    body: "Once a week everyone posts what they're working on and where they're stuck. These cards are the answers — read them to see who to talk to.",
  },
  {
    route: "/cohort",
    match: "/cohort",
    anchor: "cohort-floor",
    section: "cohort",
    title: "The floor",
    body: "The room's ongoing conversation. No feed, no algorithm — just your cohort talking. Jump in anywhere.",
  },
  {
    route: "/cohort",
    match: "/cohort",
    anchor: "cohort-stats",
    optional: true,
    section: "cohort",
    title: "Your stats",
    body: "Your streak, your trust score, and how much you're giving back. Trust is what unlocks introductions later — it's earned by showing up and being useful.",
  },
  {
    route: "/cohort",
    match: "/cohort",
    anchor: "cohort-floor",
    kind: "action",
    section: "cohort",
    title: "Say hello to the room",
    body: "Your cohort can't help with what they don't know about. Start with one line — pick one and it opens prefilled.",
    action: {
      target: "cohort-post",
      starters: [
        "Hey all — I'm building ",
        "This week I'm focused on ",
        "Where I could use help right now is ",
      ],
      skipLabel: "I'll introduce myself later",
    },
  },

  // ── Collab board ────────────────────────────────────────────────────────
  {
    route: "/collab?tab=projects",
    match: "/collab",
    anchor: "collab-tabs",
    section: "the board",
    title: "The collab board",
    body: "Three tabs, three jobs: projects are what people are building, needs are what people are asking for, skills are who can do what.",
  },
  {
    route: "/collab?tab=projects",
    match: "/collab",
    anchor: "collab-list",
    section: "the board",
    title: "Projects",
    body: "Real things founders are building and want co-builders on. Open one and you get its project room — the whole thread, the people in it, and what they still need.",
  },
  {
    route: "/collab?tab=projects",
    match: "/collab",
    anchor: "collab-new",
    section: "the board",
    title: "Post a project",
    body: "This is where you put up what you're building so other founders can join it. Say what it is and who you're looking for.",
  },
  {
    route: "/collab?tab=needs",
    match: "/collab",
    anchor: "collab-list",
    section: "the board",
    title: "Needs",
    body: "Find people to help with your projects by posting a need. A need is one specific ask — a designer for two weeks, an intro to a CFO, a second pair of eyes on pricing.",
  },
  {
    route: "/collab?tab=needs",
    match: "/collab",
    anchor: "collab-new",
    section: "the board",
    title: "Post a need",
    body: "Same button, different job. Be specific about what you need and for how long — specific asks get answered, vague ones don't.",
  },
  {
    route: "/collab?tab=skills",
    match: "/collab",
    anchor: "collab-list",
    section: "the board",
    title: "Skills",
    body: "Every skill in the room and who has it. This is how founders find you — someone searches \"fundraising\" and your name is on the list.",
  },
  {
    route: "/collab?tab=projects",
    match: "/collab",
    anchor: "collab-new",
    kind: "action",
    section: "the board",
    title: "Put something on the board",
    body: "The board only works if there's something on it. Post the thing you're building, or the one thing you need — a starter gets you going.",
    action: {
      target: "collab-project",
      starters: [
        "Looking for a co-builder on ",
        "Need help with ",
        "Building ",
      ],
      skipLabel: "I'll post to the board later",
    },
  },

  // ── Profile ─────────────────────────────────────────────────────────────
  {
    route: "/profile/me",
    match: "/profile",
    anchor: "profile-skills",
    section: "you",
    title: "Where your skills come from",
    body: "The skills index is built from this list. Add what you're good at here and you show up when founders go looking for it.",
  },
  {
    route: "/profile/me",
    match: "/profile",
    anchor: "profile-edit",
    section: "you",
    title: "Your profile",
    body: "Fill this in whenever you're ready — your name, what you're building, and the experience founders reach out for.",
  },

  // ── Referrals + the decision ────────────────────────────────────────────
  {
    route: "/referrals",
    anchor: "referrals-link",
    section: "referrals",
    title: "Referrals",
    body: "Share your link with founders who belong here. The more who join and stay, the less you pay.",
  },
  {
    route: "/home",
    anchor: null,
    kind: "pricing",
    section: "",
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

  // Route to the step's page if we're not already there. Two things to get
  // right: some routes redirect (/cohort → /cohort/:id), so arrival is judged
  // on the step's path prefix; and some steps differ only by query string (the
  // collab tabs), so a matching path with the wrong query still needs a push.
  // Skipped in demo mode.
  useEffect(() => {
    if (demo || !active || !step) return;
    const [path, query] = step.route.split("?");
    const prefix = step.match ?? path;
    const onRightPath = pathname.startsWith(prefix);
    const currentQuery =
      typeof window === "undefined" ? "" : window.location.search.replace(/^\?/, "");
    // Only the params this step cares about have to match — `?tour=1` and any
    // other incidental param on the URL is ignored.
    const current = new URLSearchParams(currentQuery);
    const queryMatches =
      !query ||
      Array.from(new URLSearchParams(query).entries()).every(
        ([k, v]) => current.get(k) === v,
      );

    if (!onRightPath || !queryMatches) router.push(step.route);
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

  // An action step advances itself the moment the founder actually posts, so
  // the coach mark never sits on top of their own new post waiting for a click.
  useEffect(() => {
    if (!active || !step || step.kind !== "action" || !step.action) return;
    return onPosted(step.action.target, () => next());
  }, [active, step, next]);

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
