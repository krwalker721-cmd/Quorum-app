"use client";

import Link from "next/link";
import ui from "@/components/ui/sleek.module.css";
import { CountdownDigits } from "@/components/countdown/Countdown";
import LocalTime from "@/components/hackathon/LocalTime";
import { useServerNow } from "@/lib/useServerNow";
import { scoringWindow } from "@/lib/hackathons/judging";
import type { SprintState } from "@/lib/hackathons/sprint";

/**
 * Where judging stands, on the server's clock: when scoring opens, how long
 * is left, how far this judge has got. judging_ends_at isn't a phase
 * boundary, so this switches by itself rather than waiting for a reload.
 */
export default function ScoringStatus({
  sprint,
  scored,
  total,
  nextHref,
}: {
  sprint: {
    state: SprintState;
    phase: string;
    ends_at: string | null;
    judging_ends_at: string | null;
    reveal_at: string | null;
    show_countdown_in_app: boolean;
  };
  scored: number;
  total: number;
  nextHref: string | null;
}) {
  const now = useServerNow();
  const win = now === null ? null : scoringWindow(sprint, now);
  const countdown = (target: string | null) =>
    !target ? null : sprint.show_countdown_in_app ? <CountdownDigits target={target} now={now} size="inline" /> : <LocalTime iso={target} />;

  let title: React.ReactNode;
  let body: React.ReactNode = null;
  switch (win) {
    case null:
      title = "Checking the time…";
      break;
    case "frozen":
      title = sprint.state === "cancelled" ? "This Sprint was cancelled" : "Judging is paused";
      body = sprint.state === "cancelled" ? "There's nothing to judge." : "Scores are frozen until the Sprint resumes.";
      break;
    case "not_yet":
      title = <>Scoring opens in {countdown(sprint.ends_at)}</>;
      body = <>When submissions close (<LocalTime iso={sprint.ends_at} />), the finished projects appear here.</>;
      break;
    case "open":
      title = <>Scoring closes in {countdown(sprint.judging_ends_at)}</>;
      body =
        total === 0
          ? "No team finished a submission."
          : scored === total
            ? "You've scored every project. You can still change a score until judging closes."
            : `You've scored ${scored} of ${total}.`;
      break;
    case "closed":
      title = sprint.phase === "revealed" ? "Judging is done. Thank you." : "Scoring is closed";
      body =
        sprint.phase === "revealed" ? (
          `You scored ${scored} of ${total}.`
        ) : (
          <>
            You scored {scored} of {total}. Results are revealed <LocalTime iso={sprint.reveal_at} />.
          </>
        );
      break;
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div style={{ minWidth: 0, flex: "1 1 260px" }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</p>
        {body && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.55 }}>{body}</p>}
        {total > 0 && win !== "not_yet" && (
          <div className={ui.barTrack} style={{ marginTop: 10, maxWidth: 360 }} aria-hidden>
            <div className={ui.barFill} style={{ width: `${(scored / total) * 100}%`, background: "#f59e0b" }} />
          </div>
        )}
      </div>
      {win === "open" && nextHref && (
        <Link href={nextHref} className={ui.primaryBtn} style={{ textDecoration: "none" }}>
          {scored === 0 ? "Start judging" : "Next to score"}
        </Link>
      )}
    </div>
  );
}
