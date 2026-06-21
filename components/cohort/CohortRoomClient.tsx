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
import Meter from "@/components/Meter";
import Link from "next/link";
import { usePaywall } from "@/hooks/usePaywall";
import PaywallModal from "@/components/PaywallModal";
import { useTier } from "@/contexts/TierContext";
import {
  isAnniversary,
  type RosterFlags,
  type MemberRoomStats,
} from "@/lib/recognition";

// Cohort-post usage counter color ramps with how close the user is to the cap.
function usageColor(used: number, limit: number): string {
  if (limit <= 0) return "#f85149";
  const pct = (used / limit) * 100;
  if (pct >= 100) return "#f85149";
  if (pct >= 81) return "#f59e0b";
  if (pct >= 51) return "#8b949e";
  return "#484f58";
}

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
  blocker: { color: "#f85149", label: "blocker" },
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
  myStats,
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
  myStats: MemberRoomStats;
}) {
  const router = useRouter();
  const online = usePresence();
  const { tier, status } = useTier();
  const { paywallState, checkAndGate, closePaywall } = usePaywall();
  // Free-tier (non-trial) cohort-post usage for the counter above the composer.
  const [cohortUsage, setCohortUsage] = useState<{ current: number; limit: number } | null>(null);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [postOpen, setPostOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(true);
  const [statsOpen, setStatsOpen] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [posting, setPosting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => createClient(), []);
  const checkins = checkinByUserJson;
  const authorMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  const showUsageCounter = tier === "free" && status !== "trialing";

  // Pull cohort-post usage for free-tier (non-trial) users only.
  useEffect(() => {
    if (!showUsageCounter) {
      setCohortUsage(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/usage");
        const json = await res.json();
        if (!cancelled) {
          setCohortUsage({
            current: json.usage?.cohort_posts ?? 0,
            limit: json.limits?.cohort_posts ?? 0,
          });
        }
      } catch {
        // ignore — counter simply won't render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showUsageCounter]);

  // Hydrate the status-board collapse state from localStorage (default open).
  useEffect(() => {
    try {
      if (localStorage.getItem("quorum-cohort-status-collapsed") === "1") {
        setStatusOpen(false);
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  function toggleStatus() {
    setStatusOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          "quorum-cohort-status-collapsed",
          next ? "0" : "1",
        );
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }

  // Hydrate the stats-rail collapse state from localStorage (default open).
  useEffect(() => {
    try {
      if (localStorage.getItem("quorum-cohort-stats-collapsed") === "1") {
        setStatsOpen(false);
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  function toggleStats() {
    setStatsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          "quorum-cohort-stats-collapsed",
          next ? "0" : "1",
        );
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }

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
  const myWin = checkins[currentUserId]?.weekly_win ?? null;
  const statRows: [string, string | number][] = [
    ["replies given", myStats.repliesGiven],
    ["handshakes", myStats.handshakes],
    ["moved the room", myStats.movedTheRoom],
    [
      "in cohort",
      myStats.daysInCohort == null ? "—" : `${myStats.daysInCohort} days`,
    ],
  ];

  async function handlePost() {
    const trimmed = messageText.trim();
    if (!trimmed || posting) return;
    // Paywall gate — cohort messages count toward the cohort_posts cap.
    const allowed = await checkAndGate("cohort_posts");
    if (!allowed) return;
    setPosting(true);
    // Server route enforces the cap and increments usage after the insert.
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: trimmed,
        post_type: "cohort",
        cohort_id: cohortId,
        is_anonymous: false,
        local_hour: new Date().getHours(),
      }),
    });
    setPosting(false);
    if (res.ok) {
      setMessageText("");
      setCohortUsage((u) => (u ? { ...u, current: u.current + 1 } : u));
    } else {
      const data = await res.json().catch(() => ({}));
      window.alert((data.error || "failed to post").toLowerCase());
    }
  }

  return (
    <>
      {showBreadcrumb && (
        <div
          className="px-6 border-b flex items-center"
          style={{
            height: "var(--subnav-h, 40px)",
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
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
      <div className={`flex app-pane ${showBreadcrumb ? "with-subnav-2" : "with-subnav"}`}>
        {/* LEFT — roster */}
        <aside
          className="border-r flex flex-col shrink-0"
          style={{
            width: "clamp(210px, 26%, 260px)",
            background: "var(--bg-elevated)",
            borderColor: "var(--border-default)",
          }}
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
            className={`border-b px-6 ${statusOpen ? "py-4" : "py-2.5"}`}
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className={`flex items-center justify-between ${statusOpen ? "mb-3" : ""}`}>
              <button
                onClick={toggleStatus}
                aria-expanded={statusOpen}
                title={statusOpen ? "collapse status board" : "expand status board"}
                className="flex items-center gap-1.5 font-mono lowercase text-[0.65rem] text-text-secondary tracking-wider hover:text-amber transition-colors"
              >
                <span
                  className="inline-block transition-transform"
                  style={{ transform: statusOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                  aria-hidden
                >
                  ›
                </span>
                status_board · this week
                {!statusOpen && (
                  <span className="text-text-disabled ml-1">({members.length})</span>
                )}
              </button>
            </div>
            {statusOpen && (
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
            )}
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

            <div className="bubbles-container max-w-3xl xl:max-w-none">
              {chronological.length === 0 && (
                <div className="empty-panel my-4">
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

            {/* Free-tier usage counter — sits just above the composer. Shows
                once they've made at least one cohort post this month. */}
            {showUsageCounter && cohortUsage && cohortUsage.limit > 0 && cohortUsage.current >= 1 && (
              <div
                className="max-w-3xl xl:max-w-none"
                style={{
                  fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
                  fontSize: 9,
                  color: usageColor(cohortUsage.current, cohortUsage.limit),
                  letterSpacing: "0.05em",
                  padding: "4px 0",
                  textAlign: "right",
                }}
              >
                {cohortUsage.current} / {cohortUsage.limit} cohort posts this month
              </div>
            )}

            {/* Quick message input — structured posts still use "+ post to room" */}
            <div className="cohort-input-bar max-w-3xl xl:max-w-none">
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

        {/* RIGHT — your stats rail. Fills the space beside the chat on wide
            screens; hidden below xl where the chat needs the full width.
            Collapses to a thin strip, mirroring the sidebar. */}
        <aside
          className="hidden xl:flex flex-col shrink-0 border-l overflow-y-auto scroll-thin transition-[width] duration-150"
          style={{
            width: statsOpen ? "clamp(220px, 22%, 280px)" : 44,
            background: "var(--bg-elevated)",
            borderColor: "var(--border-default)",
          }}
        >
          {!statsOpen ? (
            <button
              onClick={toggleStats}
              aria-expanded={false}
              title="expand your stats"
              className="flex flex-col items-center gap-3 pt-3 w-full hover:text-amber transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <span className="text-[0.8rem]" aria-hidden>‹</span>
              <span
                className="font-mono lowercase text-[0.6rem] tracking-wider"
                style={{ writingMode: "vertical-rl" }}
              >
                your_stats
              </span>
            </button>
          ) : (
          <div className="p-4">
            <div
              className="side-widget"
              style={{ "--w-accent": "#22c55e" } as React.CSSProperties}
            >
              <div className="side-widget-head">
                <span className="side-widget-glyph">◆</span>
                <p className="side-widget-label">your_stats</p>
                <button
                  onClick={toggleStats}
                  aria-expanded
                  title="collapse your stats"
                  className="ml-auto font-mono text-[0.8rem] leading-none hover:text-amber transition-colors"
                  style={{ color: "var(--text-faint)" }}
                >
                  ›
                </button>
              </div>

              {/* identity */}
              <div className="flex items-center gap-2.5 mb-4">
                <Avatar
                  name={me?.full_name}
                  stage={me?.stage}
                  username={me?.username}
                  size={36}
                />
                <div className="min-w-0">
                  <p className="font-mono lowercase text-[0.72rem] text-text-primary truncate">
                    {me?.full_name?.toLowerCase() ?? "you"}
                  </p>
                  <div className="mt-1">
                    <StagePill stage={me?.stage ?? null} />
                  </div>
                </div>
              </div>

              {/* trust */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono lowercase text-[0.6rem] text-text-faint tracking-wider">
                    trust
                  </span>
                  <span className="font-mono text-[0.7rem] text-text-secondary">
                    {myStats.trustScore}
                    <span className="text-text-faint"> / 120</span>
                  </span>
                </div>
                <Meter value={myStats.trustScore} max={120} />
              </div>

              {/* hero tiles */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div
                  className="p-2.5"
                  style={{
                    background: "var(--card-elev)",
                    borderRadius: "var(--radius-ctl)",
                  }}
                >
                  <p className="font-mono lowercase text-[0.55rem] text-text-faint">
                    streak
                  </p>
                  <p className="text-text-primary text-lg leading-tight mt-0.5">
                    {myStats.streakWeeks}
                    <span className="text-[0.6rem] text-text-faint"> wks</span>
                  </p>
                </div>
                <div
                  className="p-2.5"
                  style={{
                    background: "var(--card-elev)",
                    borderRadius: "var(--radius-ctl)",
                  }}
                >
                  <p className="font-mono lowercase text-[0.55rem] text-text-faint">
                    posts this week
                  </p>
                  <p className="text-text-primary text-lg leading-tight mt-0.5">
                    {myStats.postsThisWeek}
                  </p>
                </div>
              </div>

              {/* stat list */}
              <div>
                {statRows.map(([label, value], i) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-2 font-mono lowercase"
                    style={{
                      borderBottom:
                        i < statRows.length - 1
                          ? "1px solid var(--border-default)"
                          : "none",
                    }}
                  >
                    <span className="text-[0.68rem] text-text-secondary">
                      {label}
                    </span>
                    <span className="text-[0.72rem] text-text-primary">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* this week's win — only when the viewer has checked in */}
              {myWin && (
                <div
                  className="mt-4 pt-3"
                  style={{ borderTop: "1px solid var(--border-default)" }}
                >
                  <p className="font-mono lowercase text-[0.55rem] text-text-faint mb-1">
                    this week&apos;s win
                  </p>
                  <p className="text-[0.72rem] text-text-secondary leading-snug">
                    {myWin}
                  </p>
                </div>
              )}
            </div>
          </div>
          )}
        </aside>
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
      {paywallState.isOpen && (
        <PaywallModal
          isOpen={paywallState.isOpen}
          onClose={closePaywall}
          feature={paywallState.feature!}
          currentUsage={paywallState.currentUsage}
          limit={paywallState.limit}
          hadTrial={paywallState.hadTrial}
        />
      )}
    </>
  );
}
