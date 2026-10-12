"use client";

import { useState } from "react";
import { Btn, Card, ErrorLine, send, when } from "../../ui";
import { askConfirm } from "../../dialog";
import type { LobbyMessage } from "./types";

/** Lobby moderation: pin, unpin, delete. Pinned first, then newest. */
export default function Lobby({ sprintId, messages, onChanged }: { sprintId: string; messages: LobbyMessage[]; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const sorted = [...messages].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));

  async function run(op: string, id: string) {
    setError(null);
    const r = await send(`/api/admin/hackathons/${sprintId}/people`, { op, message_id: id });
    if (!r.ok) setError(r.error ?? "That didn't work.");
    else onChanged();
  }

  if (messages.length === 0) return <p className="font-mono text-xs text-text-faint">the lobby is empty</p>;

  return (
    <div className="space-y-2">
      <ErrorLine>{error}</ErrorLine>
      {sorted.map((m) => (
        <Card key={m.id} style={m.is_pinned ? { borderColor: "rgba(245, 158, 11, 0.45)" } : undefined}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-[0.65rem] text-text-muted">
              {m.author}
              {m.is_pinned && <span className="ml-2" style={{ color: "#f59e0b" }}>pinned</span>}
              {m.edited_at && !m.deleted_at && <span className="ml-2 text-text-faint">edited</span>}
            </p>
            <span className="font-mono text-[0.6rem] text-text-faint">{when(m.created_at)}</span>
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap break-words" style={{ color: m.deleted_at ? "var(--text-faint)" : "var(--text-secondary)" }}>
            {m.deleted_at ? "(deleted)" : m.body}
          </p>
          {!m.deleted_at && (
            <div className="flex gap-2 mt-2">
              <Btn onClick={() => run(m.is_pinned ? "lobby_unpin" : "lobby_pin", m.id)}>{m.is_pinned ? "unpin" : "pin"}</Btn>
              {!m.is_system && (
                <Btn variant="danger" onClick={async () => (await askConfirm("Delete this message? Its text is gone for good.", { ok: "delete", danger: true })) && run("lobby_delete", m.id)}>
                  delete
                </Btn>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
