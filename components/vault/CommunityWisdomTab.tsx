"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { shortTimeAgo } from "@/lib/vault";
import { TabPill, TabPillRow } from "@/components/ui/TabPill";
import ui from "@/components/ui/sleek.module.css";
import type { WisdomItem } from "./VaultPage";

type GhostPost = {
  id: string;
  content: string;
  tag: string | null;
  reply_count: number;
  author: any;
  created_at: string;
};

// "real_talk" → "Real talk"
function sentence(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function replies(n: number) {
  return `${n} ${n === 1 ? "reply" : "replies"}`;
}

export default function CommunityWisdomTab({
  items,
  topRepliedPulse,
  pulseRecent,
}: {
  items: WisdomItem[];
  topRepliedPulse: GhostPost[];
  pulseRecent: number;
}) {
  const isAdmin = useIsAdmin();
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string>("all");
  const [tick, setTick] = useState(false);

  const tags = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.post.tag && s.add(i.post.tag));
    return ["all", ...Array.from(s)];
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((i) => {
      if (tag !== "all" && i.post.tag !== tag) return false;
      if (!q) return true;
      return (
        i.post.content.toLowerCase().includes(q) ||
        (i.nomination_reason ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, tag]);

  // A quiet live line whenever someone posts on Pulse.
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase
      .channel("vault:wisdom-ticker")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: "post_type=eq.pulse" },
        () => {
          setTick(true);
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => setTick(false), 6000);
        },
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div style={{ maxWidth: 820 }}>
      {tick && (
        <p className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
          <span aria-hidden className={ui.liveDot} />
          A founder just posted on Pulse.
        </p>
      )}

      {items.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 16 }}>
          <TabPillRow>
            {tags.map((t) => (
              <TabPill sleek key={t} active={tag === t} onClick={() => setTag(t)}>
                {t === "all" ? "All" : sentence(t)}
              </TabPill>
            ))}
          </TabPillRow>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search community wisdom"
            className={`${ui.search} w-full sm:w-64 sm:ml-auto`}
          />
        </div>
      )}

      {items.length === 0 ? (
        <WisdomEmpty topRepliedPulse={topRepliedPulse} pulseRecent={pulseRecent} isAdmin={isAdmin} />
      ) : filtered.length === 0 ? (
        <p className={ui.emptyTitle}>Nothing matches that.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((w) => (
            <WisdomCard key={w.id} item={w} />
          ))}
        </div>
      )}
    </div>
  );
}

function WisdomCard({ item }: { item: WisdomItem }) {
  const author = item.post.author;
  return (
    <article className={ui.tile} style={{ padding: "16px 18px" }}>
      <header className="flex items-center gap-3">
        {author ? (
          <Avatar name={author.full_name} stage={author.stage} username={author.username} size={32} />
        ) : (
          <div
            className="shrink-0 flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--card)", color: "var(--text-muted)", fontSize: 11 }}
          >
            ?
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
            {author?.full_name ?? "Anonymous"}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Posted {shortTimeAgo(item.post.created_at)} ago
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.post.tag && <span className={ui.chip}>{sentence(item.post.tag)}</span>}
          <span className={`${ui.chip} ${ui.chipAmber}`}>In the vault</span>
        </div>
      </header>

      <p
        className="whitespace-pre-wrap"
        style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", marginTop: 12 }}
      >
        {item.post.content}
      </p>

      {(item.nominator || item.nomination_reason) && (
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)", marginTop: 10 }}>
          Nominated by {item.nominator?.full_name ?? "a member"}
          {item.nomination_reason ? ` — “${item.nomination_reason}”` : ""}
        </p>
      )}

      <footer className={`${ui.cardFoot} flex items-center justify-between gap-3 flex-wrap`}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {replies(item.post.reply_count)} · kept {shortTimeAgo(item.approved_at)} ago
        </span>
        <Link href={`/pulse#post-${item.post_id}`} className={ui.tileLink}>
          View the conversation →
        </Link>
      </footer>
    </article>
  );
}

function WisdomEmpty({
  topRepliedPulse,
  pulseRecent,
  isAdmin,
}: {
  topRepliedPulse: GhostPost[];
  pulseRecent: number;
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className={ui.tile} style={{ padding: "28px 24px" }}>
        <div className="text-center">
          <p className={ui.emptyTitle}>Nothing here yet.</p>
          <p className={ui.emptySub} style={{ maxWidth: 440, margin: "4px auto 0" }}>
            When a conversation on Pulse is worth keeping, it gets nominated to the vault, so the
            best insights don&apos;t scroll away.
          </p>
          {/* Nominating is admin-only, so only admins get the actionable prompt. */}
          {isAdmin && (
            <Link href="/pulse" className={ui.tileLink} style={{ display: "inline-block", marginTop: 14 }}>
              {pulseRecent} Pulse {pulseRecent === 1 ? "post" : "posts"} in the last day could end
              up here →
            </Link>
          )}
        </div>
      </div>

      {/* The most-replied previews are a nomination prompt: admins only. */}
      {isAdmin && topRepliedPulse.length > 0 && (
        <div>
          <p className={ui.label} style={{ marginBottom: 10 }}>
            Most replied to · last 7 days
          </p>
          <div className="space-y-3">
            {topRepliedPulse.map((p) => (
              <NominationPreview key={p.id} post={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NominationPreview({ post }: { post: GhostPost }) {
  return (
    <article className={ui.tile} style={{ padding: "14px 16px" }}>
      <header className="flex items-center gap-3">
        {post.author && (
          <Avatar
            name={post.author.full_name}
            stage={post.author.stage}
            username={post.author.username}
            size={28}
          />
        )}
        <p className="flex-1 truncate" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {post.author?.full_name ?? "Anonymous"}
        </p>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{replies(post.reply_count)}</span>
      </header>
      <p
        className="line-clamp-3 whitespace-pre-wrap"
        style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", marginTop: 10 }}
      >
        {post.content}
      </p>
      <Link href={`/pulse#post-${post.id}`} className={ui.softBtn} style={{ display: "inline-block", marginTop: 12 }}>
        Nominate this
      </Link>
    </article>
  );
}
