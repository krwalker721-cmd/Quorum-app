"use client";

import Avatar from "@/components/Avatar";
import { usePresence } from "@/components/PresenceProvider";

type Member = { id: string; full_name: string | null; stage: string | null; username: string | null };

export default function CohortPanel({
  members,
  currentUserId: _currentUserId,
  collapsed = false,
}: {
  members: Member[];
  currentUserId: string;
  collapsed?: boolean;
}) {
  const online = usePresence();

  return (
    <div
      style={{
        padding: collapsed ? "10px 0" : "16px 12px",
        borderTop: "0.5px solid rgba(232,112,42,0.06)",
      }}
    >
      {!collapsed && (
        <p
          className="font-mono lowercase px-1 mb-2"
          style={{ fontSize: 7, letterSpacing: "0.12em", color: "#444444", textTransform: "uppercase" }}
        >
          your cohort
        </p>
      )}
      <div
        className={collapsed ? "flex flex-col items-center gap-2 overflow-y-auto scroll-thin" : "space-y-1.5 max-h-56 overflow-y-auto scroll-thin"}
        style={collapsed ? { maxHeight: "calc(100vh - 220px)" } : undefined}
      >
        {members.length === 0 && !collapsed && (
          <p className="font-mono lowercase px-1" style={{ fontSize: 9, color: "#555555" }}>
            no members yet
          </p>
        )}
        {members.map((m) => {
          const isOnline = online.has(m.id);
          if (collapsed) {
            return (
              <div key={m.id} className="relative" title={m.full_name ?? ""}>
                <Avatar name={m.full_name} stage={m.stage} username={m.username} size={22} />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${isOnline ? "dot-online" : "dot-offline"}`}
                  style={{ border: "1.5px solid rgba(3,2,1,0.97)" }}
                />
              </div>
            );
          }
          return (
            <div key={m.id} className="flex items-center gap-2 px-1 py-1">
              <div className="relative">
                <Avatar name={m.full_name} stage={m.stage} username={m.username} size={22} />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${isOnline ? "dot-online" : "dot-offline"}`}
                  style={{ border: "1.5px solid var(--card)" }}
                />
              </div>
              <span
                className="font-mono lowercase truncate"
                style={{ fontSize: 9, color: "#555555" }}
              >
                {m.full_name?.toLowerCase() ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
