"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type NavKey =
  | "messages"
  | "cohort"
  | "pulse"
  | "collab"
  | "vault"
  | "referrals"
  | "settings";

type DotState = Record<NavKey, boolean>;

type Ctx = {
  dots: DotState;
  clear: (key: NavKey) => void;
};

const LS_PREFIX = "quorum:last_visited:";

// Notification kinds that light up the referrals / settings nav dots. These are
// driven by the notifications.read flag rather than last-visit timestamps.
const REFERRAL_DOT_KINDS = [
  "referral_activated",
  "referral_reward",
  "monthly_bonus_updated",
];
const SETTINGS_DOT_KINDS = ["trial_ending", "trial_expired", "payment_failed"];

const EMPTY_DOTS: DotState = {
  messages: false,
  cohort: false,
  pulse: false,
  collab: false,
  vault: false,
  referrals: false,
  settings: false,
};

const NotificationsCtx = createContext<Ctx>({
  dots: EMPTY_DOTS,
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
  const [dots, setDots] = useState<DotState>(EMPTY_DOTS);

  const refreshAll = useCallback(async () => {
    const supabase = createClient();
    const newDots: DotState = { ...EMPTY_DOTS };

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

    // referrals dot: any unread referral notification.
    try {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", currentUserId)
        .eq("read", false)
        .in("kind", REFERRAL_DOT_KINDS);
      newDots.referrals = (count ?? 0) > 0;
    } catch {}

    // settings dot: any unread trial/billing notification.
    try {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", currentUserId)
        .eq("read", false)
        .in("kind", SETTINGS_DOT_KINDS);
      newDots.settings = (count ?? 0) > 0;
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
      ["/referrals", "referrals"],
      ["/settings", "settings"],
    ];
    for (const [prefix, key] of map) {
      if (pathname.startsWith(prefix)) {
        writeVisit(key);
        setDots((d) => (d[key] ? { ...d, [key]: false } : d));
        // The referrals/settings dots are backed by the notifications.read flag
        // rather than visit timestamps — mark the matching unread rows read so
        // the dot doesn't reappear on the next refresh.
        const kinds =
          key === "referrals"
            ? REFERRAL_DOT_KINDS
            : key === "settings"
              ? SETTINGS_DOT_KINDS
              : null;
        if (kinds) {
          const supabase = createClient();
          supabase
            .from("notifications")
            .update({ read: true })
            .eq("user_id", currentUserId)
            .eq("read", false)
            .in("kind", kinds)
            .then(() => {}, () => {});
        }
      }
    }
  }, [pathname, currentUserId]);

  const clear = useCallback((key: NavKey) => {
    writeVisit(key);
    setDots((d) => ({ ...d, [key]: false }));
  }, []);

  return (
    <NotificationsCtx.Provider value={{ dots, clear }}>{children}</NotificationsCtx.Provider>
  );
}
