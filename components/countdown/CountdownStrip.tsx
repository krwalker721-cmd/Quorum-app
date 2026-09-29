"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Placement, PublicCountdown } from "@/lib/countdowns";
import { useServerNow } from "@/lib/useServerNow";
import CountdownView, { resolveCountdown } from "./CountdownView";

/**
 * The countdowns for one place: the landing page's strip above the hero, or
 * the app's slim bar under the trial banner. Starts from what the server
 * rendered, re-checks /api/countdowns every minute (so an admin's change shows
 * up without a reload or a redeploy), and ticks on the server's clock.
 */
export default function CountdownStrip({ initial, where }: { initial: PublicCountdown[]; where: Placement }) {
  const [items, setItems] = useState(initial);
  const now = useServerNow();
  const pathname = usePathname() ?? "";

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

  return (
    <div
      className="flex flex-col gap-1.5 px-4 sm:px-6 py-2"
      style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(245, 158, 11, 0.04)" }}
    >
      {visible.map((c) => (
        <CountdownView key={`${c.kind}-${c.id}`} countdown={c} now={now} variant="app" />
      ))}
    </div>
  );
}
