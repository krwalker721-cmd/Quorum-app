"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useServerNow } from "@/lib/useServerNow";
import { nextBoundary, timingFingerprint, type SprintState, type SprintTiming } from "@/lib/hackathons/sprint";

// Keeps an open Sprint page in step with the Sprint, with no manual refresh:
//
//  * At each phase boundary (on the server's clock) it reloads the page's data,
//    so the layout moves to the next state the moment the countdown hits zero.
//    The database decides the new state; if its clock hasn't quite reached the
//    boundary yet, it tries again a few seconds later.
//  * Every 30 seconds, and whenever the tab comes back into view, it checks
//    /api/hackathons/[number]/timing. If an admin moved a date, paused,
//    resumed, cancelled, or changed the countdown switches, it reloads, so the
//    countdown never runs to a time that no longer applies.

const RETRY_MS = [0, 2_000, 5_000, 10_000, 20_000, 30_000];
const MAX_TRIES = 12;
const BUFFER_MS = 500; // let the database's clock pass the boundary first

export default function SprintAutoRefresh({ timing, state }: { timing: SprintTiming; state: SprintState }) {
  const router = useRouter();
  const now = useServerNow();
  const fingerprint = timingFingerprint(timing);

  // Phase boundaries.
  const armed = useRef<number | null>(null);
  const tries = useRef(0);
  const lastTry = useRef(0);
  useEffect(() => {
    // New data from the server (a new state or new times): aim at the next boundary.
    armed.current = null;
    tries.current = 0;
  }, [state, fingerprint]);
  useEffect(() => {
    if (now === null) return;
    if (armed.current === null) armed.current = nextBoundary(timing, now) ?? Infinity;
    if (now < armed.current + BUFFER_MS || tries.current >= MAX_TRIES) return;
    if (now - lastTry.current < RETRY_MS[Math.min(tries.current, RETRY_MS.length - 1)]) return;
    tries.current += 1;
    lastTry.current = now;
    router.refresh();
  }, [now, timing, router]);

  // Admin changes.
  const known = useRef(fingerprint);
  useEffect(() => {
    known.current = fingerprint;
  }, [fingerprint]);
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/hackathons/${timing.number}/timing`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const { timing: fresh } = (await res.json()) as { timing: SprintTiming | null };
        // null: unpublished (or gone). Only news if this page showed it published.
        const next = fresh ? timingFingerprint(fresh) : timing.is_published ? "unpublished" : known.current;
        if (next !== known.current) {
          known.current = next;
          router.refresh();
        }
      } catch {
        // Offline for a moment: the next check will catch up.
      }
    };
    const t = setInterval(check, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [timing.number, timing.is_published, router]);

  return null;
}
