"use client";

import { usePresence } from "@/components/PresenceProvider";

export default function FoundersInRoomCount() {
  const online = usePresence();
  const count = online.size;
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-primary font-sans text-3xl tabular-nums">{count}</span>
      <span
        aria-hidden
        className="w-2 h-2 rounded-full dot-online"
      />
    </div>
  );
}
