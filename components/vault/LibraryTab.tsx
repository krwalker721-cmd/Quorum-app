"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { shortTimeAgo } from "@/lib/vault";
import { TabPill, TabPillRow } from "@/components/ui/TabPill";
import ui from "@/components/ui/sleek.module.css";
import type { LibraryItem } from "./VaultPage";

type Filter = "all" | "pulse_posts" | "cohort_posts" | "projects";

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  pulse_posts: "Pulse posts",
  cohort_posts: "Cohort posts",
  projects: "Projects",
};

const TYPE_LABEL: Record<LibraryItem["item_type"], string> = {
  pulse_post: "Pulse post",
  cohort_post: "Cohort post",
  project: "Project",
};

const PREVIEW_CHARS = 220;

export default function LibraryTab({ items }: { items: LibraryItem[] }) {
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
      <div style={{ marginBottom: 16 }}>
        <TabPillRow>
          {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
            <TabPill sleek key={f} active={filter === f} onClick={() => setFilter(f)}>
              {FILTER_LABEL[f]}
            </TabPill>
          ))}
        </TabPillRow>
      </div>

      {filtered.length === 0 ? (
        <LibraryEmpty filtered={items.length > 0} />
      ) : (
        <div className="space-y-3" style={{ maxWidth: 820 }}>
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

  // Pulse cards carry id="post-<id>" (PostCard), so that's the anchor to jump to.
  const viewHref =
    item.item_type === "project"
      ? `/collab/${item.item_id}`
      : item.item_type === "pulse_post"
        ? `/pulse#post-${item.item_id}`
        : `/cohort#${item.item_id}`;

  const content = origin?.content ?? "";
  const preview = content.slice(0, PREVIEW_CHARS);

  return (
    <article className={ui.tile} style={{ padding: "16px 18px" }}>
      <header className="flex items-center gap-3">
        {origin?.author ? (
          <Avatar
            name={origin.author.full_name}
            stage={origin.author.stage}
            username={origin.author.username}
            size={32}
          />
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
            {origin?.is_anonymous ? "Anonymous" : origin?.author?.full_name ?? "—"}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {origin ? `Posted ${shortTimeAgo(origin.created_at)} ago` : "No longer available"}
          </p>
        </div>
        <span className={`${ui.chip} shrink-0`}>{TYPE_LABEL[item.item_type]}</span>
      </header>

      {origin?.title && (
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginTop: 12 }}>
          {origin.title}
        </h3>
      )}
      <p
        className="whitespace-pre-wrap"
        style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", marginTop: origin?.title ? 4 : 12 }}
      >
        {origin ? (
          <>
            {preview}
            {content.length > PREVIEW_CHARS && "…"}
          </>
        ) : (
          "The original has been deleted."
        )}
      </p>

      {/* Your note on why you saved it */}
      <div style={{ marginTop: 12, paddingLeft: 12, borderLeft: "2px solid rgba(245, 158, 11, 0.5)" }}>
        {editing ? (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            autoFocus
            placeholder="Why did you save this?"
            rows={2}
            className={`${ui.search} w-full`}
            style={{ fontSize: 13, resize: "vertical" }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-left w-full"
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: note ? "var(--text-secondary)" : "var(--text-muted)",
              fontStyle: note ? "normal" : "italic",
            }}
          >
            {note || "Add a note about why you saved this…"}
          </button>
        )}
      </div>

      <footer className={`${ui.cardFoot} flex items-center justify-between gap-3`}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Saved {shortTimeAgo(item.created_at)} ago
        </span>
        {origin && (
          <Link href={viewHref} className={ui.tileLink}>
            View original →
          </Link>
        )}
      </footer>
    </article>
  );
}

function LibraryEmpty({ filtered }: { filtered: boolean }) {
  return (
    <div className={ui.tile} style={{ padding: "32px 24px", maxWidth: 820 }}>
      <div className="flex flex-col items-center text-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ color: "var(--text-muted)", opacity: 0.6 }}
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <p className={ui.emptyTitle} style={{ marginTop: 14 }}>
          {filtered ? "Nothing saved of this kind yet." : "Nothing saved yet."}
        </p>
        <p className={ui.emptySub} style={{ maxWidth: 420 }}>
          When you find something worth keeping, bookmark it and it lives here.
        </p>
      </div>
    </div>
  );
}
