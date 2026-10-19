"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CountdownDigits } from "@/components/countdown/Countdown";
import { useServerNow } from "@/lib/useServerNow";
import { pickRelay, type RelayData } from "@/lib/landingRelay";
import s from "./landing.module.css";

// The landing page's countdown relay (Phase 11): one message, chosen by
// pickRelay from what the admin has switched on (lib/landingRelay.ts). The
// server renders it into the page (no request on load, no layout shift); it
// ticks on the server's clock, moves on by itself at each boundary, and
// re-checks /api/countdowns/landing every 30 seconds while the tab is visible,
// so an admin's change shows within about a minute. Nothing to show: nothing
// rendered, not even a gap.

const RECHECK_MS = 30_000;

export default function CountdownRelay({
  initial,
  renderedAt,
  waitlistOn,
}: {
  initial: RelayData;
  /** The server's time when the page was rendered: picks the first message
      the same way on the server and in the browser. */
  renderedAt: number;
  waitlistOn: boolean;
}) {
  const [data, setData] = useState(initial);
  const now = useServerNow();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/countdowns/landing", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as RelayData;
        if (!cancelled) setData(json);
      } catch {
        // Keep what's showing.
      }
    };
    const t = setInterval(refresh, RECHECK_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const item = pickRelay(data, now ?? renderedAt, waitlistOn);
  if (!item) return null;

  return (
    <div className={`${s.relay} mb-6`} role="region" aria-label="Quorum countdown">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0" style={{ flex: "1 1 260px" }}>
          <p className="flex items-center gap-2 text-base sm:text-lg font-medium text-text-primary leading-snug" style={{ textWrap: "balance" }}>
            {item.live && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide" style={{ color: "#4ade80", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)" }}>
                <span className={`relative inline-block h-1.5 w-1.5 rounded-full bg-green ${s.pulseDot}`} aria-hidden />
                LIVE
              </span>
            )}
            <span>{item.title}</span>
          </p>
          {item.sub && <p className="mt-1 text-sm text-text-secondary leading-relaxed">{item.sub}</p>}
          {item.message && (
            <p className="mt-1 text-sm" style={{ color: "#f8c56a" }}>
              {item.message}
            </p>
          )}
        </div>
        {item.target !== null && (
          <div className="flex flex-col items-start gap-1">
            {item.countLabel && <span className="text-xs text-text-muted">{item.countLabel}</span>}
            <CountdownDigits target={item.target} now={now} size="standard" />
          </div>
        )}
      </div>
      {item.cta && (
        <div className="mt-4">
          <Link
            href={item.cta.href}
            className={
              item.cta.primary
                ? "inline-block rounded-lg px-4 py-2 text-sm font-medium transition-[filter] hover:brightness-110"
                : "inline-block rounded-lg px-4 py-2 text-sm text-text-primary border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] transition-colors"
            }
            style={
              item.cta.primary
                ? { background: "linear-gradient(135deg, rgba(245,158,11,.95), rgba(245,158,11,.75))", color: "#1a1204", boxShadow: "0 0 0 1px rgba(245,158,11,.35), 0 8px 30px -8px rgba(245,158,11,.55)" }
                : undefined
            }
          >
            {item.cta.label} →
          </Link>
        </div>
      )}
    </div>
  );
}
