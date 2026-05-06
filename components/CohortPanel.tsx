"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; full_name: string | null; stage: string | null };

export default function CohortPanel({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const [online, setOnline] = useState<Set<string>>(new Set([currentUserId]));

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("presence:cohort", {
      config: { presence: { key: currentUserId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnline(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return (
    <div className="px-3 py-4 border-t" style={{ borderColor: "var(--border)" }}>
      <p className="font-mono lowercase text-[0.65rem] text-text-faint px-1 mb-2">your cohort</p>
      <div className="space-y-1.5 max-h-56 overflow-y-auto scroll-thin">
        {members.length === 0 && (
          <p className="font-mono lowercase text-[0.65rem] text-text-faint px-1">no members yet</p>
        )}
        {members.map((m) => {
          const isOnline = online.has(m.id);
          return (
            <div key={m.id} className="flex items-center gap-2 px-1 py-1">
              <div className="relative">
                <Avatar name={m.full_name} stage={m.stage} size={22} />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${isOnline ? "dot-online" : "dot-offline"}`}
                  style={{ border: "1.5px solid var(--card)" }}
                />
              </div>
              <span className="font-mono lowercase text-[0.7rem] text-text-muted truncate">
                {m.full_name?.toLowerCase() ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
