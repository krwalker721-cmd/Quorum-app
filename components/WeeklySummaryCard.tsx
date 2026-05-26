"use client";

import { useEffect, useState } from "react";

export type WeeklySummaryData = {
  firstName: string;
  weekStart: string; // ISO date
  weekEnd: string; // ISO date
  weekKey: string; // YYYY-MM-DD of the Monday — used to namespace dismissal
  stats: {
    posts_this_week: number;
    replies_given: number;
    check_in: boolean;
    messages_sent: number;
    items_saved: number;
    notes_written: number;
    decisions_voted: number;
    handshakes_logged: number;
  };
  highlights: Array<{ label: string; content: string }>;
  greetingKind: "checkin" | "helper" | "win" | "quiet" | "default";
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase();
}

function buildGreeting(kind: WeeklySummaryData["greetingKind"], firstName: string) {
  switch (kind) {
    case "checkin":
      return `you showed up this week, ${firstName}. here's what that looked like.`;
    case "helper":
      return `you were useful to someone this week, ${firstName}. here's the week.`;
    case "win":
      return `you had a win this week, ${firstName}. here's everything else.`;
    case "quiet":
      return `a quieter week, ${firstName}. here's what was still happening around you.`;
    default:
      return `here's your week, ${firstName}.`;
  }
}

const DISMISS_KEY_PREFIX = "dismissed_weekly_summary:";
const VIEWED_KEY = "last_summary_viewed_week";

export default function WeeklySummaryCard({ data }: { data: WeeklySummaryData }) {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Day-of-week gate (local time). Render only Mon (1) or Tue (2).
    const day = new Date().getDay();
    if (day !== 1 && day !== 2) return;

    try {
      const dismissedFor = localStorage.getItem(DISMISS_KEY_PREFIX + data.weekKey);
      if (dismissedFor === "1") return;
      localStorage.setItem(VIEWED_KEY, data.weekKey);
      // Notify other tabs / the sidebar dot to clear immediately.
      window.dispatchEvent(new Event("weekly-summary-viewed"));
    } catch {
      /* localStorage unavailable */
    }
    setShouldRender(true);
  }, [data.weekKey]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY_PREFIX + data.weekKey, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (!mounted || !shouldRender || dismissed) return null;

  const s = data.stats;
  const statItems: Array<{ value: string; label: string }> = [];
  if (s.posts_this_week > 0) statItems.push({ value: String(s.posts_this_week), label: "posts" });
  if (s.replies_given > 0) statItems.push({ value: String(s.replies_given), label: "replies" });
  if (s.messages_sent > 0) statItems.push({ value: String(s.messages_sent), label: "messages" });
  if (s.items_saved > 0) statItems.push({ value: String(s.items_saved), label: "saved" });
  if (s.notes_written > 0) statItems.push({ value: String(s.notes_written), label: "notes" });
  if (s.decisions_voted > 0) statItems.push({ value: String(s.decisions_voted), label: "decisions" });
  if (s.handshakes_logged > 0)
    statItems.push({ value: String(s.handshakes_logged), label: "handshakes" });

  const allZero =
    statItems.length === 0 && !s.check_in && data.highlights.length === 0;

  const greeting = allZero
    ? `the room was here even when you weren't, ${data.firstName}.`
    : buildGreeting(data.greetingKind, data.firstName);

  return (
    <div
      className="weekly-summary-card mx-6 mt-6"
      style={{
        background: "var(--card-elev)",
        borderRadius: 8,
        borderLeft: "3px solid #58a6ff",
        padding: "20px 24px",
        boxShadow: "0 0 32px rgba(88, 166, 255, 0.05), 0 0 64px rgba(88, 166, 255, 0.04)",
      }}
    >
      <p
        className="font-sans"
        style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.5 }}
      >
        {greeting}
      </p>

      <div
        className="mt-3 mb-4"
        style={{ height: 1, background: "var(--border-amber)", opacity: 0.6 }}
      />

      {allZero ? (
        <p
          className="font-sans"
          style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.6 }}
        >
          your cohort checked in. conversations happened on pulse. projects moved forward in the
          collab board. this week is a new one.
        </p>
      ) : (
        <>
          {(statItems.length > 0 || s.check_in) && (
            <div className="flex flex-wrap items-stretch gap-y-3 mb-4">
              {s.check_in && (
                <div className="flex flex-col gap-1 pr-5 mr-5" style={{ borderRight: "1px solid var(--border)" }}>
                  <span
                    className="font-mono lowercase"
                    style={{
                      fontSize: 10,
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.35)",
                      color: "#22c55e",
                      padding: "4px 8px",
                      borderRadius: 4,
                      alignSelf: "flex-start",
                    }}
                  >
                    checked in
                  </span>
                </div>
              )}
              {statItems.map((stat, i) => (
                <div
                  key={stat.label}
                  className="flex flex-col gap-1 pr-5 mr-5"
                  style={{
                    borderRight:
                      i < statItems.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <span
                    className="font-mono"
                    style={{ fontSize: 18, color: "var(--text-primary)" }}
                  >
                    {stat.value}
                  </span>
                  <span
                    className="font-mono lowercase tracking-wider"
                    style={{ fontSize: 9, color: "var(--text-faint)" }}
                  >
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {data.highlights.length > 0 && (
            <div className="space-y-3">
              {data.highlights.map((h, i) => (
                <div
                  key={i}
                  style={{
                    paddingTop: i === 0 ? 0 : 12,
                    borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  <div
                    className="font-mono uppercase tracking-wider"
                    style={{ fontSize: 9, color: "#f59e0b", marginBottom: 4 }}
                  >
                    {h.label}
                  </div>
                  <div
                    className="font-sans"
                    style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.55 }}
                  >
                    {h.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div
        className="flex items-center justify-between mt-4 pt-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span
          className="font-sans lowercase"
          style={{ fontSize: 10, color: "var(--text-faint)" }}
        >
          week of {formatDate(data.weekStart)} — {formatDate(data.weekEnd)}
        </span>
        <button
          onClick={handleDismiss}
          className="font-sans lowercase hover:opacity-80"
          style={{ fontSize: 10, color: "var(--text-faint)" }}
          aria-label="dismiss weekly summary"
        >
          dismiss
        </button>
      </div>
    </div>
  );
}
