"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Drives the cinematic explainer screens (steps 04/06/08/10/12/14). Each screen
// has a fixed number of "beats" the user steps through. Advancing happens on
// click, scroll-down, or →/↓/space; going back on scroll-up or ←/↑. After the
// final beat `isComplete` flips so the shell can swap the hint for the CTA.
//
// `currentBeat` starts at -1 (nothing shown) and lands on 0 shortly after mount
// so the first caption animates in rather than appearing instantly.
export interface CinematicBeats {
  currentBeat: number;
  isComplete: boolean;
  advance: () => void;
  goBack: () => void;
}

// Debounce so one physical scroll/click can't skip multiple beats.
const LOCK_MS = 900;
const SCROLL_THROTTLE_MS = 600;

export function useCinematicBeats(totalBeats: number): CinematicBeats {
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [isComplete, setIsComplete] = useState(false);
  const lockedRef = useRef(false);
  const lastScrollTime = useRef(0);

  const advance = useCallback(() => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setCurrentBeat((prev) => {
      const next = prev + 1;
      if (next >= totalBeats) {
        setIsComplete(true);
        return prev;
      }
      return next;
    });
    setTimeout(() => {
      lockedRef.current = false;
    }, LOCK_MS);
  }, [totalBeats]);

  const goBack = useCallback(() => {
    if (lockedRef.current) return;
    setIsComplete(false);
    setCurrentBeat((prev) => (prev <= 0 ? prev : prev - 1));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goBack();
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") advance();
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastScrollTime.current < SCROLL_THROTTLE_MS) return;
      lastScrollTime.current = now;
      if (e.deltaY > 0) advance();
      else if (e.deltaY < 0) goBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [advance, goBack]);

  // Kick off the first beat just after mount so it fades in.
  useEffect(() => {
    const t = setTimeout(() => setCurrentBeat(0), 400);
    return () => clearTimeout(t);
  }, []);

  return { currentBeat, isComplete, advance, goBack };
}
