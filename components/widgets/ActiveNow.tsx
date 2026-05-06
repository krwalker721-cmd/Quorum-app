"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

type Member = { id: string; full_name: string | null; stage: string | null };

const ZONES = ["cohort", "pulse", "vault"];

export default function ActiveNow({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const [online, setOnline] = useState<Set<string>>(new Set([currentUserId]));

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("presence:cohort", {
      config: { presence: { key: currentUserId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const onlineMembers = members.filter((m) => online.has(m.id));

  return (
    <div
      className="p-4 border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
    >
      <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
        active_now
      </p>
      <div className="space-y-2.5">
        {onlineMembers.length === 0 ? (
          <p className="font-mono lowercase text-[0.7rem] text-text-faint">nobody&apos;s online.</p>
        ) : (
          onlineMembers.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2.5">
              <div className="relative">
                <Avatar name={m.full_name} stage={m.stage} size={20} />
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
