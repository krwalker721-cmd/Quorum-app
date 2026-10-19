"use client";

import { useServerNow } from "@/lib/useServerNow";
import s from "./countdown.module.css";

// The one countdown the app uses: the Sprint page, the in-app bar, the landing
// strip and the admin preview. It ticks on the server's clock (useServerNow),
// never the device's, so a phone set ten minutes fast still shows the real
// time left. Until the clock is measured it shows dashes, not a guess.

export type CountdownSize = "inline" | "standard" | "hero";

function parts(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}
const pad = (n: number) => String(n).padStart(2, "0");

/** "3d 04h 12m 09s", or "04h 12m 09s" under a day. */
export function formatRemaining(ms: number) {
  const p = parts(ms);
  return `${p.d > 0 ? `${p.d}d ` : ""}${pad(p.h)}h ${pad(p.m)}m ${pad(p.s)}s`;
}

/** The phone format: "2d 04:12:09", or "04:12:09" under a day. */
export function formatCompact(ms: number) {
  const p = parts(ms);
  return `${p.d > 0 ? `${p.d}d ` : ""}${pad(p.h)}:${pad(p.m)}:${pad(p.s)}`;
}

function spoken(ms: number) {
  const p = parts(ms);
  const bits = [
    p.d && `${p.d} day${p.d === 1 ? "" : "s"}`,
    `${p.h} hour${p.h === 1 ? "" : "s"}`,
    `${p.m} minute${p.m === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return `${bits.join(", ")} left`;
}

/**
 * The digits for a target at a given server time. Pure: pass `now` from
 * useServerNow (null while measuring). Use <Countdown> unless a parent already
 * holds the clock.
 */
export function CountdownDigits({
  target,
  now,
  size = "standard",
}: {
  target: string | number;
  now: number | null;
  size?: CountdownSize;
}) {
  const targetMs = typeof target === "number" ? target : Date.parse(target);
  const left = now === null ? null : Math.max(0, targetMs - now);

  if (size === "inline") {
    return (
      <span className={s.inline} role="timer" aria-live="off" aria-label={left === null ? undefined : spoken(left)}>
        {left === null ? "–– ––" : formatRemaining(left)}
      </span>
    );
  }

  const p = left === null ? null : parts(left);
  const units: { v: string; label: string }[] = [];
  if (p === null || p.d > 0) units.push({ v: p === null ? "––" : pad(p.d), label: p?.d === 1 ? "day" : "days" });
  units.push({ v: p === null ? "––" : pad(p.h), label: "hours" });
  units.push({ v: p === null ? "––" : pad(p.m), label: "min" });
  units.push({ v: p === null ? "––" : pad(p.s), label: "sec" });

  const urgent = left !== null && left < 3_600_000;
  const cls = [size === "hero" ? s.hero : "", urgent ? s.urgent : ""].join(" ");

  return (
    <span className={cls} role="timer" aria-live="off" aria-label={left === null ? undefined : spoken(left)}>
      <span className={s.blocks} aria-hidden>
        {units.map((u, i) => (
          <span key={u.label} style={{ display: "contents" }}>
            {i > 0 && <span className={s.sep}>:</span>}
            <span className={s.unit}>
              <span className={s.digits}>{u.v}</span>
              <span className={s.unitLabel}>{u.label}</span>
            </span>
          </span>
        ))}
      </span>
      <span className={s.compact} aria-hidden>
        {left === null ? "––:––:––" : formatCompact(left)}
      </span>
    </span>
  );
}

/** A self-contained countdown to `target` on the server's clock. */
export default function Countdown({ target, size = "standard" }: { target: string | number; size?: CountdownSize }) {
  const now = useServerNow();
  return <CountdownDigits target={target} now={now} size={size} />;
}
