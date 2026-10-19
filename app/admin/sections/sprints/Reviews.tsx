"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../../lib/api";
import { Btn, Card, ErrorLine, Kicker, send } from "../../ui";
import { askConfirm } from "../../dialog";
import { formatNy } from "@/lib/time/newYork";

// Peer reviews (migration 036), for the admin: when the reviews go out and
// the awards come in, who has reviewed, the standings the awards come from,
// and every piece of feedback with a way to hide an abusive one. Nothing
// here is needed for a Sprint to finish: both moments happen on their own.

type Data = {
  sprint: { ends_at: string | null; judging_ends_at: string | null; reveal_at: string | null; reviews_per_person: number; reviews_assigned_at: string | null; awards_finalized_at: string | null };
  reviewers: { id: string; name: string; assigned: number; done: number }[];
  standings: {
    submission_id: string;
    reviews: number;
    problem: number | null;
    works: number | null;
    use: number | null;
    overall: number | null;
    favourites: number;
    eligible: boolean;
    project: { name: string; team: { name: string } | null } | null;
  }[];
  feedback: { id: string; project: string; reviewer: string; strength: string | null; suggestion: string | null; hidden: boolean }[];
  awards: { id: string; label: string; citation: string | null; project: string }[];
};

const num = (v: number | null) => (v === null ? "—" : Number(v).toFixed(2));

export default function Reviews({ sprintId }: { sprintId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const path = `/api/admin/hackathons/${sprintId}/reviews`;

  const load = useCallback(async () => {
    const res = await adminFetch(path);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error ?? "Couldn't load the reviews.");
    setError(null);
    setData(json);
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);

  async function run(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !(await askConfirm(confirmText))) return;
    setBusy(true);
    const r = await send(path, body);
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "That didn't work.");
    await load();
  }

  if (error && !data) return <ErrorLine>{error}</ErrorLine>;
  if (!data) return <p className="font-mono text-xs text-text-faint">loading…</p>;
  const s = data.sprint;
  const now = Date.now();
  const pastDeadline = !!s.ends_at && Date.parse(s.ends_at) <= now;
  const revealed = !!s.reveal_at && Date.parse(s.reveal_at) <= now;
  const totalAssigned = data.reviewers.reduce((n, r) => n + r.assigned, 0);
  const totalDone = data.reviewers.reduce((n, r) => n + r.done, 0);

  return (
    <div className="space-y-4">
      <Card>
        <Kicker>peer reviews</Kicker>
        <p className="font-mono text-[0.7rem] text-text-secondary">
          each person reviews {s.reviews_per_person} projects (change it under settings). reviews go out at the deadline ({formatNy(s.ends_at)}) and close
          two hours or so later, when reviews close ({formatNy(s.judging_ends_at)}); the awards are worked out at the reveal ({formatNy(s.reveal_at)}).
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="font-mono text-[0.7rem]" style={{ color: s.reviews_assigned_at ? "#4ade80" : "var(--text-muted)" }}>
            {s.reviews_assigned_at ? `handed out ${formatNy(s.reviews_assigned_at)} · ${totalDone} of ${totalAssigned} done` : "not handed out yet"}
          </span>
          {!s.reviews_assigned_at && pastDeadline && (
            <Btn disabled={busy} onClick={() => run({ op: "assign" }, "Hand out the reviews now? It happens once; later loads won't redo it.")}>
              hand out now
            </Btn>
          )}
          <span className="font-mono text-[0.7rem]" style={{ color: s.awards_finalized_at ? "#4ade80" : "var(--text-muted)" }}>
            {s.awards_finalized_at ? `awards worked out ${formatNy(s.awards_finalized_at)}` : "awards not worked out yet"}
          </span>
          {revealed && (
            <Btn
              disabled={busy}
              onClick={() => run({ op: "recompute" }, "Recompute the awards from the reviews as they stand now (hidden reviews don't count)? The public page changes at once.")}
            >
              recompute awards
            </Btn>
          )}
        </div>
        <ErrorLine>{error}</ErrorLine>
      </Card>

      {data.awards.length > 0 && (
        <Card>
          <Kicker>awards</Kicker>
          <ul className="space-y-1.5">
            {data.awards.map((a) => (
              <li key={a.id} className="text-sm">
                <span style={{ color: "#f59e0b" }}>{a.label}</span> → {a.project}
                {a.citation && <span className="text-text-faint"> · {a.citation}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <Kicker>standings · admins only</Kicker>
        {data.standings.length === 0 ? (
          <p className="font-mono text-xs text-text-faint">no complete projects yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead>
                <tr className="text-left font-mono text-[0.65rem] text-text-faint">
                  <th className="py-1 pr-3">project</th>
                  <th className="py-1 pr-3 text-right">reviews</th>
                  <th className="py-1 pr-3 text-right">problem</th>
                  <th className="py-1 pr-3 text-right">works</th>
                  <th className="py-1 pr-3 text-right">use</th>
                  <th className="py-1 pr-3 text-right">overall</th>
                  <th className="py-1 pr-3 text-right">favourites</th>
                  <th className="py-1">eligible</th>
                </tr>
              </thead>
              <tbody>
                {data.standings.map((r) => (
                  <tr key={r.submission_id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="py-1.5 pr-3">
                      {r.project?.name ?? "—"}
                      <span className="text-text-faint"> · {r.project?.team?.name ?? ""}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">{r.reviews}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{num(r.problem)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{num(r.works)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{num(r.use)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{num(r.overall)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{r.favourites}</td>
                    <td className="py-1.5 font-mono text-[0.7rem]" style={{ color: r.eligible ? "#4ade80" : "#f87171" }}>
                      {r.eligible ? "yes" : "no: no teammate finished reviewing"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="font-mono text-[0.6rem] text-text-faint mt-2">
              scores are adjusted for each reviewer&rsquo;s lean (harsh or generous). a project needs two reviews to win.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <Kicker>reviewers</Kicker>
        {data.reviewers.length === 0 ? (
          <p className="font-mono text-xs text-text-faint">nobody has reviews yet</p>
        ) : (
          <ul className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {data.reviewers.map((r) => (
              <li key={r.id} className="font-mono text-[0.7rem]">
                <span className="text-text-primary">{r.name}</span>{" "}
                <span style={{ color: r.done === r.assigned ? "#4ade80" : "var(--text-muted)" }}>
                  {r.done} of {r.assigned}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <Kicker>feedback · teams see it after the reveal, without names</Kicker>
        {data.feedback.length === 0 ? (
          <p className="font-mono text-xs text-text-faint">no written feedback yet</p>
        ) : (
          <ul className="space-y-2.5">
            {data.feedback.map((f) => (
              <li key={f.id} className="text-sm" style={{ opacity: f.hidden ? 0.5 : 1 }}>
                <div className="font-mono text-[0.65rem] text-text-faint">
                  on {f.project} · by {f.reviewer}
                  {f.hidden && " · hidden"}
                </div>
                {f.strength && <p className="text-text-secondary">+ {f.strength}</p>}
                {f.suggestion && <p className="text-text-secondary">→ {f.suggestion}</p>}
                <Btn
                  className="!py-1 mt-1"
                  variant={f.hidden ? "ghost" : "danger"}
                  disabled={busy}
                  onClick={() =>
                    run(
                      { op: f.hidden ? "unhide" : "hide", review_id: f.id },
                      f.hidden ? undefined : "Hide this review? Its ratings and feedback stop counting. Recompute the awards afterwards if they're already out.",
                    )
                  }
                >
                  {f.hidden ? "show again" : "hide"}
                </Btn>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
