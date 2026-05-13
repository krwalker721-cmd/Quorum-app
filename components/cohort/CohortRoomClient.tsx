"use client";

import { useEffect, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";
import { createClient } from "@/lib/supabase/client";
import { usePresence } from "@/components/PresenceProvider";
import { timeAgo } from "@/lib/stage";
import RoomPostModal from "@/components/cohort/RoomPostModal";
import InviteModal from "@/components/cohort/InviteModal";
import Link from "next/link";

type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
  trust_score: number | null;
};

type CheckIn = {
  user_id: string;
  weekly_win: string | null;
  decision: string | null;
  blocker: string | null;
  created_at: string;
};

type Post = {
  id: string;
  author_id: string | null;
  content: string;
  room_type: "question" | "update" | "decision" | "win" | "blocker" | null;
  tag: string | null;
  is_anonymous: boolean;
  post_type: string;
  reply_count: number;
  created_at: string;
  author: Member | null;
};

const TYPE_STYLE: Record<
  string,
  { color: string; bg?: string; label: string; needsReply?: boolean }
> = {
  question: { color: "#38bdf8", label: "question", needsReply: true },
  update: { color: "#707070", label: "update" },
  decision: {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.06)",
    label: "decision",
    needsReply: true,
  },
  win: { color: "#22c55e", label: "win" },
  blocker: { color: "#f59e0b", label: "blocker" },
};

