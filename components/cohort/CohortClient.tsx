"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";
import FounderAgreements from "@/components/cohort/FounderAgreements";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/stage";
import { usePresence } from "@/components/PresenceProvider";

export type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
};

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
};

export default function CohortClient({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(members[0]?.id ?? null);
  const online = usePresence();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => createClient(), []);
  const selected = members.find((m) => m.id === selectedId) ?? null;

  // load thread + subscribe
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, content, created_at")
        .or(
          `and(sender_id.eq.${currentUserId},recipient_id.eq.${selectedId}),and(sender_id.eq.${selectedId},recipient_id.eq.${currentUserId})`
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled) setMessages(data ?? []);
    })();

    const channel = supabase
      .channel(`messages:${currentUserId}:${selectedId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const involved =
            (m.sender_id === currentUserId && m.recipient_id === selectedId) ||
            (m.sender_id === selectedId && m.recipient_id === currentUserId);
          if (involved) setMessages((prev) => [...prev, m]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId, selectedId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!draft.trim() || !selectedId) return;
    setSending(true);
    const content = draft.trim();
    setDraft("");
    // optimistic
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, sender_id: currentUserId, recipient_id: selectedId, content, created_at: new Date().toISOString() },
    ]);
    const { error } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      recipient_id: selectedId,
      content,
    });
    setSending(false);
    if (error) {
      // rollback
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(content);
    }
  }

  return (
    <div className="flex" style={{ height: "calc(100vh - 96px)" }}>
      {/* LEFT PANEL */}
      <div
        className="flex flex-col border-r"
        style={{ width: 240, background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="px-4 pt-4 pb-2">
          <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider">cohort_members</p>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin px-2">
          {members.length === 0 && (
            <p className="font-mono lowercase text-[0.65rem] text-text-faint px-2 py-2">no cohort yet.</p>
          )}
          {members.map((m) => {
            const isOnline = online.has(m.id);
            const active = m.id === selectedId;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className="w-full flex items-center gap-2 px-2 py-2 text-left transition-colors"
                style={{
                  background: active ? "rgba(245,158,11,0.06)" : "transparent",
                  borderRight: active ? "2px solid #f59e0b" : "2px solid transparent",
                }}
              >
                <div className="relative">
                  <Avatar name={m.full_name} stage={m.stage} username={m.username} size={28} />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${isOnline ? "dot-online" : "dot-offline"}`}
                    style={{ border: "1.5px solid var(--card)" }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono lowercase text-[0.7rem] text-text-primary truncate">
                    {m.full_name?.toLowerCase() ?? "—"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StagePill stage={m.stage} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <FounderAgreements />
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div
              className="flex items-center justify-between px-6 py-3 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={selected.full_name} stage={selected.stage} username={selected.username} size={32} />
                <div className="min-w-0">
                  <p className="font-mono lowercase text-sm text-text-primary truncate">
                    {selected.full_name?.toLowerCase() ?? "—"}
                  </p>
                  <div className="mt-0.5"><StagePill stage={selected.stage} /></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="font-mono lowercase text-[0.65rem] px-2.5 py-1.5 border"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  view profile
                </button>
                <button
                  className="font-mono lowercase text-[0.65rem] px-2.5 py-1.5"
                  style={{ background: "#f59e0b", color: "#000" }}
                >
                  + handshake
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin px-6 py-6 space-y-3">
              {messages.length === 0 && (
                <p className="font-mono lowercase text-[0.7rem] text-text-faint text-center mt-12">
                  no messages yet. say hi.
                </p>
              )}
              {messages.map((m) => {
                const mine = m.sender_id === currentUserId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[70%]">
                      <div
                        className="px-3 py-2"
                        style={{
                          background: mine ? "rgba(245,158,11,0.12)" : "var(--card-elev)",
                          border: `1px solid ${mine ? "rgba(245,158,11,0.35)" : "var(--border)"}`,
                          color: "var(--text-primary)",
                        }}
                      >
                        <p className="text-[0.88rem] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                      </div>
                      <p
                        className={`font-mono lowercase text-[0.55rem] text-text-faint mt-1 ${
                          mine ? "text-right" : "text-left"
                        }`}
                      >
                        {timeAgo(m.created_at)} ago
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t px-6 py-3 flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
              <input
                placeholder="message..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                onClick={send}
                disabled={sending || !draft.trim()}
                className="font-mono lowercase text-xs px-4 py-2 bg-amber text-black hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
              >
                send
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-mono lowercase text-xs text-text-faint">select a cohort member to start.</p>
          </div>
        )}
      </div>
    </div>
  );
}
