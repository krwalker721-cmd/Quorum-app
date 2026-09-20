"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import ui from "@/components/ui/sleek.module.css";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/stage";

export type CohortMember = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
};

export type CohortSummary = {
  id: string;
  name: string;
  memberCount: number;
  members: CohortMember[];
  lastActivity: string | null;
};

const LAST_VISIT_PREFIX = "cohort-last-visit-";

export default function CohortSelectionScreen({
  cohorts,
  currentUserId,
  error,
}: {
  cohorts: CohortSummary[];
  currentUserId: string;
  error?: string | null;
}) {
  const router = useRouter();
  const [unread, setUnread] = useState<Record<string, number>>({});

  // Compute unread counts per cohort: posts created since this user's last
  // visit (tracked in localStorage). The viewer's own posts don't count.
  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const entries = await Promise.all(
        cohorts.map(async (c) => {
          let since: string | null = null;
          try {
            since = localStorage.getItem(LAST_VISIT_PREFIX + c.id);
          } catch {
            since = null;
          }
          if (!since) return [c.id, 0] as const;
          const { count } = await supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("post_type", "cohort")
            .eq("cohort_id", c.id)
            .gt("created_at", since)
            .neq("author_id", currentUserId);
          return [c.id, count ?? 0] as const;
        }),
      );
      if (active) setUnread(Object.fromEntries(entries));
    })();
    return () => {
      active = false;
    };
  }, [cohorts, currentUserId]);

  function enter(id: string) {
    try {
      localStorage.setItem(LAST_VISIT_PREFIX + id, new Date().toISOString());
    } catch {
      // ignore storage failures
    }
    router.push(`/cohort/${id}`);
  }

  return (
    <div className={`px-8 py-8 max-w-5xl mx-auto ${ui.pageGlow}`}>
      <h1
        className={ui.titleGradient}
        style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
      >
        Your cohorts
      </h1>
      <p className="text-text-secondary mt-2" style={{ fontSize: 13 }}>
        You&apos;re in {cohorts.length} cohorts. Pick a room to enter.
      </p>

      {error === "not_member" && (
        <div
          className="mt-4 px-4 py-3"
          style={{
            borderRadius: 10,
            border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.06)",
          }}
        >
          <p style={{ fontSize: 12, color: "#f87171" }}>You&apos;re not a member of that cohort.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {cohorts.map((c) => {
          const n = unread[c.id] ?? 0;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => enter(c.id)}
              className={`${ui.tile} text-left`}
              style={{ padding: "20px 22px" }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-text-primary truncate" style={{ fontSize: 16, fontWeight: 600 }}>
                  {c.name}
                </p>
                {n > 0 && (
                  <span
                    className="shrink-0"
                    style={{
                      fontSize: 10.5,
                      lineHeight: 1.6,
                      padding: "0 8px",
                      borderRadius: 999,
                      background: "rgba(245, 158, 11, 0.14)",
                      color: "#f8c56a",
                      border: "1px solid rgba(245, 158, 11, 0.35)",
                    }}
                  >
                    {n} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <div className="flex -space-x-2">
                  {c.members.slice(0, 4).map((m) => (
                    <div
                      key={m.id}
                      className="rounded-full"
                      style={{ border: "1.5px solid var(--bg-surface)" }}
                    >
                      <Avatar
                        name={m.full_name}
                        stage={m.stage}
                        username={m.username}
                        size={26}
                      />
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
                </span>
              </div>

              <div className="flex items-center justify-between mt-4">
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {c.lastActivity ? `Active ${timeAgo(c.lastActivity)} ago` : "No activity yet"}
                </span>
                <span style={{ fontSize: 12, color: "#f8c56a" }}>Enter room →</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
