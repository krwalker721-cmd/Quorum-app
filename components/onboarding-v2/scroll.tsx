"use client";

// The single scroll/pointer engine for the whole onboarding. One place owns:
//   • Lenis smooth-scroll (the weighted, inertial glide of award-tier sites)
//   • one springed document-progress value (0..1) every persistent layer rides
//   • scroll velocity (so things can stretch/streak when you fling the page)
//   • a smoothed pointer position (-1..1 on each axis) for at-rest depth parallax
//
// Sharing these through context means we run a single spring + a single Lenis
// loop instead of one per component, which is both cheaper and perfectly in
// sync. Everything downstream consumes MotionValues, so none of it triggers
// React re-renders on scroll — it stays on the compositor.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  useScroll,
  useSpring,
  useVelocity,
  useMotionValue,
  type MotionValue,
} from "framer-motion";
import Lenis from "lenis";

interface ScrollEngine {
  progress: MotionValue<number>;
  rawProgress: MotionValue<number>;
  velocity: MotionValue<number>;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  // Programmatic scroll that cooperates with Lenis. Native scrollIntoView is
  // useless here — Lenis writes its owned scroll position back to the window on
  // every rAF frame, so a native scroll is reverted a frame later. This routes
  // through Lenis's own scrollTo (or native scroll when Lenis is disabled for
  // reduced motion). Safe to call before Lenis has initialised — the request is
  // queued and replayed once the instance exists.
  scrollTo: (target: string | HTMLElement, opts?: { immediate?: boolean }) => void;
}

const Ctx = createContext<ScrollEngine | null>(null);

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function OnboardingScrollProvider({ children }: { children: ReactNode }) {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 30,
    mass: 0.5,
    restDelta: 0.0004,
  });

  // Velocity of the (raw) progress, gently smoothed so it reads as a force.
  const rawVelocity = useVelocity(scrollYProgress);
  const velocity = useSpring(rawVelocity, { stiffness: 120, damping: 28, mass: 0.4 });

  // Pointer position, normalised to -1..1 and springed for lazy, weighted drift.
  const pxRaw = useMotionValue(0);
  const pyRaw = useMotionValue(0);
  const pointerX = useSpring(pxRaw, { stiffness: 50, damping: 18, mass: 0.6 });
  const pointerY = useSpring(pyRaw, { stiffness: 50, damping: 18, mass: 0.6 });

  // Live Lenis instance (null until the mount effect runs, or permanently null
  // under reduced motion) plus a one-slot queue so a scrollTo requested before
  // Lenis exists still lands once it does.
  const lenisRef = useRef<Lenis | null>(null);
  const pendingScroll = useRef<{ target: string | HTMLElement; opts?: { immediate?: boolean } } | null>(null);

  const scrollTo = useCallback(
    (target: string | HTMLElement, opts?: { immediate?: boolean }) => {
      const lenis = lenisRef.current;
      if (lenis) {
        lenis.scrollTo(target, { offset: 0, ...opts });
        return;
      }
      // Reduced motion: no Lenis was ever created, so native scroll is safe (no
      // rAF loop to fight it). Otherwise queue until Lenis initialises.
      if (prefersReducedMotion()) {
        const el = typeof target === "string" ? document.querySelector(target) : target;
        el?.scrollIntoView({ behavior: opts?.immediate ? "auto" : "smooth" });
      } else {
        pendingScroll.current = { target, opts };
      }
    },
    [],
  );

  // Lenis smooth-scroll — a single rAF loop for the whole page. Skipped entirely
  // when the user prefers reduced motion (native scroll then).
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({
      // A touch snappier than default so the long scroll feels immediate, not
      // draggy, while keeping the weighted glide.
      lerp: 0.12,
      wheelMultiplier: 1.15,
      smoothWheel: true,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;
    // Dev-only: expose the instance so programmatic scrolling (and verification)
    // doesn't fight Lenis's owned scroll position.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    }
    // Replay any scroll requested before Lenis was ready (e.g. a resume target
    // resolved from the network faster than this effect ran).
    if (pendingScroll.current) {
      const { target, opts } = pendingScroll.current;
      pendingScroll.current = null;
      lenis.scrollTo(target, { offset: 0, ...opts });
    }
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Pointer parallax source.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const onMove = (e: PointerEvent) => {
      pxRaw.set((e.clientX / window.innerWidth) * 2 - 1);
      pyRaw.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [pxRaw, pyRaw]);

  return (
    <Ctx.Provider
      value={{ progress, rawProgress: scrollYProgress, velocity, pointerX, pointerY, scrollTo }}
    >
      {children}
    </Ctx.Provider>
  );
}

// Consumed by the persistent layers. Returns inert zero MotionValues if somehow
// used outside the provider, so a stray consumer can never crash the page.
export function useOnboardingScroll(): ScrollEngine {
  const ctx = useContext(Ctx);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const zero = useMotionValue(0);
  return ctx ?? {
    progress: zero,
    rawProgress: zero,
    velocity: zero,
    pointerX: zero,
    pointerY: zero,
    scrollTo: () => {},
  };
}
