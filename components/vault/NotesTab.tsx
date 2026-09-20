"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  NOTE_TAGS,
  noteContentToText,
  noteFirstLine,
  type NoteRow,
  type NoteCollectionRow,
} from "@/lib/vault";
import { parseDbTime } from "@/lib/stage";
import dynamic from "next/dynamic";
import NoteEditorBoundary from "./NoteEditorBoundary";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { usePaywall } from "@/hooks/usePaywall";
import PaywallModal from "@/components/PaywallModal";
import EmptyStateUpgradeLine from "@/components/EmptyStateUpgradeLine";
import ui from "@/components/ui/sleek.module.css";

// A hairline panel that doesn't light up on hover: surfaces you work inside.
const PANEL: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  borderRadius: 12,
};

// Tiptap is a client-only library — disable SSR for it entirely to avoid
// hydration mismatches surfacing as the generic Next.js error overlay.
const NoteEditor = dynamic(() => import("./NoteEditor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[480px] md:min-h-[600px] flex items-center justify-center" style={PANEL}>
      <p className={ui.emptySub}>Loading editor…</p>
    </div>
  ),
});

const PROMPTS = [
  "What decision are you sitting on right now?",
  "What did you learn this week that you don't want to forget?",
  "What would you tell yourself six months ago?",
];

