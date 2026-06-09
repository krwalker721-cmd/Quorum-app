"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/stage";

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
}: {
  postId: string;
  postType: string;
  cohortId: string | null;
  currentUserId?: string | null;
  onCollapse: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
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
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase
      .from("posts")
      .insert({
        author_id: currentUserId,
        content: trimmed,
        post_type: postType,
        cohort_id: cohortId ?? null,
        parent_post_id: postId,
        is_anonymous: anon,
        local_hour: new Date().getHours(),
      })
      .select("id, author_id, content, is_anonymous, created_at")
      .single();
    setBusy(false);
    if (error) {
      setErr(error.message.toLowerCase());
      return;
    }
    setText("");
    setAnon(false);
    if (data) {
      const [hydrated] = await hydrate([data as Reply]);
      setReplies((prev) => addUnique(prev, hydrated));
    }
  }

  return (
    <div className="reply-thread">
      <div className="flex items-center justify-between mb-2">
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
        <div key={r.id} className="reply-card flex items-start gap-2">
          {r.is_anonymous ? (
            <div
              className="w-7 h-7 flex items-center justify-center font-mono text-[0.55rem] lowercase shrink-0"
              style={{ background: "var(--card)", color: "var(--text-faint)", borderRadius: "50%" }}
            >
              ??
            </div>
          ) : (
            <Avatar
              name={r.author?.full_name}
              stage={r.author?.stage}
              username={r.author?.username}
              size={28}
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

      <div className="reply-input-area">
        <textarea
          rows={2}
          placeholder="write a reply..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-2 py-1.5 text-text-primary text-[0.82rem]"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        />
        {err && <p className="font-mono text-[0.65rem] text-red-400 lowercase">{err}</p>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAnon((v) => !v)}
            aria-pressed={anon}
            className="relative shrink-0"
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
          <span className="font-mono lowercase text-[0.6rem] text-text-faint">reply anonymously</span>
          <button
            onClick={submit}
            disabled={busy || !text.trim()}
            className="reply-btn ml-auto"
            style={{ color: text.trim() ? "#f59e0b" : "#8b949e", fontSize: 11 }}
          >
            {busy ? "…" : "reply →"}
          </button>
        </div>
      </div>
    </div>
  );
}
