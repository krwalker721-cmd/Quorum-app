"use client";

import ui from "@/components/ui/sleek.module.css";
import { rpc, useSprintAction } from "@/lib/hackathons/actions";
import LocalTime from "./LocalTime";

/**
 * Kickoff check-in (Prompt 4): once the Sprint is live, each participant
 * presses it once. Admins see who hasn't, two hours in.
 */
export default function CheckIn({ sprintId, checkedInAt }: { sprintId: string; checkedInAt: string | null }) {
  const { busy, error, run } = useSprintAction();

  if (checkedInAt) {
    return (
      <p style={{ fontSize: 12.5, color: "#4ade80" }}>
        ✓ Checked in <LocalTime iso={checkedInAt} />
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start" style={{ gap: 6 }}>
      <button
        type="button"
        className={ui.primaryBtn}
        style={{ fontSize: 14, padding: "10px 18px" }}
        disabled={busy}
        onClick={() => run(() => rpc("hackathon_check_in", { p_hackathon_id: sprintId }))}
      >
        I&rsquo;m in — let&rsquo;s build
      </button>
      {error && (
        <p role="alert" style={{ fontSize: 12.5, color: "#fca5a5" }}>
          {error}
        </p>
      )}
    </div>
  );
}
