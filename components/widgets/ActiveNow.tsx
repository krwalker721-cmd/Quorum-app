"use client";

import Avatar from "@/components/Avatar";
import { usePresence } from "@/components/PresenceProvider";

type Member = { id: string; full_name: string | null; stage: string | null; username: string | null };

const ZONES = ["cohort", "pulse", "vault"];

export default function ActiveNow({
  members,
  currentUserId: _currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const online = usePresence();
  const onlineMembers = members.filter((m) => online.has(m.id));

  return (
    <div
      className="side-widget"
      style={{ "--w-accent": "#22c55e" } as React.CSSProperties}
    >
      <div className="side-widget-head">
        <span
          className="rounded-full"
          aria-hidden
          style={{
            width: 7,
            height: 7,
            background: onlineMembers.length > 0 ? "#22c55e" : "var(--text-disabled)",
            boxShadow: onlineMembers.length > 0 ? "0 0 6px rgba(34, 197, 94, 0.6)" : "none",
          }}
        />
        <p className="side-widget-label">active_now</p>
        {onlineMembers.length > 0 && (
          <span className="side-widget-meta">{onlineMembers.length}</span>
        )}
      </div>
      <div className="space-y-2.5">
        {onlineMembers.length === 0 ? (
          <div className="empty-panel compact">
            <p className="empty-panel-title">quiet right now.</p>
            <p className="empty-panel-sub">you&apos;re the first one in the room — leave something for the others to find.</p>
          </div>
        ) : (
          onlineMembers.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2.5">
              <div className="relative">
                <Avatar name={m.full_name} stage={m.stage} username={m.username} size={20} />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full dot-online"
                  style={{ border: "1.5px solid var(--card-elev)" }}
                />
              </div>
              <span className="font-mono lowercase text-[0.7rem] text-text-secondary truncate flex-1">
                {m.full_name?.toLowerCase() ?? "—"}
              </span>
              <span className="font-mono lowercase text-[0.6rem] text-text-faint">
                {ZONES[i % ZONES.length]}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
