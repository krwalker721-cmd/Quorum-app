"use client";

import { useState } from "react";
import { Btn, ErrorLine, send, when } from "../../ui";
import type { Participant } from "./types";

// Two hours after kickoff, anyone who hasn't pressed "I'm in" is worth a nudge.
const CHECK_IN_GRACE_MS = 2 * 3_600_000;

export default function Participants({
  sprintId,
  participants,
  startsAt,
  onChanged,
}: {
  sprintId: string;
  participants: Participant[];
  startsAt: string | null;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const active = participants.filter((p) => !p.withdrawn_at);
  const graceOver = !!startsAt && Date.now() >= new Date(startsAt).getTime() + CHECK_IN_GRACE_MS;
  const missing = graceOver ? active.filter((p) => !p.checked_in_at) : [];
  const rows = onlyMissing ? missing : showWithdrawn ? participants : active;

  async function withdraw(p: Participant) {
    if (!window.confirm(`Withdraw ${p.name} from this Sprint? They leave their team and lose the lobby.`)) return;
    const r = await send(`/api/admin/hackathons/${sprintId}/people`, { op: "withdraw", user_id: p.user_id });
    if (!r.ok) setError(r.error ?? "Couldn't withdraw them.");
    else onChanged();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="font-mono text-[0.7rem] text-text-muted">
          {active.length} registered · {active.filter((p) => p.mode === "random" && !p.team_id).length} in the random pool ·{" "}
          {active.filter((p) => p.checked_in_at).length} checked in
          {graceOver && missing.length > 0 && (
            <span style={{ color: "#f59e0b" }}> · {missing.length} not checked in 2 h after kickoff</span>
          )}
        </p>
        <div className="flex items-center gap-4">
          {graceOver && (
            <label className="flex items-center gap-2 font-mono text-[0.65rem] text-text-faint">
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> only not checked in
            </label>
          )}
          <label className="flex items-center gap-2 font-mono text-[0.65rem] text-text-faint">
            <input type="checkbox" checked={showWithdrawn} onChange={(e) => setShowWithdrawn(e.target.checked)} /> show withdrawn
          </label>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="font-mono text-xs text-text-faint">nobody has registered yet</p>
      ) : (
        <div className="overflow-x-auto border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="font-mono lowercase text-[0.6rem] text-text-faint text-left">
                <th className="px-3 py-2">name</th>
                <th className="px-3 py-2">cohort</th>
                <th className="px-3 py-2">mode</th>
                <th className="px-3 py-2">team</th>
                <th className="px-3 py-2">checked in</th>
                <th className="px-3 py-2">last active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.user_id} className="border-t" style={{ borderColor: "var(--border)", opacity: p.withdrawn_at ? 0.45 : 1 }}>
                  <td className="px-3 py-2">
                    <span className="text-text-primary">{p.name}</span>
                    {p.email && <span className="block font-mono text-[0.6rem] text-text-faint">{p.email}</span>}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{p.cohort ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[0.7rem] text-text-secondary">{p.mode}</td>
                  <td className="px-3 py-2 text-text-secondary">{p.team_name ?? "—"}</td>
                  <td
                    className="px-3 py-2 font-mono text-[0.7rem] text-text-secondary"
                    style={graceOver && !p.checked_in_at && !p.withdrawn_at ? { color: "#f59e0b" } : undefined}
                  >
                    {p.checked_in_at ? when(p.checked_in_at) : graceOver && !p.withdrawn_at ? "not yet" : "no"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.65rem] text-text-faint">{p.last_active_at ? when(p.last_active_at) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {p.withdrawn_at ? (
                      <span className="font-mono text-[0.6rem] text-text-faint">withdrawn {when(p.withdrawn_at)}</span>
                    ) : (
                      <Btn variant="danger" onClick={() => withdraw(p)}>
                        withdraw
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}
