"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
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
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <h1
        className="font-sans lowercase text-text-primary"
        style={{ fontSize: "2rem", lineHeight: 1.15 }}
      >
        your cohorts
      </h1>
      <p className="text-text-muted text-sm mt-2">
        you&apos;re in {cohorts.length} cohorts. pick a room to enter.
      </p>

      {error === "not_member" && (
        <div
          className="mt-4 px-3 py-2 border-l-2"
          style={{
            borderLeftColor: "#f87171",
            background: "rgba(239,68,68,0.06)",
          }}
        >
          <p className="font-mono lowercase text-[0.7rem]" style={{ color: "#f87171" }}>
            you are not a member of this cohort
          </p>
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
              className="text-left p-5 border transition-colors hover:border-amber"
              style={{
                background: "var(--card-elev)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-sans lowercase text-text-primary text-lg truncate">
                  {c.name.toLowerCase()}
                </p>
                {n > 0 && (
                  <span
                    className="shrink-0 font-mono text-[0.6rem] lowercase px-2 py-0.5"
                    style={{
                      background: "rgba(245, 158, 11, 0.18)",
                      color: "#f59e0b",
                      border: "1px solid rgba(245, 158, 11, 0.55)",
                      borderRadius: 5,
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
                      style={{ border: "1.5px solid var(--card-elev)" }}
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
                <span className="font-mono lowercase text-[0.65rem] text-text-faint">
                  {c.memberCount}{" "}
                  {c.memberCount === 1 ? "member" : "members"}
                </span>
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="font-mono lowercase text-[0.65rem] text-text-faint">
                  {c.lastActivity
                    ? `active ${timeAgo(c.lastActivity)} ago`
                    : "no activity yet"}
                </span>
                <span
                  className="font-mono lowercase text-[0.7rem]"
                  style={{ color: "#f59e0b" }}
                >
                  enter room →
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
