"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PersonAvatar from "@/components/ui/PersonAvatar";
import ui from "@/components/ui/sleek.module.css";
import RoomThread, { type AuthorMeta } from "@/components/rooms/RoomThread";
import { TeamBadge } from "@/components/hackathon/TeamStyle";
import { realtimeDb, sprintDb } from "@/lib/hackathons/actions";
import { approxServerNow } from "@/lib/useServerNow";
import { LOBBY_MAX_LENGTH } from "@/lib/hackathons/lobby";

// The Sprint lobby (Phase 7): one chat for everyone in the Sprint, built on
// the room thread (components/rooms). Each message shows its author's avatar
// and a tag (their team, Judge or Admin); milestone messages from the
// database are drawn as amber banners; the welcome note and pinned messages
// sit on top. Admins pin, unpin and delete right here (logged, migration 029).
//
// Live over realtime, on a connection signed in as the member (realtimeDb).
// The page refreshes itself an hour before the deadline and when the lobby
// closes, so the server posts "1 hour left" on time and the composer locks;
// SprintAutoRefresh covers the other milestones.

export type LobbyMessageRow = {
  id: string;
  user_id: string | null;
  body: string;
  is_system: boolean;
  is_pinned: boolean;
  system_key: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type LobbyPerson = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  stage: string | null;
  team_name: string | null;
  team_emblem: string | null;
  team_color: string | null;
  role: "participant" | "judge" | "admin" | null;
};

const COLUMNS = "id, user_id, body, is_system, is_pinned, system_key, created_at, deleted_at";

function upsert(list: LobbyMessageRow[], row: LobbyMessageRow) {
  const i = list.findIndex((m) => m.id === row.id);
  if (i === -1) return [...list, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
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

export default function LobbyClient({
  sprint,
  initialMessages,
  welcome,
  initialPeople,
  viewerId,
  isAdmin,
  closedReason,
}: {
  sprint: { id: string; number: number; endsAt: string | null; lobbyClosesAt: string | null; frozen: boolean };
  initialMessages: LobbyMessageRow[];
  welcome: string | null;
  initialPeople: LobbyPerson[];
  viewerId: string;
  isAdmin: boolean;
  closedReason: string | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [people, setPeople] = useState(() => new Map(initialPeople.map((p) => [p.user_id, p])));
  const [notice, setNotice] = useState<string | null>(null);

  // A fresh read from the server (a refresh at a milestone) replaces ours.
  useEffect(() => setMessages(initialMessages), [initialMessages]);
  useEffect(() => setPeople(new Map(initialPeople.map((p) => [p.user_id, p]))), [initialPeople]);

  const peopleRef = useRef(people);
  peopleRef.current = people;
  const routerRef = useRef(router);
  routerRef.current = router;

  async function reloadPeople() {
    const { data } = await sprintDb().rpc("hackathon_lobby_people", { p_hackathon_id: sprint.id });
    if (data) setPeople(new Map((data as LobbyPerson[]).map((p) => [p.user_id, p])));
  }

  // Realtime: new messages, pins and deletions.
  useEffect(() => {
    let stopped = false;
    let cleanup = () => {};
    (async () => {
      const db = await realtimeDb();
      if (stopped) return;
      const channel = db
        .channel(`lobby-${sprint.id}`)
        .on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table: "hackathon_lobby_messages", filter: `hackathon_id=eq.${sprint.id}` },
          (p: { eventType: string; new: LobbyMessageRow }) => {
            if (p.eventType === "DELETE") return;
            setMessages((list) => upsert(list, p.new));
            if (p.new.user_id && !peopleRef.current.has(p.new.user_id)) void reloadPeople();
          },
        )
        .subscribe();
      // A milestone withdrawn because an admin moved the time (migration 029).
      // Deletions can't be filtered by Sprint; they carry only the id.
      const withdrawn = db
        .channel(`lobby-del-${sprint.id}`)
        .on(
          "postgres_changes" as any,
          { event: "DELETE", schema: "public", table: "hackathon_lobby_messages" },
          (p: { old: { id?: string } }) => {
            const id = p.old?.id;
            if (id) setMessages((list) => list.filter((m) => m.id !== id));
          },
        )
        .subscribe();
      cleanup = () => {
        db.removeChannel(channel);
        db.removeChannel(withdrawn);
      };
    })();
    return () => {
      stopped = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprint.id]);

  // Refresh at the moments the phase boundaries don't cover: an hour before
  // the deadline ("1 hour left") and when the lobby closes.
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
          ? "The lobby is read-only for you now, so that wasn't sent."
          : error?.message ?? "That didn't send. Try again.",
      );
      return false;
    }
    setMessages((list) => upsert(list, data as LobbyMessageRow));
    if (!peopleRef.current.has(viewerId)) void reloadPeople();
    return true;
  }

  async function moderate(m: LobbyMessageRow, change: { is_pinned?: boolean; deleted_at?: string }) {
    setNotice(null);
    if (change.deleted_at && !window.confirm("Delete this message for everyone?")) return;
    const { data, error } = await sprintDb().from("hackathon_lobby_messages").update(change).eq("id", m.id).select(COLUMNS).single();
    if (error || !data) setNotice(error?.message ?? "That didn't work.");
    else setMessages((list) => upsert(list, data as LobbyMessageRow));
  }

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
    return {
      avatar: <PersonAvatar name={p?.full_name} stage={p?.stage} username={p?.username} size={28} />,
      tag,
    };
  };

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const pinned = messages.filter((m) => m.is_pinned && !m.deleted_at);

  return (
    <div className="space-y-3">
      {(welcome || pinned.length > 0) && (
        <div
          className="space-y-2"
          style={{
            border: "1px solid rgba(245, 158, 11, 0.3)",
            background: "linear-gradient(150deg, rgba(245, 158, 11, 0.09), rgba(245, 158, 11, 0.02) 70%)",
            borderRadius: 12,
            padding: "12px 16px",
          }}
        >
          <p style={{ fontSize: 11.5, color: "#f8c56a", fontWeight: 500 }}>Pinned</p>
          {welcome && (
            <p className="whitespace-pre-wrap" style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.55 }}>
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

      <RoomThread
        messages={messages.map((m) => ({
          id: m.id,
          authorId: m.user_id,
          body: m.body,
          isSystem: m.is_system,
          createdAt: m.created_at,
          deleted: Boolean(m.deleted_at),
          highlight: m.is_system,
          pinned: m.is_pinned && !m.deleted_at,
        }))}
        currentUserId={viewerId}
        nameOf={nameOf}
        authorMeta={authorMeta}
        maxLength={LOBBY_MAX_LENGTH}
        placeholder="Message everyone in the Sprint…"
        onSend={send}
        actions={
          isAdmin
            ? (rm) => {
                const m = byId.get(rm.id);
                if (!m || m.deleted_at) return null;
                return (
                  <>
                    <button
                      type="button"
                      className={ui.textBtn}
                      style={{ fontSize: 11.5 }}
                      onClick={() => moderate(m, { is_pinned: !m.is_pinned })}
                    >
                      {m.is_pinned ? "Unpin" : "Pin"}
                    </button>
                    {!m.is_system && (
                      <button
                        type="button"
                        className={`${ui.textBtn} hover:!text-red-400`}
                        style={{ fontSize: 11.5 }}
                        onClick={() => moderate(m, { deleted_at: new Date().toISOString() })}
                      >
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
          closedReason ? (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", borderTop: "1px solid rgba(255, 255, 255, 0.06)", padding: "14px 16px" }}>
              {closedReason}
            </p>
          ) : undefined
        }
      />
    </div>
  );
}
