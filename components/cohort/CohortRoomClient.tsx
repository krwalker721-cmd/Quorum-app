"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";
import { createClient } from "@/lib/supabase/client";
import { usePresence } from "@/components/PresenceProvider";
import { timeAgo, TAG_COLOR } from "@/lib/stage";
import RoomPostModal from "@/components/cohort/RoomPostModal";
import InviteModal from "@/components/cohort/InviteModal";
import FounderAgreements from "@/components/cohort/FounderAgreements";
import LeaveCohortButton from "@/components/cohort/LeaveCohortButton";
import PostMenu from "@/components/PostMenu";
import Link from "next/link";
import { isAnniversary, type RosterFlags } from "@/lib/recognition";

type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
  trust_score: number | null;
  created_at?: string | null;
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
  cohort_id?: string | null;
  reply_count: number;
  created_at: string;
  local_hour?: number | null;
  author: Member | null;
  movedTheRoom?: boolean;
};

const TYPE_STYLE: Record<
  string,
  { color: string; bg?: string; label: string; needsReply?: boolean }
> = {
  question: { color: "#38bdf8", label: "question", needsReply: true },
  update: { color: "#6e7681", label: "update" },
  decision: {
    color: "#f59e0b",
    bg: "rgba(245, 158, 11,0.06)",
    label: "decision",
    needsReply: true,
  },
  win: { color: "#22c55e", label: "win" },
  blocker: { color: "#f59e0b", label: "blocker" },
};

function isDifferentDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() !== db.getFullYear() ||
    da.getMonth() !== db.getMonth() ||
    da.getDate() !== db.getDate()
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (x: Date, y: Date) =>
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate();
  if (sameDay(d, today)) return "today";
  if (sameDay(d, yest)) return "yesterday";
  return d
    .toLocaleDateString(undefined, { month: "short", day: "numeric" })
    .toLowerCase();
}

