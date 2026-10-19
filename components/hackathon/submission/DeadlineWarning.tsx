"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ui from "@/components/ui/sleek.module.css";
import { approxServerNow } from "@/lib/useServerNow";

const MIN = 60_000;

/**
 * "1 hour left" and "10 minutes left" while the team's submission isn't
 * complete (Phase 8). On the server's clock; gone once it's submitted or
 * the deadline passes.
 */
export default function DeadlineWarning({
  endsAt,
  live,
  complete,
  href,
}: {
  endsAt: string | null;
  live: boolean;
  complete: boolean;
  /** Where "Finish it" goes (the room links to the form; the form omits it). */
  href?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(approxServerNow());
    const t = setInterval(() => setNow(approxServerNow()), 15_000);
    return () => clearInterval(t);
  }, []);

  if (!live || complete || !endsAt || now === null) return null;
  const left = Date.parse(endsAt) - now;
  if (left <= 0 || left > 60 * MIN) return null;
  const urgent = left <= 10 * MIN;
  const mins = Math.max(1, Math.ceil(left / MIN));

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 flex-wrap"
      style={{
        border: `1px solid ${urgent ? "rgba(248, 113, 113, 0.5)" : "rgba(245, 158, 11, 0.45)"}`,
        background: urgent ? "rgba(248, 113, 113, 0.09)" : "rgba(245, 158, 11, 0.09)",
        borderRadius: 12,
        padding: "11px 16px",
        marginBottom: 14,
      }}
    >
      <p style={{ fontSize: 13.5, color: "var(--text-primary)" }}>
        <strong style={{ color: urgent ? "#fca5a5" : "#f8c56a" }}>
          {urgent ? `${mins} minute${mins === 1 ? "" : "s"} left` : "Less than an hour left"}
        </strong>{" "}
        and your submission isn&rsquo;t complete yet.
      </p>
      {href && (
        <Link href={href} className={ui.primaryBtn}>
          Finish it
        </Link>
      )}
    </div>
  );
}