export default function NotesTab({
  initialNotes,
  initialCollections,
}: {
  currentUserId: string;
  initialNotes: NoteRow[];
  initialCollections: NoteCollectionRow[];
}) {
  const { paywallState, checkAndGate, handleGateResponse, closePaywall } = usePaywall();
  const [notes, setNotes] = useState<NoteRow[]>(initialNotes);
  const [collections, setCollections] = useState<NoteCollectionRow[]>(initialCollections);
  const [activeId, setActiveId] = useState<string | null>(initialNotes[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const activeNote = useMemo(() => notes.find((n) => n.id === activeId) ?? null, [notes, activeId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter((n) => {
      if ((n.title ?? "").toLowerCase().includes(q)) return true;
      return noteContentToText(n.content).toLowerCase().includes(q);
    });
  }, [notes, search]);

  async function createNote() {
    // Paywall gate — creating a NEW note needs full access. Editing an
    // existing note is never gated.
    const allowed = await checkAndGate("vault_notes");
    if (!allowed) return;
    // The POST route enforces the cap and increments usage server-side, so no
    // separate /api/usage/increment call here (it would double-count).
    const res = await fetch("/api/vault/notes", { method: "POST" });
    if (!res.ok) {
      // An entitlement 403 gets the upgrade overlay — otherwise the click to add
      // a note does nothing at all, with no explanation.
      const data = await res.json().catch(() => ({}));
      handleGateResponse("vault_notes", data);
      return;
    }
    const { id } = await res.json();
    const fresh: NoteRow = {
      id,
      title: "",
      content: [{ type: "text", text: "" }],
      collection_id: null,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setNotes((prev) => [fresh, ...prev]);
    setActiveId(id);
  }

  async function performDelete(id: string) {
    await fetch("/api/vault/notes", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
    setPendingDelete(null);
  }

  function deleteNote(id: string) {
    setPendingDelete(id);
  }

  function patchLocal(id: string, patch: Partial<NoteRow>) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n,
      ),
    );
  }

  async function moveToCollection(noteId: string, collectionId: string | null) {
    patchLocal(noteId, { collection_id: collectionId });
    await fetch("/api/vault/notes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: noteId, collection_id: collectionId }),
    });
  }

  async function createCollection() {
    const name = prompt("Collection name");
    if (!name) return;
    const res = await fetch("/api/vault/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const row = await res.json();
    setCollections((prev) => [...prev, row]);
  }

  // group notes by collection
  const grouped = useMemo(() => {
    const byCol: Record<string, NoteRow[]> = {};
    const uncategorized: NoteRow[] = [];
    for (const n of filtered) {
      if (n.collection_id) {
        (byCol[n.collection_id] ??= []).push(n);
      } else {
        uncategorized.push(n);
      }
    }
    return { byCol, uncategorized };
  }, [filtered]);

  const rowProps = (n: NoteRow) => ({
    note: n,
    active: n.id === activeId,
    onOpen: () => setActiveId(n.id),
    onDelete: () => deleteNote(n.id),
    collections,
    onMove: (cid: string | null) => moveToCollection(n.id, cid),
  });

  return (
    // Side by side on desktop; stacked on a phone, where a fixed-width list
    // beside the editor wouldn't fit.
    <div className="flex flex-col md:flex-row gap-4 md:min-h-[600px]">
      <aside
        className="w-full md:w-[270px] shrink-0 flex flex-col max-h-[340px] md:max-h-none"
        style={PANEL}
      >
        <div className="p-3" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <span className={ui.label}>Your notes</span>
            <button
              type="button"
              onClick={createNote}
              className={ui.softBtn}
              style={{ padding: "5px 10px", fontSize: 11.5 }}
            >
              New note
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
            className={`${ui.search} w-full`}
            style={{ fontSize: 12, padding: "7px 12px" }}
          />
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin py-1.5">
          {collections.map((c) => {
            const items = grouped.byCol[c.id] ?? [];
            const isCollapsed = collapsed[c.id];
            return (
              <div key={c.id}>
                <button
                  type="button"
                  onClick={() => setCollapsed((p) => ({ ...p, [c.id]: !p[c.id] }))}
                  aria-expanded={!isCollapsed}
                  className="w-full text-left px-4 py-1.5 flex items-center justify-between hover:text-text-primary"
                  style={{ fontSize: 11.5, color: "var(--text-muted)" }}
                >
                  <span className="truncate">
                    <span aria-hidden style={{ display: "inline-block", width: 12 }}>
                      {isCollapsed ? "▸" : "▾"}
                    </span>
                    {c.name}
                  </span>
                  <span>{items.length}</span>
                </button>
                {!isCollapsed && items.map((n) => <NoteRowItem key={n.id} {...rowProps(n)} />)}
              </div>
            );
          })}

          {grouped.uncategorized.map((n) => (
            <NoteRowItem key={n.id} {...rowProps(n)} />
          ))}
          {filtered.length === 0 && notes.length > 0 && (
            <p className={ui.emptySub} style={{ padding: "8px 16px" }}>
              No notes match.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={createCollection}
          className={`${ui.textBtn} text-left`}
          // Inline padding: .textBtn zeroes it, and would beat Tailwind's px/py.
          style={{ fontSize: 12, padding: "10px 16px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
        >
          + New collection
        </button>
      </aside>

      <div className="flex-1 min-w-0">
        {activeNote ? (
          <NoteEditorBoundary key={activeNote.id}>
            <NoteEditor
              note={activeNote}
              onLocalChange={(patch) => patchLocal(activeNote.id, patch)}
            />
          </NoteEditorBoundary>
        ) : (
          <NotesEmpty onCreate={createNote} hasAny={notes.length > 0} />
        )}
      </div>

      {pendingDelete && (
        <ConfirmDeleteModal
          itemLabel="note"
          onConfirm={() => performDelete(pendingDelete)}
          onClose={() => setPendingDelete(null)}
        />
      )}

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

function NoteRowItem({
  note,
  active,
  onOpen,
  onDelete,
  collections,
  onMove,
}: {
  note: NoteRow;
  active: boolean;
  onOpen: () => void;
  onDelete: () => void;
  collections: NoteCollectionRow[];
  onMove: (cid: string | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const firstLine = noteFirstLine(note.content);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  // updated_at can arrive zoneless (UTC); parseDbTime keeps the day right.
  const updated = parseDbTime(note.updated_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      ref={ref}
      onClick={onOpen}
      className={`relative mx-2 px-3 py-2 cursor-pointer rounded-lg ${ui.row}`}
      style={active ? { background: "rgba(245, 158, 11, 0.08)" } : undefined}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 rounded"
          style={{ width: 2, background: "#f59e0b", boxShadow: "0 0 8px rgba(245, 158, 11, 0.6)" }}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <p
          className="truncate flex-1 min-w-0"
          style={{ fontSize: 13, fontWeight: 500, color: note.title ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          {note.title || "Untitled note"}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="px-1 text-text-muted hover:text-text-primary"
          aria-label="Note actions"
          aria-expanded={menuOpen}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
      </div>
      <p className="truncate" style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
        {updated}
        {firstLine ? ` · ${firstLine}` : ""}
      </p>

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-2 top-9 z-30 min-w-[190px] ${ui.menu}`}
        >
          <p style={{ fontSize: 10.5, color: "var(--text-muted)", padding: "4px 10px 2px" }}>Move to</p>
          <button
            type="button"
            onClick={() => {
              onMove(null);
              setMenuOpen(false);
            }}
            className={ui.menuItem}
          >
            No collection
          </button>
          {collections.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => {
                onMove(c.id);
                setMenuOpen(false);
              }}
              className={ui.menuItem}
            >
              {c.name}
            </button>
          ))}
          <div style={{ height: 1, background: "rgba(255, 255, 255, 0.06)", margin: "4px 0" }} />
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
            className={ui.menuItem}
            style={{ color: "#f87171" }}
          >
            Delete note
          </button>
        </div>
      )}
    </div>
  );
}

function NotesEmpty({ onCreate, hasAny }: { onCreate: () => void; hasAny: boolean }) {
  return (
    <div className="h-full min-h-[420px] md:min-h-[600px] flex items-center justify-center" style={PANEL}>
      <div className="text-center px-6 max-w-md">
        {hasAny ? (
          <p className={ui.emptyTitle}>Pick a note, or start a new one.</p>
        ) : (
          <>
            <p style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)" }}>
              Your thinking space.
            </p>
            <p className={ui.emptySub} style={{ marginTop: 6 }}>
              Notes are private to you. Capture decisions, frameworks, and retrospectives:
              anything worth keeping.
            </p>
            <EmptyStateUpgradeLine>Notes are for members. Reactivate to keep writing.</EmptyStateUpgradeLine>
          </>
        )}
        <button type="button" onClick={onCreate} className={ui.primaryBtn} style={{ marginTop: 18 }}>
          New note
        </button>
        {!hasAny && (
          <div style={{ marginTop: 22 }}>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Not sure where to start?</p>
            {PROMPTS.map((p) => (
              <p key={p} style={{ fontSize: 12, fontStyle: "italic", color: "var(--text-secondary)", marginTop: 6 }}>
                {p}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// note: NOTE_TAGS used inside NoteEditor
export { NOTE_TAGS };
