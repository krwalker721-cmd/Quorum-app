"use client";

import type { PublicCountdown } from "@/lib/countdowns";
import { nextMilestone } from "@/lib/hackathons/timeline";
import { CountdownDigits, formatRemaining } from "./Countdown";

export { formatRemaining };

export type CountdownVariant = "landing" | "app";

type Resolved =
  | { show: false }
  | {
      show: true;
      title: string;
      sub: string | null;
      target: number | null; // null: nothing ticking (a message, or paused)
      message: string | null;
      cta: { label: string; href: string } | null;
    };

/**
 * What one countdown shows at a given moment. Display only: zero changes
 * nothing else. `link` gives a Sprint countdown a link to its page (in the
 * app; signed-out landing visitors can't open the Hackathon tab).
 */
export function resolveCountdown(c: PublicCountdown, now: number, link = false): Resolved {
  if (c.kind === "site") {
    const target = Date.parse(c.target_at);
    const cta = c.cta_label && c.cta_url ? { label: c.cta_label, href: c.cta_url } : null;
    if (now < target) return { show: true, title: c.label, sub: c.subtext, target, message: null, cta };
    if (c.zero_behavior === "hide") return { show: false };
    return { show: true, title: c.label, sub: c.subtext, target: null, message: c.zero_message, cta };
  }

  const title = c.headline || `Sprint #${c.number} · ${c.title}`;
  const cta = link ? { label: "Open", href: `/hackathon/${c.number}` } : null;
  if (c.status_override === "paused") {
    return { show: true, title, sub: null, target: null, message: "Paused. Times will be updated when it resumes.", cta };
  }
  const next = nextMilestone(c, now);
  if (!next) return { show: false };
  const sub = next.key === "ends_at" ? "Submissions close in" : `${next.label} in`;
  return { show: true, title, sub, target: Date.parse(next.at), message: null, cta };
}

/**
 * One countdown. `now` is the server's clock (useServerNow); while it's still
 * being measured only the title shows, never numbers from the device's clock.
 */
export default function CountdownView({
  countdown,
  now,
  variant,
}: {
  countdown: PublicCountdown;
  now: number | null;
  variant: CountdownVariant;
}) {
  const r = now === null ? null : resolveCountdown(countdown, now, variant === "app");
  if (r && !r.show) return null;
  const title = r?.show ? r.title : countdown.kind === "site" ? countdown.label : countdown.headline || `Sprint #${countdown.number} · ${countdown.title}`;
  const target = r?.show && r.target !== null && now !== null ? r.target : null;

  if (variant === "landing") {
    return (
      <div
        className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 backdrop-blur"
      >
        <span className="text-sm text-text-primary">{title}</span>
        {r?.show && r.sub && <span className="text-xs text-text-secondary">{r.sub}</span>}
        {target !== null && (
          <span className="text-sm">
            <CountdownDigits target={target} now={now} size="inline" />
          </span>
        )}
        {r?.show && r.message && <span className="text-sm" style={{ color: "#f8c56a" }}>{r.message}</span>}
        {r?.show && r.cta && (
          <a href={r.cta.href} className="text-xs text-text-primary underline underline-offset-4 decoration-white/30 hover:decoration-white">
            {r.cta.label} →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
      <span className="text-[13px] text-text-primary truncate">{title}</span>
      {r?.show && r.sub && <span className="text-[12px] text-text-secondary">{r.sub}</span>}
      {target !== null && (
        <span className="text-[12.5px]">
          <CountdownDigits target={target} now={now} size="inline" />
        </span>
      )}
      {r?.show && r.message && <span className="text-[12.5px]" style={{ color: "#f8c56a" }}>{r.message}</span>}
      {r?.show && r.cta && (
        <a href={r.cta.href} className="text-[12px] text-text-primary underline underline-offset-4 decoration-white/30 hover:decoration-white">
          {r.cta.label} →
        </a>
      )}
    </div>
  );
}
