"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PersonAvatar from "@/components/ui/PersonAvatar";
import ui from "@/components/ui/sleek.module.css";
import { TeamBadge } from "@/components/hackathon/TeamStyle";
import { realtimeDb, sprintDb } from "@/lib/hackathons/actions";
import { approxServerNow } from "@/lib/useServerNow";
import { LOBBY_MAX_LENGTH } from "@/lib/hackathons/lobby";
import RoomThread, { type AuthorMeta, type RoomMessage } from "@/components/rooms/RoomThread";
import { useStage } from "./LiveStage";
import stageCss from "./liveStage.module.css";
import { sayBuildathon } from "@/lib/hackathons/defaults";

// The Sprint chat (was the lobby page, Phase 7; on the Sprint page since
// migration 034): one text-message thread for everyone in the Sprint, drawn
// with the rooms' chat (components/rooms/RoomThread, unchanged), with the
// Sprint's own moments in it: the milestones the database posts (kickoff,
// halfway, one hour left…) and each team's submission, taken from the public
// pulse (027), so nothing sealed leaks.
//
// Every active member reads it; the database decides who posts
// (private.can_write_lobby). Live over realtime, on a connection signed in as
// the member (realtimeDb). Admins pin, unpin and delete here (logged, 029).
// The page refreshes itself an hour before the deadline and when the feed
// closes, so "1 hour left" lands on time and the composer locks.

export type FeedMessageRow = {
  id: string;
  user_id: string | null;
  body: string;
  is_system: boolean;
  is_pinned: boolean;
  system_key: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type FeedPerson = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  stage: string | null;
  team_name: string | null;
  team_emblem: string | null;
  team_color: string | null;
  role: "participant" | "judge" | "admin" | null;
};

/** A team's submission, as a moment in the feed. */
export type FeedSubmission = { teamId: string; name: string; emblem: string | null; color: string | null; at: string };

const COLUMNS = "id, user_id, body, is_system, is_pinned, system_key, created_at, deleted_at";


function upsert(list: FeedMessageRow[], row: FeedMessageRow) {
  const i = list.findIndex((m) => m.id === row.id);
  if (i === -1) return [...list, row];
  const next = list.slice();
  next[i] = { ...list[i], ...row };
  return next;
}

