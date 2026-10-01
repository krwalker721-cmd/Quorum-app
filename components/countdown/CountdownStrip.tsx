"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Placement, PublicCountdown } from "@/lib/countdowns";
import { useServerNow } from "@/lib/useServerNow";
import CountdownView, { resolveCountdown } from "./CountdownView";

// The app's layout keeps its header rows fixed and scrolls only the page
// under them, so every row here costs the page that much room. The bar shows
// the soonest one on phones and three elsewhere, and the rest on request.
const APP_ROWS = { phone: 1, wide: 3 };

/**
 * The countdowns for one place: the landing page's strip above the hero, or
 * the app's slim bar under the trial banner. Starts from what the server
 * rendered, re-checks /api/countdowns every minute (so an admin's change shows
 * up without a reload or a redeploy), and ticks on the server's clock.
 */
export default function CountdownStrip({ initial, where }: { initial: PublicCountdown[]; where: Placement }) {
  const [items, setItems] = useState(initial);
  const [expanded, setExpanded] = useState(false);
  const [phone, setPhone] = useState(false);
  const now = useServerNow();
  const pathname = usePathname() ?? "";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch(`/api/countdowns?where=${where}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { countdowns: PublicCountdown[] };
        if (!cancelled) setItems(json.countdowns);
      } catch {
        // Keep what's showing.
      }
    };
    const t = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [where]);

  // A Sprint's own page has the big countdown; the bar doesn't repeat it there.
  const onSprint = /^\/hackathon\/(\d+)(\/|$)/.exec(pathname)?.[1];
  const here = items.filter((c) => !(c.kind === "sprint" && String(c.number) === onSprint));
  const visible = now === null ? here : here.filter((c) => resolveCountdown(c, now).show);
  if (visible.length === 0) return null;

  if (where === "landing") {
    return (
      <div className="flex flex-col items-start gap-2 mb-5">
        {visible.map((c) => (
          <CountdownView key={`${c.kind}-${c.id}`} countdown={c} now={now} variant="landing" />
        ))}
      </div>
    );
  }

  const limit = phone ? APP_ROWS.phone : APP_ROWS.wide;
  const shown = expanded ? visible : visible.slice(0, limit);
  const hidden = visible.length - shown.length;

  return (
    <div
      className="flex flex-col gap-1.5 px-4 sm:px-6 py-2"
      style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(245, 158, 11, 0.04)" }}
    >
      {shown.map((c) => (
        <CountdownView key={`${c.kind}-${c.id}`} countdown={c} now={now} variant="app" />
      ))}
      {(hidden > 0 || expanded) && visible.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-[12px] text-text-secondary hover:text-text-primary"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          {expanded ? "Show fewer" : `+${hidden} more countdown${hidden === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}
