"use client";

import { useState } from "react";
import { Btn, Card, ErrorLine, Kicker, send } from "../../ui";
import { formatNy } from "@/lib/time/newYork";
import { missingMilestones, type Timeline } from "@/lib/hackathons/timeline";
import type { Sprint } from "./types";

/** What the matcher did, once it has run: teams made, who went where, anyone flagged. */
function MatchSummary({ sprint }: { sprint: Sprint }) {
  const r = sprint.match_report;
  if (!sprint.matched_at || !r) {
    return (
      <p className="font-mono text-[0.6rem] text-text-faint mt-3">
        team matcher: runs at team lock ({formatNy(sprint.team_lock_at)}), when the Sprint page next loads, or from the
        button above
      </p>
    );
  }
  if (r.skipped) {
    return <p className="font-mono text-[0.65rem] text-text-muted mt-3">team matcher: {r.skipped}</p>;
  }
  return (
    <div className="font-mono text-[0.65rem] text-text-muted mt-3 space-y-1">
      <p>
        team matcher ran {formatNy(sprint.matched_at)}: {r.pool} without a team, {r.new_teams.length} new team
        {r.new_teams.length === 1 ? "" : "s"} of {r.team_size}, {r.same_cohort_pairs} same-cohort pair
        {r.same_cohort_pairs === 1 ? "" : "s"}
      </p>
      {r.new_teams.map((t) => (
        <p key={t.team_id} className="text-text-faint">
          new · {t.name}: {t.members.join(", ")}
        </p>
      ))}
      {r.joined_open_teams.map((t) => (
        <p key={t.team_id} className="text-text-faint">
          joined · {t.name}: {t.members.join(", ")}
        </p>
      ))}
      {r.flagged.length > 0 && (
        <p style={{ color: "#f59e0b" }}>
          needs you: {r.flagged.map((f) => f.name ?? "someone").join(", ")} (no team had room; move them in the teams
          tab)
        </p>
      )}
    </div>
  );
}

