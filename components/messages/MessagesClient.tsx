"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/stage";
import { usePaywall } from "@/hooks/usePaywall";
import PaywallModal from "@/components/PaywallModal";

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
  const { paywallState, checkAndGate, closePaywall } = usePaywall();
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPartnerId ?? initialConversations[0]?.partner.id ?? null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Partner[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const supabase = useMemo(() => createClient(), []);
  const selected =
    conversations.find((c) => c.partner.id === selectedId)?.partner ?? null;

  // Founder search — debounced lookup against profiles
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const t = setTimeout(async () => {
      const like = `%${q}%`;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, stage, username")
        .or(`username.ilike.${like},full_name.ilike.${like}`)
        .eq("status", "approved")
        .neq("id", currentUserId)
        .limit(8);
      if (!cancelled) {
        setSearchResults((data ?? []) as Partner[]);
        setSearchLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQuery, supabase, currentUserId]);

  function openConversationWith(p: Partner) {
    setConversations((prev) => {
      if (prev.some((c) => c.partner.id === p.id)) return prev;
      return [
        { partner: p, last: null, lastAt: null, unread: false },
        ...prev,
      ];
    });
    setSelectedId(p.id);
    setSearchQuery("");
    setSearchResults([]);
  }

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
    // Paywall gate — DMs are capped on free tier. Check before sending.
    const allowed = await checkAndGate("messages");
    if (!allowed) return;
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
    // Track usage after a successful send (free tier only).
    fetch("/api/usage/increment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature: "messages" }),
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
    <div className="flex app-pane">
      {/* LEFT — inbox */}
      <div
        className="flex flex-col border-r shrink-0"
        style={{
          width: "clamp(230px, 30%, 320px)",
          background: "var(--bg-elevated)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="px-4 pt-4 pb-2">
          <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider">
            inbox
          </p>
        </div>
        <div className="px-3 pb-2 relative">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="search founders to message..."
            className="w-full font-mono lowercase text-[0.7rem] px-2.5 py-1.5"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
              outline: "none",
              borderRadius: 4,
            }}
          />
          {searchQuery.trim() !== "" && (
            <div
              className="absolute left-3 right-3 mt-1 z-30 max-h-72 overflow-y-auto scroll-thin"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: 4,
                boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
              }}
            >
              {searchLoading && searchResults.length === 0 && (
                <p className="font-mono lowercase text-[0.65rem] text-text-faint px-3 py-2">
                  searching...
                </p>
              )}
              {!searchLoading && searchResults.length === 0 && (
                <p className="font-mono lowercase text-[0.65rem] text-text-faint px-3 py-2">
                  no founders match.
                </p>
              )}
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openConversationWith(r)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[rgba(245,158,11,0.06)]"
                >
                  <Avatar
                    name={r.full_name}
                    stage={r.stage}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono lowercase text-[0.7rem] text-text-primary truncate">
                      {r.username ?? r.full_name?.toLowerCase() ?? "—"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StagePill stage={r.stage} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin">
          {conversations.length === 0 && (
            <div className="px-3 py-4">
              <div className="empty-panel compact">
                <span className="empty-panel-glyph" aria-hidden>✉</span>
                <p className="empty-panel-title">no conversations yet.</p>
                <p className="empty-panel-sub">search above to find a founder worth talking to.</p>
              </div>
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
                  background: active ? "rgba(88, 166, 255, 0.08)" : "transparent",
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
                <div className="flex flex-col items-center text-center mt-12 gap-1">
                  <p className="font-sans lowercase text-[0.85rem] text-text-secondary">
                    this is the start of something.
                  </p>
                  <p className="font-mono lowercase text-[0.7rem] text-text-faint">
                    say hi — founders here actually reply.
                  </p>
                </div>
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
                        className="px-3.5 py-2.5"
                        style={{
                          background: mine
                            ? "rgba(245, 158, 11,0.10)"
                            : "var(--card-elev)",
                          border: `1px solid ${
                            mine ? "rgba(245, 158, 11,0.25)" : "var(--border)"
                          }`,
                          borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
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
                className="btn-primary whitespace-nowrap"
              >
                send
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="empty-panel" style={{ maxWidth: 360, border: "none", background: "transparent" }}>
              <span className="empty-panel-glyph" aria-hidden>✉</span>
              <p className="empty-panel-title">your direct lines live here.</p>
              <p className="empty-panel-sub">
                pick a conversation on the left, or start one from a founder&apos;s profile.
              </p>
            </div>
          </div>
        )}
      </div>

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
    </div>
  );
}
