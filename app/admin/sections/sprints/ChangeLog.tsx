"use client";

import { Card, Changes, when } from "../../ui";
import type { LogEntry } from "./types";

type Group = { key: string; summary: string; actor: string; at: string; entries: LogEntry[] };

/**
 * Who changed what, from admin_change_log (migration 022). One admin action
 * (a merge, say) touches many rows; entries that share a note, an actor and a
 * minute are shown as that one action, with the row-by-row detail folded away.
 */
export default function ChangeLog({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return <p className="font-mono text-xs text-text-faint">no admin changes yet</p>;

  const groups: Group[] = [];
  for (const e of entries) {
    const minute = e.created_at.slice(0, 16);
    const key = `${e.summary ?? e.id}|${e.actor}|${minute}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key && e.summary) last.entries.push(e);
    else groups.push({ key, summary: e.summary ?? `${e.action} · ${e.subject}`, actor: e.actor, at: e.created_at, entries: [e] });
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <Card key={g.entries[0].id}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm text-text-primary break-words min-w-0">{g.summary}</p>
            <span className="font-mono text-[0.6rem] text-text-faint">{when(g.at)}</span>
          </div>
          <p className="font-mono text-[0.6rem] text-text-faint lowercase mt-1 break-words">by {g.actor}</p>
          <details className="mt-2">
            <summary className="font-mono text-[0.65rem] text-text-muted cursor-pointer">
              {g.entries.length === 1 ? "what changed" : `${g.entries.length} changes`}
            </summary>
            <div className="mt-2 space-y-3">
              {g.entries.map((e) => (
                <div key={e.id}>
                  <p className="font-mono text-[0.6rem] text-text-faint lowercase break-words">
                    {e.area} · {e.action} · {e.subject}
                  </p>
                  <Changes changes={e.changes} />
                </div>
              ))}
            </div>
          </details>
        </Card>
      ))}
    </div>
  );
}
