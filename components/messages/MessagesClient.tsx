"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";
import NoGrid from "@/components/ui/NoGrid";
import ui from "@/components/ui/sleek.module.css";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/stage";
import { usePaywall } from "@/hooks/usePaywall";
import PaywallModal from "@/components/PaywallModal";
import { useTier } from "@/contexts/TierContext";
import EmptyStateUpgradeLine from "@/components/EmptyStateUpgradeLine";

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

const HAIRLINE = "1px solid rgba(255, 255, 255, 0.06)";

function displayName(p: Partner) {
  return p.full_name || p.username || "—";
}

export default function MessagesClient({
  currentUserId,
  conversations: initialConversations,
  initialPartnerId,
}: {
  currentUserId: string;
  conversations: Conversation[];
  initialPartnerId: string | null;
}) {
  const { hasFullAccess, hadTrial, isLoading: tierLoading } = useTier();
  const { paywallState, checkAndGate, handleGateResponse, closePaywall } = usePaywall();
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
  const unreadCount = conversations.filter((c) => c.unread).length;

  // Whether DMs are closed for this account. Was an "80% of your monthly
  // messages used" bar, which could never appear: an unentitled account's cap is
  // 0 and an entitled one is uncapped, so the ratio was never between the two.
  const showMessagesLocked = !hasFullAccess && !tierLoading;

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
    // Paywall gate — DMs need full access. Check before sending.
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
    // Server route enforces the cap and increments usage after the insert.
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, recipient_id: selectedId }),
    });
    setSending(false);
    if (!res.ok) {
      // Roll the optimistic message back and hand the draft to the founder either
      // way; an entitlement 403 additionally surfaces the upgrade overlay, which
      // is the only signal they'd otherwise get for a message that silently
      // failed to send.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(content);
      const data = await res.json().catch(() => ({}));
      handleGateResponse("messages", data);
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

  const canSend = !sending && !!draft.trim();

  return (
    <div className="flex flex-col app-pane">
      <NoGrid />
      {showMessagesLocked && (
        <div
          className="flex items-center justify-between gap-3 flex-wrap"
          style={{
            padding: "10px 20px",
            background: "rgba(245, 158, 11, 0.05)",
            borderBottom: "1px solid rgba(245, 158, 11, 0.15)",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {hadTrial
              ? "Your trial has ended. Choose a plan to keep sending messages."
              : "Direct messages are part of a membership."}
          </span>
          <Link href="/pricing" className={ui.tileLink} style={{ color: "#f8c56a" }}>
            See plans →
          </Link>
        </div>
      )}
      <div className="msg-split flex flex-1 min-h-0" data-selected={selected ? "1" : "0"}>
        {/* LEFT — inbox */}
        <div
          className="msg-list flex flex-col shrink-0"
          style={{
            width: "clamp(240px, 30%, 330px)",
            background: "var(--bg-surface)",
            borderRight: HAIRLINE,
          }}
        >
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <span className={ui.label}>Inbox</span>
            {unreadCount > 0 && (
              <span className={`${ui.chip} ${ui.chipAmber}`}>{unreadCount} unread</span>
            )}
          </div>
          <div className="px-3 pb-2 relative">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search founders to message"
              aria-label="Search founders to message"
              className={`${ui.search} w-full`}
              style={{ fontSize: 12, padding: "8px 12px" }}
            />
            {searchQuery.trim() !== "" && (
              <div className={`absolute left-3 right-3 mt-1 z-30 max-h-72 overflow-y-auto scroll-thin ${ui.menu}`}>
                {searchLoading && searchResults.length === 0 && (
                  <p className={ui.emptySub} style={{ padding: "6px 10px", marginTop: 0 }}>
                    Searching…
                  </p>
                )}
                {!searchLoading && searchResults.length === 0 && (
                  <p className={ui.emptySub} style={{ padding: "6px 10px", marginTop: 0 }}>
                    No founders match.
                  </p>
                )}
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openConversationWith(r)}
                    className={`${ui.menuItem} flex items-center gap-2.5`}
                  >
                    <Avatar name={r.full_name} stage={r.stage} size={28} />
                    <span className="min-w-0 flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                      {displayName(r)}
                    </span>
                    <StagePill sleek stage={r.stage} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin pb-2">
            {conversations.length === 0 && (
              <div className={ui.empty} style={{ padding: "12px 16px" }}>
                <p className={ui.emptyTitle}>No conversations yet.</p>
                <p className={ui.emptySub}>Search above to find a founder worth talking to.</p>
                <EmptyStateUpgradeLine>
                  Messaging is for members. Reactivate to keep your direct lines open.
                </EmptyStateUpgradeLine>
              </div>
            )}
            {conversations.map((c) => {
              const active = c.partner.id === selectedId;
              return (
                <button
                  key={c.partner.id}
                  type="button"
                  onClick={() => setSelectedId(c.partner.id)}
                  aria-current={active ? "true" : undefined}
                  className={`relative flex items-start gap-3 text-left ${ui.row}`}
                  style={{
                    width: "calc(100% - 16px)",
                    margin: "0 8px 2px",
                    padding: "10px 12px",
                    background: active ? "rgba(245, 158, 11, 0.08)" : undefined,
                  }}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-2.5 bottom-2.5 rounded"
                      style={{ width: 2, background: "#f59e0b", boxShadow: "0 0 8px rgba(245, 158, 11, 0.6)" }}
                    />
                  )}
                  <Avatar name={c.partner.full_name} stage={c.partner.stage} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 justify-between">
                      <p
                        className="truncate"
                        style={{ fontSize: 13, fontWeight: c.unread ? 600 : 500, color: "var(--text-primary)" }}
                      >
                        {displayName(c.partner)}
                      </p>
                      {c.lastAt && (
                        <span className="shrink-0" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                          {timeAgo(c.lastAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5" style={{ marginTop: 4 }}>
                      <StagePill sleek stage={c.partner.stage} />
                      {c.unread && (
                        <span
                          aria-label="unread"
                          className="ml-auto w-2 h-2 rounded-full"
                          style={{ background: "var(--green)" }}
                        />
                      )}
                    </div>
                    {c.last && (
                      <p
                        className="truncate"
                        style={{
                          fontSize: 12,
                          marginTop: 4,
                          color: c.unread ? "var(--text-secondary)" : "var(--text-muted)",
                        }}
                      >
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
        <div className="msg-thread flex-1 flex flex-col min-w-0">
          {selected ? (
            <>
              <div
                className="flex items-center justify-between gap-3 px-6 py-3"
                style={{ borderBottom: HAIRLINE }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="msg-back"
                    aria-label="Back to conversations"
                    style={{ fontSize: 18, color: "var(--text-muted)" }}
                  >
                    ‹
                  </button>
                  <Avatar
                    name={selected.full_name}
                    stage={selected.stage}
                    username={selected.username}
                    size={34}
                  />
                  <div className="min-w-0">
                    <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {displayName(selected)}
                    </p>
                    <div style={{ marginTop: 2 }}>
                      <StagePill sleek stage={selected.stage} />
                    </div>
                  </div>
                </div>
                {selected.username && (
                  <Link
                    href={`/profile/${selected.username}`}
                    className={`${ui.tileLink} shrink-0`}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    View profile →
                  </Link>
                )}
              </div>

              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto scroll-thin px-6 py-6 space-y-3"
              >
                {messages.length === 0 && (
                  <div className="flex flex-col items-center text-center" style={{ marginTop: 48 }}>
                    <p className={ui.emptyTitle}>This is the start of something.</p>
                    <p className={ui.emptySub}>Say hi. Founders here actually reply.</p>
                  </div>
                )}
                {messages.map((m) => {
                  const mine = m.sender_id === currentUserId;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div style={{ maxWidth: "75%" }}>
                        <div
                          style={{
                            padding: "10px 14px",
                            ...(mine
                              ? {
                                  border: "1px solid rgba(245, 158, 11, 0.3)",
                                  borderRadius: "16px 16px 6px 16px",
                                  background:
                                    "linear-gradient(150deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.07) 70%)",
                                  boxShadow: "0 10px 30px -20px rgba(245, 158, 11, 0.6)",
                                }
                              : {
                                  border: "1px solid rgba(255, 255, 255, 0.07)",
                                  borderRadius: "16px 16px 16px 6px",
                                  background:
                                    "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0) 60%), var(--bg-surface)",
                                }),
                          }}
                        >
                          <p
                            className="whitespace-pre-wrap"
                            style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)" }}
                          >
                            {m.content}
                          </p>
                        </div>
                        <p
                          className={mine ? "text-right" : "text-left"}
                          style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}
                        >
                          {timeAgo(m.created_at)} ago
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-6 py-3 flex items-center gap-2.5" style={{ borderTop: HAIRLINE }}>
                <input
                  placeholder="Write a message…"
                  aria-label={`Message ${displayName(selected)}`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  className={`${ui.search} flex-1 min-w-0`}
                />
                <button type="button" onClick={send} disabled={!canSend} className={ui.primaryBtn}>
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center" style={{ maxWidth: 360 }}>
                <p className={ui.emptyTitle}>Your direct lines live here.</p>
                <p className={ui.emptySub}>
                  Pick a conversation, or start one from a founder&apos;s profile.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {paywallState.isOpen && (
        <PaywallModal
          isOpen={paywallState.isOpen}
          onClose={closePaywall}
          feature={paywallState.feature!}
          hadTrial={paywallState.hadTrial}
        />
      )}
    </div>
  );
}
