"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { TAG_COLOR } from "@/lib/stage";
import { shortTimeAgo } from "@/lib/vault";
import type { WisdomItem } from "./VaultPage";

type GhostPost = {
  id: string;
  content: string;
  tag: string | null;
  reply_count: number;
  author: any;
  created_at: string;
};

export default function CommunityWisdomTab({
  items,
  topRepliedPulse,
  pulseRecent,
}: {
  items: WisdomItem[];
  topRepliedPulse: GhostPost[];
  pulseRecent: number;
}) {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string>("all");
  const [tick, setTick] = useState<string | null>(null);

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

  // ticker â€” live pulse insert signal
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("vault:wisdom-ticker")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: "post_type=eq.pulse" },
        () => {
          setTick("a founder just posted something on pulse worth reading");
          setTimeout(() => setTick(null), 6000);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div>
      {tick && (
        <div
          className="mb-4 px-3 py-2 border-l-2 vault-toast"
          style={{
            borderLeftColor: "#e8702a",
            background: "rgba(232, 112, 42,0.05)",
            color: "var(--text-muted)",
          }}
        >
          <p className="font-mono lowercase text-[0.7rem]">{tick}</p>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {tags.map((t) => {
          const active = tag === t;
          return (
            <button
              key={t}
              onClick={() => setTag(t)}
              className="font-mono lowercase text-[0.65rem] px-3 py-1.5 border transition-colors"
              style={{
                borderColor: active ? "#e8702a" : "var(--border)",
                color: active ? "#e8702a" : "var(--text-faint)",
                background: active ? "rgba(232, 112, 42,0.06)" : "transparent",
              }}
            >
              {t}
            </button>
          );
        })}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="searchâ€¦"
          className="ml-auto bg-transparent border px-3 py-1.5 text-[0.75rem] text-text-secondary focus:outline-none focus:border-amber"
          style={{ borderColor: "var(--border)", minWidth: 200 }}
        />
      </div>

      {filtered.length === 0 ? (
        <WisdomEmpty topRepliedPulse={topRepliedPulse} pulseRecent={pulseRecent} />
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
  const color = item.post.tag ? TAG_COLOR[item.post.tag] ?? "#707070" : "#707070";
  return (
    <article
      className="p-4 border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border-amber)" }}
    >
      <header className="flex items-center gap-3 mb-2">
        {item.post.author ? (
          <Avatar
            name={item.post.author.full_name}
            stage={item.post.author.stage}
            username={item.post.author.username}
            size={32}
          />
        ) : (
          <div
            className="w-8 h-8 flex items-center justify-center font-mono text-[0.6rem] lowercase"
            style={{ background: "var(--card)", color: "var(--text-faint)", borderRadius: "50%" }}
          >
            ??
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-mono lowercase text-xs text-text-primary truncate">
            {item.post.author?.full_name?.toLowerCase() ?? "anonymous"}
          </p>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint">
            posted {shortTimeAgo(item.post.created_at)} ago
          </p>
        </div>
        <div className="flex items-center gap-2">
          {item.post.tag && (
            <span
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
              style={{ border: `1px solid ${color}`, color }}
            >
              {item.post.tag}
            </span>
          )}
          <span
            className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
            style={{ border: "1px solid #e8702a", color: "#e8702a" }}
          >
            vaulted
          </span>
        </div>
      </header>

      <p className="text-text-secondary text-[0.92rem] leading-relaxed whitespace-pre-wrap">
        {item.post.content}
      </p>

      <footer className="flex items-center justify-between mt-3">
        <span className="font-mono lowercase text-[0.65rem] text-text-faint">
          â†³ {item.post.reply_count} {item.post.reply_count === 1 ? "reply" : "replies"} Â·
          vaulted {shortTimeAgo(item.approved_at)} ago
        </span>
        <Link
          href={`/pulse#${item.post_id}`}
          className="font-mono lowercase text-[0.7rem] text-amber hover:opacity-80"
        >
          view full conversation â†’
        </Link>
      </footer>

      {(item.nominator || item.nomination_reason) && (
        <div
          className="mt-3 pt-3 border-t font-mono lowercase text-[0.65rem] text-text-faint"
          style={{ borderColor: "var(--border)" }}
        >
          nominated by {item.nominator?.full_name?.toLowerCase() ?? "anonymous"}
          {item.nomination_reason ? ` â€” "${item.nomination_reason}"` : ""}
        </div>
      )}
    </article>
  );
}

function WisdomEmpty({
  topRepliedPulse,
  pulseRecent,
}: {
  topRepliedPulse: GhostPost[];
  pulseRecent: number;
}) {
  return (
    <div className="space-y-5">
      <div
        className="p-8 border text-center"
        style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
      >
        <p className="text-text-secondary text-sm leading-relaxed">nothing here yet.</p>
        <p className="text-text-muted text-sm leading-relaxed mt-1">
          when a conversation on Pulse is worth preserving forever,
          <br />
          the community nominates it.
        </p>
        <p className="text-text-muted text-sm leading-relaxed mt-3">
          the best insights don't disappear here â€” they get kept.
        </p>
        <Link
          href="/pulse"
          className="inline-block font-mono lowercase text-[0.7rem] text-amber hover:opacity-80 mt-5"
        >
          {pulseRecent} posts on pulse right now that could end up here â†’
        </Link>
      </div>

      {topRepliedPulse.length > 0 && (
        <div>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-2 tracking-wider">
            most_replied_to Â· last 7 days
          </p>
          <div className="space-y-3">
            {topRepliedPulse.map((p) => (
              <GhostPreview key={p.id} post={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GhostPreview({ post }: { post: GhostPost }) {
  return (
    <article
      className="p-4 border relative"
      style={{
        background: "var(--card-elev)",
        borderColor: "var(--border)",
        filter: "blur(0.6px)",
        opacity: 0.78,
      }}
    >
      <header className="flex items-center gap-3 mb-2">
        {post.author && (
          <Avatar
            name={post.author.full_name}
            stage={post.author.stage}
            username={post.author.username}
            size={28}
          />
        )}
        <p className="font-mono lowercase text-xs text-text-faint flex-1 truncate">
          {post.author?.full_name?.toLowerCase() ?? "anonymous"}
        </p>
        <span className="font-mono lowercase text-[0.6rem] text-text-faint">
          â†³ {post.reply_count}
        </span>
      </header>
      <p className="text-text-muted text-[0.9rem] leading-relaxed line-clamp-3 whitespace-pre-wrap">
        {post.content.slice(0, 220)}
        {post.content.length > 220 && "â€¦"}
      </p>
      <div className="mt-3">
        <Link
          href={`/pulse#${post.id}`}
          className="font-mono lowercase text-[0.7rem] px-3 py-1 inline-block"
          style={{ background: "rgba(232, 112, 42, 0.18)", color: "#e8702a", border: "1px solid rgba(232, 112, 42, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(232, 112, 42, 0.2), inset 0 0 8px rgba(232, 112, 42, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
        >
          nominate this â†’
        </Link>
      </div>
    </article>
  );
}
