"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type NavKey = "messages" | "cohort" | "pulse" | "collab" | "vault";

type DotState = Record<NavKey, boolean>;

type Ctx = {
  dots: DotState;
  clear: (key: NavKey) => void;
};

const LS_PREFIX = "quorum:last_visited:";

const NotificationsCtx = createContext<Ctx>({
  dots: { messages: false, cohort: false, pulse: false, collab: false, vault: false },
  clear: () => {},
});

export function useNavDots() {
  return useContext(NotificationsCtx);
}

function readVisit(key: NavKey): number {
  try {
    const v = localStorage.getItem(LS_PREFIX + key);
    return v ? new Date(v).getTime() : 0;
  } catch {
    return 0;
  }
}

function writeVisit(key: NavKey, when = new Date()) {
  try {
    localStorage.setItem(LS_PREFIX + key, when.toISOString());
  } catch {}
}

export default function NotificationsProvider({
  currentUserId,
  cohortId,
  children,
}: {
  currentUserId: string;
  cohortId: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [dots, setDots] = useState<DotState>({
    messages: false,
    cohort: false,
    pulse: false,
    collab: false,
    vault: false,
  });

  const refreshAll = useCallback(async () => {
    const supabase = createClient();
    const newDots: DotState = { messages: false, cohort: false, pulse: false, collab: false, vault: false };

    // messages: any unread DM where recipient is me
    try {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", currentUserId)
        .eq("read", false);
      newDots.messages = (count ?? 0) > 0;
    } catch {}

    const lastCohort = readVisit("cohort");
    const lastPulse = readVisit("pulse");
    const lastCollab = readVisit("collab");
    const lastVault = readVisit("vault");

    // cohort dot — new posts in user's cohort room since last visit.
    // Posts are not stored per-cohort; we approximate using post_type='cohort'
    // with the cohort id stored on profile membership — since posts table is
    // global, fall back to "any new cohort post since last visit".
    if (cohortId) {
      try {
        const sinceIso = new Date(Math.max(lastCohort, Date.now() - 30 * 86_400_000)).toISOString();
        const { count } = await supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("post_type", "cohort")
          .neq("author_id", currentUserId)
          .gte("created_at", sinceIso);
        newDots.cohort = (count ?? 0) > 0;
      } catch {}
    }

    // pulse dot
    try {
      const sinceIso = new Date(Math.max(lastPulse, Date.now() - 30 * 86_400_000)).toISOString();
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("post_type", "pulse")
        .neq("author_id", currentUserId)
        .gte("created_at", sinceIso);
      newDots.pulse = (count ?? 0) > 0;
    } catch {}

    // collab dot: new join requests on my projects OR new project_messages where I'm a member
    try {
      const { data: myProjs } = await supabase
        .from("projects")
        .select("id")
        .eq("owner_id", currentUserId);
      const myOwnedIds = (myProjs ?? []).map((r: any) => r.id);
      if (myOwnedIds.length > 0) {
        const { count } = await supabase
          .from("join_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .in("project_id", myOwnedIds);
        if ((count ?? 0) > 0) newDots.collab = true;
      }
      if (!newDots.collab) {
        const { data: memberRows } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", currentUserId);
        const ids = (memberRows ?? []).map((r: any) => r.project_id);
        if (ids.length > 0) {
          const sinceIso = new Date(Math.max(lastCollab, Date.now() - 30 * 86_400_000)).toISOString();
          const { count } = await supabase
            .from("project_messages")
            .select("id", { count: "exact", head: true })
            .in("project_id", ids)
            .neq("sender_id", currentUserId)
            .gte("created_at", sinceIso);
          if ((count ?? 0) > 0) newDots.collab = true;
        }
      }
    } catch {}

    // vault dot: new community_wisdom approvals since last visit
    try {
      const sinceIso = new Date(Math.max(lastVault, Date.now() - 30 * 86_400_000)).toISOString();
      const { count } = await supabase
        .from("community_wisdom")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sinceIso);
      newDots.vault = (count ?? 0) > 0;
    } catch {}

    setDots(newDots);
  }, [currentUserId, cohortId]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll, pathname]);

  // Realtime: messages -> messages dot
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("nav_dots_messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        () => {
          setDots((d) => ({ ...d, messages: true }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // When the user lands on a tracked route, clear that dot.
  useEffect(() => {
    if (!pathname) return;
    const map: Array<[string, NavKey]> = [
      ["/messages", "messages"],
      ["/cohort", "cohort"],
      ["/pulse", "pulse"],
      ["/collab", "collab"],
      ["/vault", "vault"],
    ];
    for (const [prefix, key] of map) {
      if (pathname.startsWith(prefix)) {
        writeVisit(key);
        setDots((d) => (d[key] ? { ...d, [key]: false } : d));
      }
    }
  }, [pathname]);

  const clear = useCallback((key: NavKey) => {
    writeVisit(key);
    setDots((d) => ({ ...d, [key]: false }));
  }, []);

  return (
    <NotificationsCtx.Provider value={{ dots, clear }}>{children}</NotificationsCtx.Provider>
  );
}
