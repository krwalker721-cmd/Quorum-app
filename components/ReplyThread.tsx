"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/stage";
import { usePaywall } from "@/hooks/usePaywall";
import PaywallModal from "@/components/PaywallModal";

type Reply = {
  id: string;
  author_id: string | null;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  author?: {
    full_name: string | null;
    stage: string | null;
    username: string | null;
  } | null;
};

/**
 * Inline reply thread for a post. Replies are posts with parent_post_id set,
 * inheriting the parent's post_type and cohort_id (one level of nesting only).
 * Renders the reply list, a "write a reply..." input with an anonymous toggle,
 * and a collapse control. Loads replies on mount and stays live via realtime.
 */
export default function ReplyThread({
  postId,
  postType,
  cohortId,
  currentUserId,
  onCollapse,
  variant = "attached",
}: {
  postId: string;
  postType: string;
  cohortId: string | null;
  currentUserId?: string | null;
  onCollapse: () => void;
  variant?: "attached" | "inline";
}) {
  const supabase = useMemo(() => createClient(), []);
  const { paywallState, checkAndGate, closePaywall } = usePaywall();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mounted = useRef(true);

  function addUnique(prev: Reply[], r: Reply) {
    return prev.find((x) => x.id === r.id) ? prev : [...prev, r];
  }

  async function hydrate(rows: Reply[]): Promise<Reply[]> {
    const ids = Array.from(
      new Set(rows.filter((r) => !r.is_anonymous && r.author_id).map((r) => r.author_id)),
    ) as string[];
    if (ids.length === 0) return rows.map((r) => ({ ...r, author: null }));
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, full_name, stage, username")
      .in("id", ids);
    const map = new Map((authors ?? []).map((a) => [a.id, a]));
    return rows.map((r) => ({
      ...r,
      author: r.is_anonymous || !r.author_id ? null : map.get(r.author_id) ?? null,
    }));
  }

  useEffect(() => {
    mounted.current = true;
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, author_id, content, is_anonymous, created_at")
        .eq("parent_post_id", postId)
        .order("created_at", { ascending: true });
      const hydrated = await hydrate((data ?? []) as Reply[]);
      if (mounted.current) {
        setReplies(hydrated);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`replies:${postId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `parent_post_id=eq.${postId}`,
        },
        async (payload) => {
          const row = payload.new as Reply;
          const [hydrated] = await hydrate([row]);
          if (mounted.current) setReplies((prev) => addUnique(prev, hydrated));
        },
      )
      .subscribe();

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || !currentUserId) return;
    // Paywall gate — replies are capped on free tier.
    const allowed = await checkAndGate("replies");
    if (!allowed) return;
    setBusy(true);
    setErr(null);
    // Server route enforces the cap and increments usage after the insert.
    const res = await fetch("/api/replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: trimmed,
        post_type: postType,
        cohort_id: cohortId ?? null,
        parent_post_id: postId,
        is_anonymous: anon,
        local_hour: new Date().getHours(),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr((d.error || "failed to reply").toLowerCase());
      return;
    }
    const { reply } = await res.json();
    setText("");
    setAnon(false);
    if (reply) {
      const [hydrated] = await hydrate([reply as Reply]);
      setReplies((prev) => addUnique(prev, hydrated));
    }
  }

  return (
    <div className={`reply-thread ${variant}`}>
      <div className="reply-thread-head">
        <p className="font-mono lowercase text-[0.6rem] text-text-faint">
          {loading
            ? "loading replies…"
            : replies.length === 0
              ? "no replies yet — start the thread"
              : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
        </p>
        <button onClick={onCollapse} className="reply-btn" style={{ fontSize: 10 }}>
          collapse ↑
        </button>
      </div>

      {replies.map((r) => (
        <div key={r.id} className="reply-row">
          {r.is_anonymous ? (
            <div
              className="w-6 h-6 flex items-center justify-center font-mono text-[0.5rem] lowercase shrink-0"
              style={{ background: "var(--card)", color: "var(--text-faint)", borderRadius: "50%" }}
            >
              ??
            </div>
          ) : (
            <Avatar
              name={r.author?.full_name}
              stage={r.author?.stage}
              username={r.author?.username}
              size={24}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono lowercase text-[0.7rem] text-text-primary truncate">
                {r.is_anonymous ? "anonymous" : r.author?.full_name?.toLowerCase() ?? "—"}
              </span>
              <span className="font-mono lowercase text-[0.55rem] text-text-faint ml-auto shrink-0">
                {timeAgo(r.created_at)} ago
              </span>
            </div>
            <p className="text-text-secondary text-[0.82rem] mt-1 leading-snug whitespace-pre-wrap">
              {r.content}
            </p>
          </div>
        </div>
      ))}

      {err && (
        <p className="font-mono text-[0.65rem] text-red-400 lowercase px-3.5 pt-2">{err}</p>
      )}
      <div className="reply-input-row">
        <textarea
          rows={1}
          placeholder="write a reply..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="reply-textarea"
        />
        <button
          type="button"
          onClick={() => setAnon((v) => !v)}
          aria-pressed={anon}
          title="reply anonymously"
          className="relative shrink-0 self-center"
          style={{
            width: 30,
            height: 16,
            borderRadius: 9999,
            background: anon ? "#f59e0b" : "var(--border)",
            transition: "background 150ms ease",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: anon ? 16 : 2,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 150ms ease",
            }}
          />
        </button>
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          className="reply-submit-btn"
        >
          {busy ? "…" : "reply →"}
        </button>
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