function duration(ms: number) {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/** Publish, pause, resume, cancel, extend, duplicate. Every one is confirmed and logged. */
export default function SprintControls({
  sprint,
  onChanged,
  onDuplicated,
}: {
  sprint: Sprint;
  onChanged: () => void;
  onDuplicated: (id: string) => void;
}) {
  const [minutes, setMinutes] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = `/api/admin/hackathons/${sprint.id}/actions`;

  async function act(body: Record<string, unknown>, confirmText: string | null) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const r = await send(path, body);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "That didn't work.");
      return;
    }
    if (body.action === "duplicate") onDuplicated(String(r.data));
    else onChanged();
  }

  const running = ["registration", "teams_locked", "live", "judging"].includes(sprint.phase);
  const missing = missingMilestones(sprint as unknown as Timeline);
  const deadlinePassed = !!sprint.ends_at && Date.now() >= new Date(sprint.ends_at).getTime();
  const revealed = !!sprint.reveal_at && Date.now() >= new Date(sprint.reveal_at).getTime();
  const canMatch =
    !sprint.matched_at && sprint.is_published && !sprint.status_override && ["teams_locked", "live"].includes(sprint.phase);

  function extend() {
    const n = Number(minutes);
    if (!Number.isInteger(n) || n < 1) {
      setError("Enter a whole number of minutes.");
      return;
    }
    const newEnd = sprint.ends_at ? formatNy(new Date(new Date(sprint.ends_at).getTime() + n * 60_000).toISOString()) : "?";
    act(
      { action: "shift", from: "ends_at", minutes: n },
      (deadlinePassed
        ? `The deadline has already passed. Extending it REOPENS SUBMISSIONS for every team until ${newEnd}.\n\n`
        : `Move the deadline from ${formatNy(sprint.ends_at)} to ${newEnd}?\n\n`) +
        "Judging end and the reveal move by the same amount, so the order holds. Every countdown and lock follows.",
    );
  }

  function resume() {
    const pausedFor = sprint.status_override_at ? Date.now() - new Date(sprint.status_override_at).getTime() : 0;
    const giveBack = window.confirm(
      `The Sprint has been paused for ${duration(pausedFor)}.\n\n` +
        `OK: resume AND move every deadline still ahead ${duration(pausedFor)} later, to give that time back.\n` +
        "Cancel: choose whether to resume without moving anything.",
    );
    if (giveBack) {
      act({ action: "resume", extend: true }, null);
    } else if (window.confirm("Resume without moving any times?")) {
      act({ action: "resume", extend: false }, null);
    }
  }

  return (
    <Card>
      <Kicker>controls</Kicker>
      <div className="flex flex-wrap gap-2">
        {sprint.is_published ? (
          <Btn
            disabled={busy}
            onClick={() =>
              act(
                { action: "unpublish" },
                running
                  ? "This Sprint is under way. Unpublishing hides it from everyone and seals every room and lobby. Unpublish?"
                  : "Unpublish? It goes back to being a draft only admins can see.",
              )
            }
          >
            unpublish
          </Btn>
        ) : (
          <Btn
            variant="primary"
            disabled={busy || missing.length > 0}
            title={missing.length ? `Missing: ${missing.join(", ")}` : undefined}
            onClick={() => act({ action: "publish" }, `Publish Sprint #${sprint.number}? Members and the landing page will see it.`)}
          >
            publish
          </Btn>
        )}

        {sprint.status_override === "paused" ? (
          <Btn variant="primary" disabled={busy} onClick={resume}>
            resume
          </Btn>
        ) : sprint.status_override === "cancelled" ? (
          <Btn disabled={busy} onClick={() => act({ action: "uncancel" }, "Reverse the cancellation? The Sprint picks up from its current times.")}>
            undo cancel
          </Btn>
        ) : (
          <>
            <Btn
              disabled={busy || !sprint.is_published}
              onClick={() =>
                act(
                  { action: "pause" },
                  "Pause the Sprint? Team rooms, submissions and judging freeze and the lobby says so. The lobby stays open. The clock keeps running, so you can give the time back when you resume.",
                )
              }
            >
              pause
            </Btn>
            <Btn
              variant="danger"
              disabled={busy}
              onClick={() => {
                const typed = window.prompt(`Cancel Sprint #${sprint.number}? Everything freezes and the lobby becomes read-only.\n\nType CANCEL to confirm.`);
                if (typed === "CANCEL") act({ action: "cancel" }, null);
              }}
            >
              cancel sprint
            </Btn>
          </>
        )}

        <Btn
          disabled={busy}
          onClick={() => act({ action: "duplicate" }, `Start Sprint #${sprint.number}'s successor from these settings? It's a new draft with no dates and no theme.`)}
        >
          duplicate
        </Btn>
        <Btn
          disabled={busy || !canMatch}
          title={
            sprint.matched_at
              ? "Already ran. It runs once per Sprint."
              : canMatch
                ? "Puts everyone without a team into teams, now."
                : "Runs once teams lock (and not while paused or cancelled)."
          }
          onClick={() =>
            act(
              { action: "run_matcher" },
              `Run the team matcher for Sprint #${sprint.number}? Everyone registered without a team is put into a team. It runs once: you can move people afterwards by hand.`,
            )
          }
        >
          run team matcher
        </Btn>
      </div>

      <MatchSummary sprint={sprint} />

      <div className="flex flex-wrap items-end gap-2 mt-4">
        <label className="block w-32">
          <span className="font-mono lowercase text-[0.65rem] text-text-muted">extend deadline by (min)</span>
          <input className="mt-1" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <Btn disabled={busy || !sprint.ends_at || revealed} onClick={extend}>
          extend
        </Btn>
        <span className="font-mono text-[0.6rem] text-text-faint basis-full sm:basis-auto">
          Deadline now {formatNy(sprint.ends_at)}
          {deadlinePassed && !revealed ? " (passed: extending reopens submissions)" : ""}
        </span>
      </div>
      {sprint.status_override && (
        <p className="font-mono text-[0.65rem] mt-3" style={{ color: "#f59e0b" }}>
          {sprint.status_override} since {formatNy(sprint.status_override_at)}
        </p>
      )}
      <ErrorLine>{error}</ErrorLine>
    </Card>
  );
}
