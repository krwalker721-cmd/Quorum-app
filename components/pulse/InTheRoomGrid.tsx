"use client";

import Avatar from "@/components/Avatar";
import { usePresence } from "@/components/PresenceProvider";
import ui from "@/components/ui/sleek.module.css";

type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
};

export default function InTheRoomGrid({
  members,
  max = 12,
  showCount = false,
  size = 28,
}: {
  members: Member[];
  max?: number;
  showCount?: boolean;
  size?: number;
}) {
  const online = usePresence();
  const onlineMembers = members.filter((m) => online.has(m.id));
  const visible = onlineMembers.slice(0, max);
  const overflow = Math.max(0, onlineMembers.length - max);

  if (onlineMembers.length === 0) {
    return (
      <div className={ui.empty}>
        <p className={ui.emptyTitle}>Nobody&apos;s here right now.</p>
        <p className={ui.emptySub}>Posts left now get read when the room wakes up.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {visible.map((m) => (
          <div key={m.id} className="relative">
            <Avatar
              name={m.full_name}
              stage={m.stage}
              username={m.username}
              size={size}
            />
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full dot-online"
              style={{ border: "1.5px solid var(--card-elev)" }}
            />
          </div>
        ))}
        {overflow > 0 && (
          <span className="flex items-center px-1" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            +{overflow} more
          </span>
        )}
      </div>
      {showCount && (
        <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          {onlineMembers.length} {onlineMembers.length === 1 ? "founder" : "founders"} here right now
        </p>
      )}
    </div>
  );
}
