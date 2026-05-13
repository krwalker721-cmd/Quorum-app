"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/stage";

type Partner = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
};

type Conversation = {
  partner: Partner;
  last: string | null;
  lastAt: string | null;
  unread: boolean;
};

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
};

export default function MessagesClient({
  currentUserId,
  conversations: initialConversations,
  initialPartnerId,
}: {
  currentUserId: string;
  conversations: Conversation[];
  initialPartnerId: string | null;
}) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPartnerId ?? initialConversations[0]?.partner.id ?? null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => createClient(), []);
  const selected =
    conversations.find((c) => c.partner.id === selectedId)?.partner ?? null;

  // Ensure selected partner exists in convo list (deep-link from profile)
  useEffect(() => {
    if (!selectedId) return;
    if (conversations.some((c) => c.partner.id === selectedId)) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, stage, username")
        .eq("id", selectedId)
        .single();
      if (data) {
        setConversations((prev) => [
          { partner: data as Partner, last: null, lastAt: null, unread: false },
          ...prev,
        ]);
      }
    })();
  }, [supabase, selectedId, conversations]);

  // Load thread + subscribe
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

      // mark unread as read
      await supabase
        .from("messages")
        .update({ read: true })
        .eq("sender_id", selectedId)
        .eq("recipient_id", currentUserId)
        .eq("read", false);

      setConversations((prev) =>
        prev.map((c) =>
          c.partner.id === selectedId ? { ...c, unread: false } : c
        )
      );
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
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  async function send() {
    if (!draft.trim() || !selectedId) return;
    setSending(true);
    const content = draft.trim();
    setDraft("");
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: currentUserId,
        recipient_id: selectedId,
        content,
        created_at: new Date().toISOString(),
      },
    ]);
    const { error } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      recipient_id: selectedId,
      content,
    });
    setSending(false);
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(content);
      return;
    }
    // fire-and-forget: maybe award the "connector" to whoever introduced us
    fetch("/api/recognition/dm-sent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient_id: selectedId }),
    }).catch(() => {});
    // bump preview
    setConversations((prev) => {
      const copy = [...prev];
      const idx = copy.findIndex((c) => c.partner.id === selectedId);
      if (idx >= 0) {
        const [row] = copy.splice(idx, 1);
        copy.unshift({ ...row, last: content, lastAt: new Date().toISOString() });
      }
      return copy;
    });
  }

  return (
    <div className="flex" style={{ height: "calc(100vh - 56px)" }}>
      {/* LEFT — inbox */}
      <div
        className="flex flex-col border-r"
        style={{ width: 320, background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="px-4 pt-4 pb-2">
          <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider">
            inbox
          </p>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin">
          {conversations.length === 0 && (
            <div className="px-4 py-6">
              <p className="font-mono lowercase text-[0.7rem] text-text-faint leading-relaxed">
                no messages yet — start a conversation from someone&apos;s profile.
              </p>
            </div>
          )}
          {conversations.map((c) => {
            const active = c.partner.id === selectedId;
            return (
              <button
                key={c.partner.id}
                onClick={() => setSelectedId(c.partner.id)}
                className="w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-b"
                style={{
                  background: active ? "rgba(245,158,11,0.06)" : "transparent",
                  borderRight: active ? "2px solid #f59e0b" : "2px solid transparent",
                  borderColor: "var(--border)",
                }}
              >
                <Avatar
                  name={c.partner.full_name}
                  stage={c.partner.stage}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 justify-between">
                    <p className="font-mono lowercase text-[0.75rem] text-text-primary truncate">
                      {c.partner.full_name?.toLowerCase() ?? "—"}
                    </p>
                    {c.lastAt && (
                      <span className="font-mono lowercase text-[0.55rem] text-text-faint shrink-0">
                        {timeAgo(c.lastAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StagePill stage={c.partner.stage} />
                    {c.unread && (
                      <span
                        className="ml-auto w-2 h-2 rounded-full"
                        style={{ background: "#f59e0b" }}
                      />
                    )}
                  </div>
                  {c.last && (
                    <p className="font-mono lowercase text-[0.65rem] text-text-muted truncate mt-1">
                      {c.last}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT — thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div
              className="flex items-center justify-between px-6 py-3 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  name={selected.full_name}
                  stage={selected.stage}
                  username={selected.username}
                  size={32}
                />
                <div className="min-w-0">
                  <p className="font-mono lowercase text-sm text-text-primary truncate">
                    {selected.full_name?.toLowerCase() ?? "—"}
                  </p>
                  <div className="mt-0.5">
                    <StagePill stage={selected.stage} />
                  </div>
                </div>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto scroll-thin px-6 py-6 space-y-3"
            >
              {messages.length === 0 && (
                <p className="font-mono lowercase text-[0.7rem] text-text-faint text-center mt-12">
                  no messages yet. say hi.
                </p>
              )}
              {messages.map((m) => {
                const mine = m.sender_id === currentUserId;
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[70%]">
                      <div
                        className="px-3 py-2"
                        style={{
                          background: mine
                            ? "rgba(245,158,11,0.12)"
                            : "var(--card-elev)",
                          border: `1px solid ${
                            mine ? "rgba(245,158,11,0.35)" : "var(--border)"
                          }`,
                          color: "var(--text-primary)",
                        }}
                      >
                        <p className="text-[0.88rem] leading-relaxed whitespace-pre-wrap">
                          {m.content}
                        </p>
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

            <div
              className="border-t px-6 py-3 flex items-center gap-3"
              style={{ borderColor: "var(--border)" }}
            >
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
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="font-mono lowercase text-xs text-text-faint text-center">
              no messages yet — start a conversation from someone&apos;s profile.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
