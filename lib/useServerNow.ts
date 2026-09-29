"use client";

import { useEffect, useState } from "react";

// Countdowns run on the server's clock, not the device's: a phone set ten
// minutes fast must not show a deadline ten minutes early. /api/time returns
// the database's clock; half the round trip accounts for the network. One
// measurement is shared by every countdown on the page.
//
// Between measurements the time moves on performance.now(), the browser's
// monotonic timer, never Date.now(): changing the device clock while a page
// is open doesn't move a countdown at all. The measurement is refreshed every
// five minutes and whenever the tab comes back into view (a laptop waking
// from sleep, where the monotonic timer may have paused).

let base: { serverMs: number; perfMs: number } | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

const current = () => (base === null ? null : base.serverMs + (performance.now() - base.perfMs));

async function measure() {
  const t0 = performance.now();
  const res = await fetch("/api/time", { cache: "no-store" });
  const t1 = performance.now();
  const { now } = (await res.json()) as { now: string };
  base = { serverMs: Date.parse(now) + (t1 - t0) / 2, perfMs: t1 };
  listeners.forEach((l) => l());
}

function sync(force = false) {
  if (pending) return pending;
  if (!force && base !== null && performance.now() - base.perfMs < 5 * 60_000) return Promise.resolve();
  pending = measure()
    .catch(() => {
      // Can't reach the server: keep the last measurement, or none yet.
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/**
 * The server's "now" once, without ticking: for things that only need to be
 * roughly right (the nav's LIVE label). Falls back to the device clock until
 * the first measurement, and starts one if none has been made.
 */
export function approxServerNow(): number {
  sync();
  return current() ?? Date.now();
}

/**
 * The server's "now" in milliseconds, ticking every second. Null until the
 * first measurement arrives, so nothing is ever shown on the device's clock.
 */
export function useServerNow(): number | null {
  const [now, setNow] = useState<number | null>(current);

  useEffect(() => {
    const update = () => setNow(current());
    listeners.add(update);
    sync();
    update();
    const tick = setInterval(() => {
      update();
      sync();
    }, 1000);
    const onVisible = () => document.visibilityState === "visible" && sync(true);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      listeners.delete(update);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return now;
}
