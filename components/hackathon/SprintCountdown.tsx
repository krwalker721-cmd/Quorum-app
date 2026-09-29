"use client";

import Countdown from "@/components/countdown/Countdown";
import { stageCountdown, type SprintState, type SprintTiming } from "@/lib/hackathons/sprint";
import LocalTime from "./LocalTime";

/**
 * The Sprint page's countdown for its current state: registration opening,
 * kickoff, the deadline (the big one), or the reveal.
 *
 * Follows the admin's switches (Phase 2): with show_countdown_in_app off the
 * ticking numbers are hidden and only the time is shown; the Sprint still runs
 * on its real times, and the page still moves on at zero (SprintAutoRefresh).
 * countdown_headline_override replaces the default headline.
 */
export default function SprintCountdown({ state, timing }: { state: SprintState; timing: SprintTiming }) {
  const stage = stageCountdown(state);
  if (!stage) return null;
  const target = timing[stage.key] as string | null;
  if (!target) return null;
  const headline = timing.countdown_headline_override || stage.label;

  if (!timing.show_countdown_in_app) {
    return (
      <div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{stage.label.replace(/ in$/, "")}</p>
        <p style={{ fontSize: 17, color: "var(--text-primary)", marginTop: 4 }}>
          <LocalTime iso={target} />
        </p>
      </div>
    );
  }

  return (
    <div className={stage.big ? "text-center" : undefined}>
      <p
        style={{
          fontSize: stage.big ? 14 : 13,
          fontWeight: 500,
          letterSpacing: stage.big ? "0.02em" : undefined,
          color: stage.big ? "#f8c56a" : "var(--text-secondary)",
          marginBottom: stage.big ? 14 : 10,
        }}
      >
        {headline}
      </p>
      <Countdown target={target} size={stage.big ? "hero" : "standard"} />
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: stage.big ? 14 : 10 }}>
        <LocalTime iso={target} />
      </p>
    </div>
  );
}
