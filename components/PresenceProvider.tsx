"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PresenceCtx = createContext<Set<string>>(new Set());

export function PresenceProvider({
  currentUserId,
  children,
}: {
  currentUserId: string;
  children: React.ReactNode;
}) {
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
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return <PresenceCtx.Provider value={online}>{children}</PresenceCtx.Provider>;
}

export const usePresence = () => useContext(PresenceCtx);