export default function CohortRoomClient({
  currentUserId,
  members,
  checkinByUserJson,
  posts: initialPosts,
  roomName,
  myCohorts,
}: {
  currentUserId: string;
  members: Member[];
  checkinByUserJson: Record<string, CheckIn>;
  posts: Post[];
  roomName: string;
  myCohorts: { id: string; name: string }[];
}) {
  const online = usePresence();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [postOpen, setPostOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const supabase = useMemo(() => createClient(), []);
  const checkins = checkinByUserJson;
  const authorMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  useEffect(() => {
    const channel = supabase
      .channel("cohort_room:posts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const row = payload.new as Post & { author_id: string };
          if (row.post_type !== "cohort") return;
          const author = authorMap.get(row.author_id) ?? null;
          setPosts((prev) => [{ ...row, author }, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, authorMap]);

  return (
    <>
      <div className="flex" style={{ minHeight: "calc(100vh - 96px)" }}>
        {/* LEFT — roster */}
        <aside
          className="border-r flex flex-col"
          style={{ width: 260, background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="font-mono lowercase text-[0.65rem] text-text-faint">room</p>
            <p className="font-sans lowercase text-text-primary text-base mt-0.5 truncate">
              {roomName.toLowerCase()}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin px-2 py-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 px-2 py-2"
              >
                <div className="relative">
                  <Avatar
                    name={m.full_name}
                    stage={m.stage}
                    username={m.username}
                    size={28}
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${
                      online.has(m.id) ? "dot-online" : "dot-offline"
                    }`}
                    style={{ border: "1.5px solid var(--card)" }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono lowercase text-[0.7rem] text-text-primary truncate">
                    {m.full_name?.toLowerCase() ?? "—"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StagePill stage={m.stage} />
                    <span className="font-mono lowercase text-[0.55rem] text-amber">
                      +{m.trust_score ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div
            className="border-t px-3 py-3 space-y-2"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              onClick={() => setInviteOpen(true)}
              className="w-full font-mono lowercase text-[0.7rem] px-3 py-2 bg-amber text-black hover:opacity-90"
            >
              + invite to cohort
            </button>
            <Link
              href="/cohort/browse"
              className="block w-full text-center font-mono lowercase text-[0.65rem] px-3 py-1.5 border hover:border-amber transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              find a cohort →
            </Link>
          </div>
        </aside>

        {/* MAIN */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* ZONE 1 — Status board */}
          <section
            className="border-b px-6 py-4"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider">
                status_board · this week
              </p>
            </div>
            <div className="flex gap-3 overflow-x-auto scroll-thin pb-1">
              {members.map((m) => {
                const c = checkins[m.id];
                const hasCheckin = !!c;
                return (
                  <div
                    key={m.id}
                    className="shrink-0 p-3 border"
                    style={{
                      width: 240,
                      background: "var(--card-elev)",
                      borderColor: hasCheckin
                        ? "rgba(245,158,11,0.35)"
                        : "var(--border)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Avatar
                          name={m.full_name}
                          stage={m.stage}
                          username={m.username}
                          size={32}
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${
                            online.has(m.id) ? "dot-online" : "dot-offline"
                          }`}
                          style={{ border: "1.5px solid var(--card-elev)" }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono lowercase text-[0.7rem] text-text-primary truncate">
                          {m.full_name?.toLowerCase() ?? "—"}
                        </p>
                        <StagePill stage={m.stage} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="font-mono lowercase text-[0.55rem] text-text-faint">
                        this week&apos;s win
                      </p>
                      {hasCheckin && c.weekly_win ? (
                        <p className="text-[0.78rem] text-text-secondary mt-1 leading-snug">
                          {c.weekly_win}
                        </p>
                      ) : (
                        <p
                          className="text-[0.78rem] mt-1 leading-snug"
                          style={{ color: "#707070" }}
                        >
                          hasn&apos;t checked in yet
                        </p>
                      )}
                    </div>
                    {hasCheckin && c.decision && (
                      <div className="mt-2">
                        <p className="font-mono lowercase text-[0.55rem] text-text-faint">
                          working on
                        </p>
                        <p className="text-[0.75rem] text-text-muted mt-1 leading-snug">
                          {c.decision}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ZONE 2 — Discussion floor */}
          <section className="flex-1 px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono lowercase text-[0.7rem] text-text-faint tracking-wider">
                discussion_floor
              </p>
              <button
                onClick={() => setPostOpen(true)}
                className="font-mono lowercase text-[0.7rem] px-3 py-1.5 bg-amber text-black hover:opacity-90"
              >
                + post to room
              </button>
            </div>

            <div className="space-y-3 max-w-3xl">
              {posts.length === 0 && (
                <p className="font-mono lowercase text-xs text-text-faint">
                  no posts in the room yet. open the conversation.
                </p>
              )}
              {posts.map((p) => {
                const ts = p.room_type ? TYPE_STYLE[p.room_type] : null;
                const borderLeft = ts ? `3px solid ${ts.color}` : undefined;
                return (
                  <article
                    key={p.id}
                    className="p-4 border"
                    style={{
                      background: ts?.bg ?? "var(--card-elev)",
                      borderColor: "var(--border)",
                      borderLeft,
                    }}
                  >
                    <header className="flex items-center gap-3 mb-2">
                      {p.is_anonymous ? (
                        <div
                          className="w-8 h-8 flex items-center justify-center font-mono text-[0.6rem] lowercase"
                          style={{
                            background: "var(--card)",
                            color: "var(--text-faint)",
                            borderRadius: "50%",
                          }}
                        >
                          ??
                        </div>
                      ) : (
                        <Avatar
                          name={p.author?.full_name}
                          stage={p.author?.stage}
                          username={p.author?.username}
                          size={32}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-mono lowercase text-xs text-text-primary truncate">
                          {p.is_anonymous
                            ? "anonymous"
                            : p.author?.full_name?.toLowerCase() ?? "—"}
                        </p>
                        <p className="font-mono lowercase text-[0.6rem] text-text-faint">
                          {timeAgo(p.created_at)} ago
                        </p>
                      </div>
                      {ts && (
                        <span
                          className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
                          style={{
                            border: `1px solid ${ts.color}`,
                            color: ts.color,
                          }}
                        >
                          {ts.label}
                        </span>
                      )}
                    </header>
                    <p className="text-text-secondary text-[0.92rem] leading-relaxed whitespace-pre-wrap">
                      {p.content}
                    </p>
                    {ts?.needsReply && (
                      <p
                        className="font-mono lowercase text-[0.65rem] mt-3"
                        style={{ color: ts.color }}
                      >
                        respond →
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {postOpen && (
        <RoomPostModal
          userId={currentUserId}
          onClose={() => setPostOpen(false)}
        />
      )}
      {inviteOpen && (
        <InviteModal
          userId={currentUserId}
          cohorts={myCohorts}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </>
  );
}