function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        fontSize: 10.5,
        lineHeight: 1.4,
        padding: "1px 7px",
        borderRadius: 999,
        border: `1px solid ${color ? `${color}55` : "rgba(255, 255, 255, 0.12)"}`,
        background: color ? `${color}14` : "rgba(255, 255, 255, 0.04)",
        color: color ?? "var(--text-muted)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export default function SprintFeed({
  sprint,
  initialMessages,
  initialSubmissions,
  welcome,
  initialPeople,
  viewerId,
  isAdmin,
  canPost,
  closedReason,
}: {
  sprint: { id: string; number: number; endsAt: string | null; lobbyClosesAt: string | null; frozen: boolean };
  initialMessages: FeedMessageRow[];
  initialSubmissions: FeedSubmission[];
  welcome: string | null;
  initialPeople: FeedPerson[];
  viewerId: string;
  isAdmin: boolean;
  /** Participants, accepted judges and admins (the database decides; this only shows the composer). */
  canPost: boolean;
  /** Why someone who could post can't any more (closed, cancelled, lapsed). */
  closedReason: string | null;
}) {
  const router = useRouter();
  // On the live page the chat sits in the stage's drawer (LiveStage).
  const stage = useStage();
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const [messages, setMessages] = useState(initialMessages);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [people, setPeople] = useState(() => new Map(initialPeople.map((p) => [p.user_id, p])));
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // A fresh read from the server (a refresh at a milestone) replaces ours.
  useEffect(() => setMessages(initialMessages), [initialMessages]);
  useEffect(() => setSubmissions(initialSubmissions), [initialSubmissions]);
  useEffect(() => setPeople(new Map(initialPeople.map((p) => [p.user_id, p]))), [initialPeople]);
  // "3 min ago" stays true.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const peopleRef = useRef(people);
  peopleRef.current = people;
  const submittedRef = useRef(new Set(submissions.map((x) => x.teamId)));
  submittedRef.current = new Set(submissions.map((x) => x.teamId));
  const routerRef = useRef(router);
  routerRef.current = router;

  async function reloadPeople() {
    const { data } = await sprintDb().rpc("hackathon_lobby_people", { p_hackathon_id: sprint.id });
    if (data) setPeople(new Map((data as FeedPerson[]).map((p) => [p.user_id, p])));
  }

  // Realtime: new posts, pins and deletions, and teams submitting.
  useEffect(() => {
    let stopped = false;
    let cleanup = () => {};
    (async () => {
      const db = await realtimeDb();
      if (stopped) return;
      const posts = db
        .channel(`feed-${sprint.id}`)
        .on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table: "hackathon_lobby_messages", filter: `hackathon_id=eq.${sprint.id}` },
          (p: { eventType: string; new: FeedMessageRow }) => {
            if (p.eventType === "DELETE") return;
            if (p.eventType === "INSERT" && p.new.user_id && p.new.user_id !== viewerId) stageRef.current?.onIncoming();
            setMessages((list) => upsert(list, p.new));
            if (p.new.user_id && !peopleRef.current.has(p.new.user_id)) void reloadPeople();
          },
        )
        .subscribe();
      // A milestone withdrawn because an admin moved the time (029). Deletions
      // can't be filtered by Sprint; they carry only the id.
      const withdrawn = db
        .channel(`feed-del-${sprint.id}`)
        .on(
          "postgres_changes" as any,
          { event: "DELETE", schema: "public", table: "hackathon_lobby_messages" },
          (p: { old: { id?: string } }) => {
            const id = p.old?.id;
            if (id) setMessages((list) => list.filter((m) => m.id !== id));
          },
        )
        .subscribe();
      // A team submitting: the pulse row turns has_submitted. Unknown teams
      // (formed after this page loaded) come in with the next refresh.
      const pulse = db
        .channel(`feed-pulse-${sprint.id}`)
        .on(
          "postgres_changes" as any,
          { event: "UPDATE", schema: "public", table: "hackathon_team_pulse", filter: `hackathon_id=eq.${sprint.id}` },
          (p: { new: { team_id: string; has_submitted: boolean; submitted_at: string | null } }) => {
            if (!p.new.has_submitted || submittedRef.current.has(p.new.team_id)) return;
            submittedRef.current.add(p.new.team_id);
            routerRef.current.refresh();
          },
        )
        .subscribe();
      cleanup = () => {
        db.removeChannel(posts);
        db.removeChannel(withdrawn);
        db.removeChannel(pulse);
      };
    })();
    return () => {
      stopped = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprint.id]);

  // Refresh at the moments the phase boundaries don't cover: an hour before
  // the deadline ("1 hour left") and when the feed closes.
  useEffect(() => {
    if (sprint.frozen) return;
    const now = approxServerNow();
    const moments = [
      sprint.endsAt ? Date.parse(sprint.endsAt) - 3_600_000 : null,
      sprint.lobbyClosesAt ? Date.parse(sprint.lobbyClosesAt) : null,
    ].filter((t): t is number => t !== null && t > now && t - now < 2_147_000_000);
    const timers = moments.map((t) => setTimeout(() => routerRef.current.refresh(), t - now + 500));
    return () => timers.forEach(clearTimeout);
  }, [sprint.endsAt, sprint.lobbyClosesAt, sprint.frozen]);

  async function send(text: string) {
    setNotice(null);
    const { data, error } = await sprintDb()
      .from("hackathon_lobby_messages")
      .insert({ hackathon_id: sprint.id, user_id: viewerId, body: text })
      .select(COLUMNS)
      .single();
    if (error || !data) {
      setNotice(
        error?.code === "42501" || /row-level security/i.test(error?.message ?? "")
          ? "The chat is read-only for you now, so that wasn't sent."
          : error?.message ?? "That didn't send. Try again.",
      );
      return false;
    }
    setMessages((list) => upsert(list, data as FeedMessageRow));
    if (!peopleRef.current.has(viewerId)) void reloadPeople();
    return true;
  }

  async function moderate(m: FeedMessageRow, change: { is_pinned?: boolean; deleted_at?: string }) {
    setNotice(null);
    setConfirmDelete(null);
    const { data, error } = await sprintDb().from("hackathon_lobby_messages").update(change).eq("id", m.id).select(COLUMNS).single();
    if (error || !data) setNotice(error?.message ?? "That didn't work.");
    else setMessages((list) => upsert(list, data as FeedMessageRow));
  }

  // One conversation, oldest first like a text thread: posts as bubbles
  // (yours on the right), milestones as amber banners, submissions as quiet
  // centred lines. Built on the rooms' thread (components/rooms), unchanged.
  const thread: RoomMessage[] = useMemo(() => {
    const list: RoomMessage[] = [
      ...messages.map((m) => ({
        id: m.id,
        authorId: m.user_id,
        body: m.is_system ? sayBuildathon(m.body) : m.body,
        isSystem: m.is_system,
        createdAt: m.created_at,
        deleted: Boolean(m.deleted_at),
        highlight: m.is_system,
        pinned: m.is_pinned && !m.deleted_at,
      })),
      ...submissions.map((x) => ({
        id: `submitted-${x.teamId}`,
        authorId: null,
        body: `✓ ${x.name} submitted their project`,
        isSystem: true,
        createdAt: x.at,
      })),
    ];
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [messages, submissions]);

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const pinned = messages.filter((m) => m.is_pinned && !m.deleted_at);
  const nameOf = (id: string) => {
    const p = people.get(id);
    return p ? p.full_name ?? p.username ?? "Founder" : null;
  };
  const authorMeta = (id: string): AuthorMeta | null => {
    const p = people.get(id);
    const tag =
      p?.role === "admin" ? (
        <Tag color="#f8c56a">Admin</Tag>
      ) : p?.role === "judge" ? (
        <Tag color="#a78bfa">Judge</Tag>
      ) : p?.team_name ? (
        <Tag color={p.team_color ?? undefined}>
          <TeamBadge name={p.team_name} emblem={p.team_emblem} color={p.team_color} size={12} />
          {p.team_name}
        </Tag>
      ) : null;
    return { avatar: <PersonAvatar name={p?.full_name} stage={p?.stage} username={p?.username} size={28} />, tag };
  };

  const footer = closedReason ?? (canPost ? null : "You're following along. Participants, judges and admins post here.");

  return (
    <section
      id="feed"
      aria-label="Buildathon chat"
      style={stage?.inDrawer ? { scrollMarginTop: 80, display: "flex", flexDirection: "column", height: "100%" } : { scrollMarginTop: 80, marginBottom: 16 }}
    >
      <div className="flex items-center justify-between gap-3" style={{ marginBottom: 10, minHeight: 28 }}>
        <span className="flex items-baseline gap-3 min-w-0">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>Buildathon chat</h2>
          <span className="truncate" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Everyone in Buildathon #{sprint.number}, live
          </span>
        </span>
        {stage?.controls}
      </div>

      {(welcome || pinned.length > 0) && (
        <div
          className="space-y-2"
          style={{
            border: "1px solid rgba(245, 158, 11, 0.3)",
            background: "linear-gradient(150deg, rgba(245, 158, 11, 0.09), rgba(245, 158, 11, 0.02) 70%)",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 10,
          }}
        >
          <p style={{ fontSize: 11.5, color: "#f8c56a", fontWeight: 500 }}>Pinned</p>
          {welcome && (
            <p
              className="whitespace-pre-wrap"
              style={{
                fontSize: 13.5,
                color: "var(--text-primary)",
                lineHeight: 1.55,
                // In the drawer the note stays short, so the chat keeps the room.
                ...(stage?.inDrawer ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" } : {}),
              }}
              title={stage?.inDrawer ? welcome : undefined}
            >
              {welcome}
            </p>
          )}
          {pinned.map((m) => (
            <p key={m.id} className="whitespace-pre-wrap" style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              {m.user_id ? <span style={{ color: "var(--text-primary)" }}>{nameOf(m.user_id) ?? "Someone"}: </span> : null}
              {m.body}
            </p>
          ))}
        </div>
      )}

      <div className={stage?.inDrawer ? stageCss.fill : undefined}>
      <RoomThread
        messages={thread}
        currentUserId={viewerId}
        nameOf={nameOf}
        authorMeta={authorMeta}
        maxLength={LOBBY_MAX_LENGTH}
        placeholder="Message everyone in the Buildathon… (no spoilers: projects stay sealed)"
        onSend={send}
        actions={
          isAdmin
            ? (rm) => {
                const m = byId.get(rm.id);
                if (!m || m.deleted_at || m.is_system) return null;
                return (
                  <>
                    <button type="button" className={ui.textBtn} style={{ fontSize: 11.5 }} onClick={() => moderate(m, { is_pinned: !m.is_pinned })}>
                      {m.is_pinned ? "Unpin" : "Pin"}
                    </button>
                    {confirmDelete === m.id ? (
                      <>
                        <button
                          type="button"
                          className={ui.textBtn}
                          style={{ fontSize: 11.5, color: "#f87171" }}
                          onClick={() => moderate(m, { deleted_at: new Date().toISOString() })}
                        >
                          Remove for everyone
                        </button>
                        <button type="button" className={ui.textBtn} style={{ fontSize: 11.5 }} onClick={() => setConfirmDelete(null)}>
                          Keep
                        </button>
                      </>
                    ) : (
                      <button type="button" className={`${ui.textBtn} hover:!text-red-400`} style={{ fontSize: 11.5 }} onClick={() => setConfirmDelete(m.id)}>
                        Delete
                      </button>
                    )}
                  </>
                );
              }
            : undefined
        }
        notice={notice ? <p style={{ fontSize: 12, color: "#f87171", padding: "8px 14px 0" }}>{notice}</p> : undefined}
        closed={
          footer ? (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", borderTop: "1px solid rgba(255, 255, 255, 0.06)", padding: "14px 16px" }}>{footer}</p>
          ) : undefined
        }
      />
      </div>
    </section>
  );
}