export default function CohortRoomClient({
  currentUserId,
  cohortId,
  members: initialMembers,
  checkinByUserJson,
  posts: initialPosts,
  roomName,
  myCohorts,
  showBreadcrumb = false,
  rosterFlags,
  isCreator = false,
}: {
  currentUserId: string;
  cohortId: string;
  members: Member[];
  checkinByUserJson: Record<string, CheckIn>;
  posts: Post[];
  roomName: string;
  myCohorts: { id: string; name: string }[];
  showBreadcrumb?: boolean;
  rosterFlags: Record<string, RosterFlags>;
  isCreator?: boolean;
}) {
  const router = useRouter();
  const online = usePresence();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [postOpen, setPostOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [posting, setPosting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => createClient(), []);
  const checkins = checkinByUserJson;
  const authorMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  // Mark this cohort as visited so the selection screen's unread badge resets.
  useEffect(() => {
    try {
      localStorage.setItem(
        `cohort-last-visit-${cohortId}`,
        new Date().toISOString(),
      );
    } catch {
      // ignore storage failures
    }
  }, [cohortId]);

  useEffect(() => {
    const channel = supabase
      .channel(`cohort_room:posts:${cohortId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const row = payload.new as Post & {
            author_id: string;
            parent_post_id?: string | null;
          };
          // Only posts that belong to THIS cohort room.
          if (row.post_type !== "cohort") return;
          if (row.cohort_id !== cohortId) return;
          // A reply bumps the parent's count instead of becoming a new card.
          if (row.parent_post_id) {
            setPosts((prev) =>
              prev.map((p) =>
                p.id === row.parent_post_id
                  ? { ...p, reply_count: (p.reply_count ?? 0) + 1 }
                  : p,
              ),
            );
            return;
          }
          const author = authorMap.get(row.author_id) ?? null;
          setPosts((prev) =>
            prev.find((p) => p.id === row.id) ? prev : [{ ...row, author }, ...prev],
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, authorMap, cohortId]);

  // Realtime: membership removals. If I'm removed from this cohort, bounce me to
  // the cohort selection screen; otherwise drop the member from the roster live.
  useEffect(() => {
    const channel = supabase
      .channel(`cohort_members:${cohortId}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "cohort_members",
          filter: `cohort_id=eq.${cohortId}`,
        },
        (payload) => {
          const removed = payload.old as { user_id?: string };
          if (!removed?.user_id) return;
          if (removed.user_id === currentUserId) {
            router.replace("/cohort");
          } else {
            setMembers((prev) => prev.filter((m) => m.id !== removed.user_id));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, cohortId, currentUserId, router]);

  async function kickMember(target: Member) {
    if (
      !window.confirm(
        `remove ${target.full_name?.toLowerCase() ?? "this member"} from this cohort? they will be reassigned to another cohort.`,
      )
    ) {
      return;
    }
    const res = await fetch("/api/cohort/kick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cohort_id: cohortId, user_id: target.id }),
    });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== target.id));
    } else {
      const j = await res.json().catch(() => ({}));
      window.alert(j?.error ?? "could not remove member");
    }
  }

  // Chronological order for the chat floor (oldest → newest).
  const chronological = useMemo(
    () =>
      [...posts].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [posts],
  );

  // Auto-scroll to the newest message when the count changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chronological.length]);

  const me = authorMap.get(currentUserId) ?? null;

  async function handlePost() {
    const trimmed = messageText.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    const { error } = await supabase.from("posts").insert({
      author_id: currentUserId,
      content: trimmed,
      post_type: "cohort",
      cohort_id: cohortId,
      is_anonymous: false,
      local_hour: new Date().getHours(),
    });
    setPosting(false);
    if (!error) setMessageText("");
    else window.alert(error.message.toLowerCase());
  }

  return (
    <>
      {showBreadcrumb && (
        <div
          className="px-6 py-2 border-b"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <Link
            href="/cohort"
            className="font-mono lowercase text-[0.7rem] hover:text-amber transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            ← cohorts
          </Link>
        </div>
      )}
      <div className="flex" style={{ minHeight: "calc(100vh - 96px)" }}>
        {/* LEFT — roster */}
        <aside
          className="border-r flex flex-col"
          style={{ width: 260, background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}
        >
          <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "var(--border-default)" }}>
            <p className="font-mono lowercase text-[0.65rem] text-text-faint">room</p>
            <p className="font-sans lowercase text-text-primary text-base mt-0.5 truncate">
              {roomName.toLowerCase()}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin px-2 py-2">
            {members.map((m) => {
              const f = rosterFlags[m.id];
              const annivToday = f?.anniversary ?? isAnniversary(m.created_at ?? null);
              return (
                <div
                  key={m.id}
                  className="group/roster flex items-center gap-2 px-2 py-2"
                >
                  <div className="relative">
                    <Avatar
                      name={m.full_name}
                      stage={m.stage}
                      username={m.username}
                      size={28}
                      depthRing={!!f?.depthRing}
                      anniversary={annivToday}
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${
                        online.has(m.id) ? "dot-online" : "dot-offline"
                      }`}
                      style={{ border: "1.5px solid var(--card)" }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`font-mono lowercase text-[0.7rem] truncate ${
                          f?.consistencyGhost ? "consistency-ghost" : "text-text-primary"
                        }`}
                      >
                        {m.full_name?.toLowerCase() ?? "—"}
                      </p>
                      {f?.questionResponder && (
                        <span
                          aria-hidden
                          className="shrink-0 rounded-full"
                          style={{
                            width: 5,
                            height: 5,
                            background: "#38bdf8",
                          }}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <StagePill stage={m.stage} />
                      <span className="font-mono lowercase text-[0.55rem] text-amber">
                        +{m.trust_score ?? 0}
                      </span>
                      {typeof f?.tenureDays === "number" && (
                        <span
                          className="font-mono lowercase text-[0.55rem]"
                          style={{ color: "#6e7681" }}
                        >
                          in cohort {f.tenureDays} days
                        </span>
                      )}
                    </div>
                  </div>
                  {isCreator && m.id !== currentUserId && (
                    <button
                      onClick={() => kickMember(m)}
                      title={`remove ${m.full_name?.toLowerCase() ?? "member"}`}
                      aria-label="remove member"
                      className="font-mono text-[0.75rem] px-1 text-text-faint opacity-0 group-hover/roster:opacity-100 hover:text-red-400 transition-all"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div
            className="border-t px-3 py-3 space-y-2"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              onClick={() => setInviteOpen(true)}
              className="btn-primary w-full"
            >
              + invite to cohort
            </button>
            <Link
              href="/cohort/browse"
              className="block w-full text-center font-mono lowercase text-[0.65rem] px-3 py-1.5 border hover:border-amber transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              find a cohort
            </Link>
          </div>
          <FounderAgreements />
          {myCohorts[0]?.id && (
            <div className="px-3 pb-3">
              <LeaveCohortButton cohortId={myCohorts[0].id} />
            </div>
          )}
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
                const f = rosterFlags[m.id];
                return (
                  <div
                    key={m.id}
                    className="shrink-0 p-3 border"
                    style={{
                      width: 240,
                      background: "var(--card-elev)",
                      borderColor: hasCheckin
                        ? "rgba(245, 158, 11,0.35)"
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
                          depthRing={!!f?.depthRing}
                          anniversary={f?.anniversary ?? isAnniversary(m.created_at ?? null)}
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
                          style={{ color: "#6e7681" }}
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

          {/* ZONE 2 — Discussion floor (group chat) */}
          <section className="flex-1 px-6 py-5 discussion-floor">
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono lowercase text-[0.7rem] text-text-faint tracking-wider">
                discussion_floor
              </p>
              <button onClick={() => setPostOpen(true)} className="btn-primary">
                + post to room
              </button>
            </div>

            <div className="bubbles-container max-w-3xl">
              {chronological.length === 0 && (
                <div className="empty-panel my-4">
                  <span className="empty-panel-glyph" aria-hidden>◌</span>
                  <p className="empty-panel-title">the room is quiet.</p>
                  <p className="empty-panel-sub">
                    this is your private floor — no performance, no audience. open the conversation.
                  </p>
                </div>
              )}
              {chronological.map((p, index) => {
                const isMine = p.author_id === currentUserId;
                const isAnon = p.is_anonymous;
                const ts = p.room_type ? TYPE_STYLE[p.room_type] : null;
                const tagColor = p.tag ? TAG_COLOR[p.tag] ?? "#6e7681" : null;
                const authorFlags = p.author_id ? rosterFlags[p.author_id] : null;
                const author = isMine ? me : p.author;
                const showDateSep =
                  index === 0 ||
                  isDifferentDay(
                    chronological[index - 1].created_at,
                    p.created_at,
                  );
                return (
                  <div key={p.id}>
                    {showDateSep && (
                      <div className="date-separator">
                        <span>{formatDate(p.created_at)}</span>
                      </div>
                    )}
                    <div className={`bubble-row ${isMine ? "mine" : "theirs"}`}>
                      {!isMine && (
                        <div className="bubble-avatar-wrap">
                          {isAnon ? (
                            <div
                              className="flex items-center justify-center font-mono text-[0.55rem] lowercase"
                              style={{
                                width: 30,
                                height: 30,
                                background: "var(--card)",
                                color: "var(--text-faint)",
                                borderRadius: "50%",
                              }}
                            >
                              ??
                            </div>
                          ) : (
                            <Avatar
                              name={author?.full_name}
                              stage={author?.stage}
                              username={author?.username}
                              size={30}
                              depthRing={!!authorFlags?.depthRing}
                              anniversary={
                                authorFlags?.anniversary ??
                                isAnniversary(author?.created_at ?? null)
                              }
                            />
                          )}
                          {!isAnon && p.author_id && online.has(p.author_id) && (
                            <span aria-hidden className="presence-dot" />
                          )}
                        </div>
                      )}

                      <div className="bubble-content-wrap relative group">
                        {!isMine && (
                          <div className="bubble-meta-top">
                            {isAnon ? (
                              <span className="bubble-name anon">anonymous</span>
                            ) : (
                              <>
                                <span className="bubble-name">
                                  {author?.full_name?.toLowerCase() ?? "—"}
                                </span>
                                <StagePill stage={author?.stage ?? null} />
                              </>
                            )}
                          </div>
                        )}

                        {isMine && (
                          <div className="absolute right-0 -top-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <PostMenu
                              postId={p.id}
                              canDelete
                              onDeleted={() =>
                                setPosts((prev) =>
                                  prev.filter((x) => x.id !== p.id),
                                )
                              }
                            />
                          </div>
                        )}

                        <div
                          className={`bubble ${isMine ? "bubble-mine" : "bubble-theirs"}${isAnon ? " bubble-anon" : ""}`}
                        >
                          <p className="bubble-text">{p.content}</p>
                          <div className="bubble-footer">
                            <span className="bubble-time">
                              {timeAgo(p.created_at)} ago
                            </span>
                            {ts && (
                              <span
                                className="bubble-tag"
                                style={{ color: ts.color }}
                              >
                                {ts.label}
                              </span>
                            )}
                            {p.tag && tagColor && (
                              <span
                                className="bubble-tag"
                                style={{ color: tagColor }}
                              >
                                {p.tag}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isMine && (
                        <div className="bubble-avatar-wrap">
                          <Avatar
                            name={me?.full_name}
                            stage={me?.stage}
                            username={me?.username}
                            size={30}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Quick message input — structured posts still use "+ post to room" */}
            <div className="cohort-input-bar max-w-3xl">
              <Avatar name={me?.full_name} stage={me?.stage} size={28} />
              <textarea
                className="cohort-message-input"
                placeholder="message the room..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePost();
                  }
                }}
                rows={1}
              />
              <button
                className="cohort-send-btn"
                onClick={handlePost}
                disabled={!messageText.trim() || posting}
              >
                →
              </button>
            </div>
          </section>
        </div>
      </div>

      {postOpen && (
        <RoomPostModal
          userId={currentUserId}
          cohortId={cohortId}
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
