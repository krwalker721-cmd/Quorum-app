"use client";

import { Card, Changes, when } from "../../ui";
import type { LogEntry } from "./types";

/** Who changed what, from admin_change_log (migration 022). */
export default function ChangeLog({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return <p className="font-mono text-xs text-text-faint">no admin changes yet</p>;
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <Card key={e.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm text-text-primary break-words min-w-0">{e.summary ?? `${e.action} · ${e.subject}`}</p>
            <span className="font-mono text-[0.6rem] text-text-faint">{when(e.created_at)}</span>
          </div>
          <p className="font-mono text-[0.6rem] text-text-faint lowercase mt-1 break-words">
            {e.area} · {e.action} · {e.subject} · by {e.actor}
          </p>
          <Changes changes={e.changes} />
        </Card>
      ))}
    </div>
  );
}
