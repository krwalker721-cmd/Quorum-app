"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NOTE_TAGS, type NoteBlock, type NoteRow, type NoteCollectionRow } from "@/lib/vault";
import NoteEditor from "./NoteEditor";

const PROMPTS = [
  "what decision are you sitting on right now?",
  "what did you learn this week that you don't want to forget?",
  "what would you tell yourself 6 months ago?",
];

export default function NotesTab({
  initialNotes,
  initialCollections,
}: {
  currentUserId: string;
  initialNotes: NoteRow[];
  initialCollections: NoteCollectionRow[];
}) {
  const [notes, setNotes] = useState<NoteRow[]>(initialNotes);
  const [collections, setCollections] = useState<NoteCollectionRow[]>(initialCollections);
  const [activeId, setActiveId] = useState<string | null>(initialNotes[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const activeNote = useMemo(() => notes.find((n) => n.id === activeId) ?? null, [notes, activeId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter((n) => {
      if (n.title.toLowerCase().includes(q)) return true;
      const text = (n.content ?? [])
        .map((b: NoteBlock) => b.text ?? "")
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [notes, search]);

  async function createNote() {
    const res = await fetch("/api/vault/notes", { method: "POST" });
    if (!res.ok) return;
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

  async function deleteNote(id: string) {
    if (!confirm("delete this note? this cannot be undone.")) return;
    await fetch("/api/vault/notes", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
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
    const name = prompt("collection name?");
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

  return (
    <div className="flex gap-4 min-h-[600px]">
      {/* left panel */}
      <aside
        className="w-[260px] shrink-0 border flex flex-col"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider">
              your_notes
            </span>
            <button
              onClick={createNote}
              className="font-mono lowercase text-[0.65rem] text-amber hover:opacity-80"
            >
              + new note
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search notesâ€¦"
            className="w-full bg-transparent border px-2 py-1.5 text-[0.75rem] text-text-secondary focus:outline-none focus:border-amber"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin">
          {collections.map((c) => {
            const items = grouped.byCol[c.id] ?? [];
            const isCollapsed = collapsed[c.id];
            return (
              <div key={c.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setCollapsed((p) => ({ ...p, [c.id]: !p[c.id] }))}
                  className="w-full text-left font-mono lowercase text-[0.65rem] text-text-faint px-3 py-2 hover:text-text-muted flex items-center justify-between"
                >
                  <span>
                    {isCollapsed ? "â–¸" : "â–¾"} {c.name.toLowerCase()}
                  </span>
                  <span>{items.length}</span>
                </button>
                {!isCollapsed && (
                  <div>
                    {items.map((n) => (
                      <NoteRowItem
                        key={n.id}
                        note={n}
                        active={n.id === activeId}
                        onOpen={() => setActiveId(n.id)}
                        onDelete={() => deleteNote(n.id)}
                        collections={collections}
                        onMove={(cid) => moveToCollection(n.id, cid)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div>
            {grouped.uncategorized.map((n) => (
              <NoteRowItem
                key={n.id}
                note={n}
                active={n.id === activeId}
                onOpen={() => setActiveId(n.id)}
                onDelete={() => deleteNote(n.id)}
                collections={collections}
                onMove={(cid) => moveToCollection(n.id, cid)}
              />
            ))}
            {filtered.length === 0 && notes.length > 0 && (
              <p className="font-mono lowercase text-[0.7rem] text-text-faint px-3 py-3">
                no matches.
              </p>
            )}
          </div>
        </div>

        <button
          onClick={createCollection}
          className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-muted px-3 py-2 text-left border-t"
          style={{ borderColor: "var(--border)" }}
        >
          + new collection
        </button>
      </aside>

      {/* right panel */}
      <div className="flex-1 min-w-0">
        {activeNote ? (
          <NoteEditor
            key={activeNote.id}
            note={activeNote}
            onLocalChange={(patch) => patchLocal(activeNote.id, patch)}
          />
        ) : (
          <NotesEmpty onCreate={createNote} hasAny={notes.length > 0} />
        )}
      </div>
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
  const firstLine =
    (note.content ?? []).find((b) => b.text && b.text.trim().length > 0)?.text ?? "";
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  return (
    <div
      ref={ref}
      onClick={onOpen}
      className="relative px-3 py-2 cursor-pointer border-l-2"
      style={{
        borderColor: active ? "#58a6ff" : "transparent",
        background: active ? "rgba(88, 166, 255, 0.08)" : "transparent",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-sans lowercase text-[0.85rem] text-text-primary truncate flex-1 min-w-0">
          {note.title || "untitled note"}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="text-text-faint hover:text-text-primary px-1"
          aria-label="note actions"
        >
          â‹¯
        </button>
      </div>
      <p className="font-mono lowercase text-[0.6rem] text-text-faint mt-0.5">
        {new Date(note.updated_at).toLocaleDateString()}
      </p>
      {firstLine && (
        <p className="text-[0.75rem] text-text-faint mt-0.5 truncate">{firstLine}</p>
      )}

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-8 z-30 min-w-[180px] border"
          style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        >
          <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="font-mono lowercase text-[0.6rem] text-text-faint mb-1">move to</p>
            <button
              onClick={() => {
                onMove(null);
                setMenuOpen(false);
              }}
              className="block w-full text-left font-mono lowercase text-[0.65rem] text-text-muted hover:text-text-primary px-1 py-0.5"
            >
              none
            </button>
            {collections.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onMove(c.id);
                  setMenuOpen(false);
                }}
                className="block w-full text-left font-mono lowercase text-[0.65rem] text-text-muted hover:text-text-primary px-1 py-0.5"
              >
                {c.name.toLowerCase()}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
            className="block w-full text-left font-mono lowercase text-[0.65rem] text-red-400 hover:opacity-80 px-3 py-2"
          >
            delete note
          </button>
        </div>
      )}
    </div>
  );
}

function NotesEmpty({ onCreate, hasAny }: { onCreate: () => void; hasAny: boolean }) {
  const [promptIdx, setPromptIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPromptIdx((i) => (i + 1) % PROMPTS.length), 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="relative overflow-hidden border h-full min-h-[600px] flex items-center justify-center"
      style={{
        borderColor: "var(--border)",
        backgroundImage:
          "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
        backgroundSize: "22px 22px, 22px 22px",
        backgroundColor: "var(--card)",
      }}
    >
      <GhostNoteOutlines />
      <div className="relative z-10 text-center px-6 max-w-md">
        {!hasAny && (
          <>
            <p className="text-text-secondary text-sm leading-relaxed mb-1">your thinking space.</p>
            <p className="text-text-muted text-sm leading-relaxed">
              notes you write here are entirely private.
            </p>
            <p className="text-text-muted text-sm leading-relaxed mb-5">
              capture decisions, frameworks, retrospectives â€” anything worth organizing.
            </p>
          </>
        )}
        <button
          onClick={onCreate}
          className="vault-breathe font-mono lowercase text-xs px-5 py-2.5 mt-2"
          style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
        >
          + new note
        </button>
        <p
          key={promptIdx}
          className="vault-prompt-cycle font-sans italic text-text-faint text-[0.85rem] mt-6"
        >
          {PROMPTS[promptIdx]}
        </p>
      </div>
    </div>
  );
}

function GhostNoteOutlines() {
  const cards = [
    { top: "8%", left: "6%", w: 140 },
    { top: "14%", right: "8%", w: 120 },
    { top: "62%", left: "12%", w: 160 },
    { top: "70%", right: "14%", w: 130 },
    { top: "38%", left: "44%", w: 110 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {cards.map((c, i) => (
        <div
          key={i}
          className="absolute border"
          style={{
            ...c,
            width: c.w,
            height: 86,
            borderColor: "rgba(255,255,255,0.04)",
            background: "rgba(255,255,255,0.015)",
          }}
        />
      ))}
    </div>
  );
}
// note: NOTE_TAGS used inside NoteEditor
export { NOTE_TAGS };
