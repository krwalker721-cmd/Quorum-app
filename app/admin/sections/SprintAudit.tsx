"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../lib/api";
import { SectionShell } from "./Overview";

type Change = { old: unknown; new: unknown };

type Entry = {
  id: number;
  table_name: "hackathon_submissions" | "hackathon_scores";
  action: "insert" | "update" | "delete";
  subject: string;
  changes: Record<string, Change>;
  actor: string;
  deadline: string;
  created_at: string;
  sprint: { number: number; title: string } | null;
};

const ACTION_LABEL: Record<Entry["action"], string> = {
  insert: "created",
  update: "edited",
  delete: "deleted",
};

// Viewer's own timezone; the database stores UTC.
function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function show(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v === "" ? '""' : v;
  return JSON.stringify(v);
}

function clip(s: string, n = 160) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export default function SprintAuditSection() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await adminFetch("/api/admin/hackathon-audit");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "could not load the audit log");
        setEntries([]);
        return;
      }
      setEntries(json.entries ?? []);
    })();
  }, []);

  return (
    <SectionShell title="sprint_audit">
      <p className="font-mono text-[0.7rem] text-text-faint mb-5 max-w-2xl">
        every admin edit to a buildathon submission or score made after its deadline. written by the
        database, append-only.
      </p>

      {error && (
        <p className="font-mono text-xs mb-4" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}

      {entries === null ? (
        <p className="font-mono text-xs text-text-faint">loading…</p>
      ) : entries.length === 0 ? (
        !error && <p className="font-mono text-xs text-text-faint">no admin edits after a deadline</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className="border p-3"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm text-text-primary break-words min-w-0">
                  <span style={{ color: "#f59e0b" }}>{ACTION_LABEL[e.action]}</span> {e.subject}
                </p>
                <span className="font-mono text-[0.6rem] text-text-faint">{when(e.created_at)}</span>
              </div>
              <p className="font-mono text-[0.6rem] text-text-faint lowercase mt-1 break-words">
                {e.sprint ? `sprint #${e.sprint.number} · ${e.sprint.title}` : "sprint"} ·{" "}
                {e.table_name === "hackathon_scores" ? "score" : "submission"} · by {e.actor} · deadline
                was {when(e.deadline)}
              </p>
              <div className="mt-2 space-y-1">
                {Object.entries(e.changes).map(([field, c]) => (
                  <p key={field} className="font-mono text-[0.7rem] break-words">
                    <span className="text-text-muted">{field}:</span>{" "}
                    <span className="text-text-faint" title={show(c.old)}>
                      {clip(show(c.old))}
                    </span>{" "}
                    <span className="text-text-faint">→</span>{" "}
                    <span className="text-text-secondary" title={show(c.new)}>
                      {clip(show(c.new))}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
