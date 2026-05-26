"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PulseEvent = {
  id: string;
  ts: string;
  username: string;
  text: string; // text after username, e.g. "posted a new project"
  projectName?: string | null;
};

type Profile = { id: string; username: string | null; full_name: string | null };
type ProjectMeta = { id: string; title: string | null; name: string | null };

const FADE_MS = 400;
const HOLD_MS = 4000;
const STALE_MS = 10 * 60 * 1000;

export default function PulseBar({ initialEvents }: { initialEvents: PulseEvent[] }) {
  const [events, setEvents] = useState<PulseEvent[]>(initialEvents);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  const profileCache = useRef<Map<string, Profile>>(new Map());
  const projectCache = useRef<Map<string, ProjectMeta>>(new Map());

  function pushEvent(e: PulseEvent) {
    setEvents((prev) => {
      if (prev.find((x) => x.id === e.id)) return prev;
      const next = [e, ...prev].slice(0, 30);
      return next;
    });
  }

  async function resolveProfile(userId: string): Promise<Profile | null> {
    if (!userId) return null;
    const cached = profileCache.current.get(userId);
    if (cached) return cached;
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      profileCache.current.set(userId, data as Profile);
      return data as Profile;
    }
    return null;
  }

  async function resolveProject(projectId: string): Promise<ProjectMeta | null> {
    if (!projectId) return null;
    const cached = projectCache.current.get(projectId);
    if (cached) return cached;
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("id, title, name")
      .eq("id", projectId)
      .maybeSingle();
    if (data) {
      projectCache.current.set(projectId, data as ProjectMeta);
      return data as ProjectMeta;
    }
    return null;
  }

  function nameOf(p: Profile | null, fallback = "someone") {
    if (!p) return fallback;
    return (p.username ?? p.full_name?.toLowerCase() ?? fallback).toLowerCase();
  }

  function projTitle(p: ProjectMeta | null, fallback = "a project") {
    if (!p) return fallback;
    return (p.title ?? p.name ?? fallback).toLowerCase();
  }

  // realtime subscriptions
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel("collab_pulse");

    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "projects" },
      async (payload) => {
        const row = payload.new as any;
        if (!row?.owner_id) return;
        const user = await resolveProfile(row.owner_id);
        const uname = nameOf(user);
        const pType = row.post_type ?? "project";
        if (pType === "need") {
          pushEvent({
            id: `proj-${row.id}`,
            ts: row.created_at ?? new Date().toISOString(),
            username: uname,
            text: "posted a new need",
          });
        } else {
          pushEvent({
            id: `proj-${row.id}`,
            ts: row.created_at ?? new Date().toISOString(),
            username: uname,
            text: "posted a new project",
          });
        }
      }
    );

    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "project_messages" },
      async (payload) => {
        const row = payload.new as any;
        if (row.is_system) return;
        const [user, project] = await Promise.all([
          resolveProfile(row.sender_id),
          resolveProject(row.project_id),
        ]);
        pushEvent({
          id: `msg-${row.id}`,
          ts: row.created_at ?? new Date().toISOString(),
          username: nameOf(user),
          text: "replied in",
          projectName: projTitle(project),
        });
      }
    );

    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "shared_docs" },
      async (payload) => {
        const row = payload.new as any;
        const [user, project] = await Promise.all([
          resolveProfile(row.added_by),
          resolveProject(row.project_id),
        ]);
        pushEvent({
          id: `doc-${row.id}`,
          ts: row.created_at ?? new Date().toISOString(),
          username: nameOf(user),
          text: "added a doc to",
          projectName: projTitle(project),
        });
      }
    );

    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "decisions" },
      async (payload) => {
        const row = payload.new as any;
        const [user, project] = await Promise.all([
          resolveProfile(row.created_by),
          resolveProject(row.project_id),
        ]);
        pushEvent({
          id: `dec-${row.id}`,
          ts: row.created_at ?? new Date().toISOString(),
          username: nameOf(user),
          text: "posted a decision in",
          projectName: projTitle(project),
        });
      }
    );

    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "handshakes" },
      async (payload) => {
        const row = payload.new as any;
        const user = await resolveProfile(row.initiator_id);
        pushEvent({
          id: `hs-${row.id}`,
          ts: row.created_at ?? new Date().toISOString(),
          username: nameOf(user),
          text: "logged a handshake",
        });
      }
    );

    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // cycle visible event
  useEffect(() => {
    if (events.length === 0) return;
    setVisible(true);
    const hold = setTimeout(() => {
      setVisible(false);
      const swap = setTimeout(() => {
        setIdx((i) => (i + 1) % Math.max(1, events.length));
        setVisible(true);
      }, FADE_MS);
      return () => clearTimeout(swap);
    }, HOLD_MS);
    return () => clearTimeout(hold);
  }, [idx, events.length]);

  // when new events arrive, jump to newest
  useEffect(() => {
    if (events.length > 0) setIdx(0);
  }, [events[0]?.id]);

  const current = events[idx] ?? null;
  const stale = useMemo(() => {
    if (!current) return true;
    return Date.now() - new Date(current.ts).getTime() > STALE_MS;
  }, [current]);

  return (
    <div
      className="flex items-center gap-3 px-6"
      style={{
        height: 36,
        background: "var(--card-elev)",
        borderLeft: "2px solid #58a6ff",
        borderBottom: "1px solid var(--border)",
      }}
      aria-live="polite"
    >
      <span
        aria-hidden
        className="inline-block rounded-full"
        style={{
          width: 6,
          height: 6,
          background: "#f59e0b",
          animation: "pulseDot 2s ease-in-out infinite",
        }}
      />
      <p
        className="font-mono lowercase truncate"
        style={{
          fontSize: 10,
          color: "#8b949e",
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      >
        {current && !stale ? (
          <>
            <span style={{ color: "#f59e0b" }}>{current.username}</span>{" "}
            {current.text}
            {current.projectName ? (
              <>
                {" "}
                <span style={{ color: "var(--text-primary)" }}>{current.projectName}</span>
              </>
            ) : null}
          </>
        ) : (
          <span style={{ color: "var(--text-faint)" }}>
            nothing happening right now — start something.
          </span>
        )}
      </p>
      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
