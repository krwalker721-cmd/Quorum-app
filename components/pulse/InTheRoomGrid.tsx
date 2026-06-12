"use client";

import Avatar from "@/components/Avatar";
import { usePresence } from "@/components/PresenceProvider";

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
      <div className="empty-panel compact">
        <p className="empty-panel-title">nobody&apos;s in the room right now.</p>
        <p className="empty-panel-sub">posts left now get read when the room wakes up.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
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
          <span
            className="font-mono lowercase text-[0.65rem] text-text-faint flex items-center px-1"
          >
            +{overflow} more
          </span>
        )}
      </div>
      {showCount && (
        <p className="font-mono lowercase text-[0.65rem] text-text-faint">
          {onlineMembers.length} founders active right now
        </p>
      )}
    </div>
  );
}
