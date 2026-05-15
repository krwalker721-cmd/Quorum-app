"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { ITEM_TYPE_COLOR, shortTimeAgo } from "@/lib/vault";
import type { LibraryItem } from "./VaultPage";

type Filter = "all" | "pulse_posts" | "cohort_posts" | "projects";

const FILTER_LABEL: Record<Filter, string> = {
  all: "all",
  pulse_posts: "pulse_posts",
  cohort_posts: "cohort_posts",
  projects: "projects",
};

export default function LibraryTab({
  items,
  communitySaved,
}: {
  items: LibraryItem[];
  currentUserId: string;
  communitySaved: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    const map: Record<Exclude<Filter, "all">, LibraryItem["item_type"]> = {
      pulse_posts: "pulse_post",
      cohort_posts: "cohort_post",
      projects: "project",
    };
    return items.filter((i) => i.item_type === map[filter as Exclude<Filter, "all">]);
  }, [items, filter]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="font-mono lowercase text-[0.65rem] px-3 py-1.5 border transition-colors"
              style={{
                borderColor: active ? "#f59e0b" : "var(--border)",
                color: active ? "#f59e0b" : "var(--text-faint)",
                background: active ? "rgba(245,158,11,0.06)" : "transparent",
              }}
            >
              {FILTER_LABEL[f]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <LibraryEmpty communitySaved={communitySaved} />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <SavedItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedItemCard({ item }: { item: LibraryItem }) {
  const [note, setNote] = useState(item.personal_note ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const origin = item.original;
  const color = ITEM_TYPE_COLOR[item.item_type];

  async function saveNote() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/vault/save", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, personal_note: note }),
      });
    } finally {
      setBusy(false);
      setEditing(false);
    }
  }

  const viewHref =
    item.item_type === "project"
      ? `/collab/${item.item_id}`
      : item.item_type === "pulse_post"
        ? `/pulse#${item.item_id}`
        : `/cohort#${item.item_id}`;

  const preview = origin?.content?.slice(0, 100) ?? "(original item no longer exists)";
  const fullPreviewHidden = (origin?.content?.length ?? 0) > 100;

  return (
    <article
      className="p-4 border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border-amber)" }}
    >
      <header className="flex items-center gap-3 mb-3">
        {origin?.author ? (
          <Avatar
            name={origin.author.full_name}
            stage={origin.author.stage}
            username={origin.author.username}
            size={28}
          />
        ) : (
          <div
            className="w-7 h-7 flex items-center justify-center font-mono text-[0.6rem] lowercase"
            style={{ background: "var(--card)", color: "var(--text-faint)", borderRadius: "50%" }}
          >
            ??
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-mono lowercase text-xs text-text-primary truncate">
            {origin?.is_anonymous
              ? "anonymous"
              : origin?.author?.full_name?.toLowerCase() ?? "—"}
          </p>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint">
            posted {origin ? shortTimeAgo(origin.created_at) : "—"} ago
          </p>
        </div>
        <span
          className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
          style={{ border: `1px solid ${color}`, color }}
        >
          {item.item_type}
        </span>
      </header>

      {origin?.title && (
        <h3 className="font-sans lowercase text-text-primary text-base mb-1">{origin.title}</h3>
      )}
      <p className="text-text-secondary text-[0.92rem] leading-relaxed whitespace-pre-wrap">
        {preview}
        {fullPreviewHidden && "…"}
      </p>

      <div className="mt-3">
        {editing ? (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            autoFocus
            placeholder="add a note about why you saved this..."
            rows={2}
            className="w-full bg-transparent border p-2 text-text-secondary text-[0.85rem] focus:outline-none focus:border-amber"
            style={{ borderColor: "var(--border)" }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-left w-full font-sans text-[0.85rem] text-text-faint italic hover:text-text-muted"
          >
            {note || "add a note about why you saved this..."}
          </button>
        )}
      </div>

      <footer className="flex items-center justify-between mt-3">
        <span className="font-mono lowercase text-[0.65rem] text-text-faint">
          saved {shortTimeAgo(item.created_at)} ago
        </span>
        <Link
          href={viewHref}
          className="font-mono lowercase text-[0.7rem] text-amber hover:opacity-80"
        >
          view original →
        </Link>
      </footer>
    </article>
  );
}

function LibraryEmpty({ communitySaved }: { communitySaved: number }) {
  return (
    <div className="relative overflow-hidden border" style={{ borderColor: "var(--border)" }}>
      <AmbientSaveFeed />
      <div className="relative z-10 p-12 flex flex-col items-center text-center">
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#707070"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.35 }}
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <p className="text-text-muted text-sm mt-5 max-w-md leading-relaxed">
          nothing saved yet. when you find something worth keeping, bookmark it and it lives here.
        </p>
        <p className="font-mono lowercase text-[0.7rem] text-text-faint mt-6">
          founders have saved {communitySaved} things worth keeping
        </p>
      </div>
    </div>
  );
}

function AmbientSaveFeed() {
  const [signals, setSignals] = useState<{ id: number; type: string; at: number }[]>([]);

  useEffect(() => {
    // seed three ambient cards staggered
    setSignals([
      { id: 1, type: "pulse", at: Date.now() - 120_000 },
      { id: 2, type: "collab board", at: Date.now() - 320_000 },
      { id: 3, type: "cohort room", at: Date.now() - 560_000 },
    ]);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none opacity-70">
      {signals.map((s, i) => (
        <div
          key={s.id}
          className="vault-ambient-card absolute left-6 right-6 border px-3 py-2"
          style={{
            background: "rgba(22,22,22,0.6)",
            borderColor: "var(--border)",
            bottom: 0,
            animationDelay: `${i * 7}s`,
          }}
        >
          <p className="font-mono lowercase text-[0.65rem] text-text-faint">
            a founder saved something from {s.type} · {shortTimeAgo(new Date(s.at).toISOString())} ago
          </p>
        </div>
      ))}
    </div>
  );
}
