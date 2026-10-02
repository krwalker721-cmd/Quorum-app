"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import type { Content } from "@tiptap/core";
import ui from "@/components/ui/sleek.module.css";
import RoomItemCard from "@/components/rooms/RoomItemCard";
import { META, PANEL } from "@/components/rooms/kit";
import { EditorToolbar, useRichEditor } from "@/components/editor/RichTextEditor";
import { sprintDb } from "@/lib/hackathons/actions";
import { parseDbTime, timeAgo } from "@/lib/stage";
import { DOC_COLUMNS, type RoomDocRow } from "@/lib/hackathons/room";
import { roomError } from "./roomError";

// The team's docs, written with the Vault's editor (shared since Phase 6).
// Anyone on the team can edit any doc. Saves happen a second after typing
// stops; the last save wins. If a teammate saves the doc you have open: with
// nothing unsaved on your side it simply reloads, otherwise you choose between
// their version and yours. Live co-editing (shared cursors) would need a new
// library, so it isn't here.

/** The database's limit on a doc's stored content (migration 019). */
const MAX_CONTENT = 100_000;
const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

/** Stored content is the editor's JSON as text; anything else reads as plain text. */
function parseContent(raw: string | null | undefined): Content {
  if (!raw) return EMPTY_DOC;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") return parsed;
  } catch {
    // plain text, below
  }
  return {
    type: "doc",
    content: raw.split(/\n{2,}/).map((p) => ({ type: "paragraph", content: p ? [{ type: "text", text: p }] : undefined })),
  };
}

/** A teammate's save, as realtime delivered it. */
export type RemoteDocChange = { id: string; updated_at: string; updated_by: string | null; title: string };

export default function TeamDocs({
  teamId,
  docs,
  nameOf,
  viewerId,
  writable,
  remote,
  openId,
  onOpen,
  onCreated,
  onDeleted,
}: {
  teamId: string;
  docs: RoomDocRow[];
  nameOf: (id: string | null) => string;
  viewerId: string;
  writable: boolean;
  remote: RemoteDocChange | null;
  openId: string | null;
  onOpen: (id: string | null) => void;
  onCreated: (d: RoomDocRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = openId ? docs.find((d) => d.id === openId) : null;
  if (open) {
    return (
      <DocEditor
        key={open.id}
        doc={open}
        nameOf={nameOf}
        viewerId={viewerId}
        writable={writable}
        remote={remote && remote.id === open.id ? remote : null}
        onClose={() => onOpen(null)}
      />
    );
  }

  async function create() {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    setError(null);
    const { data, error: e } = await sprintDb()
      .from("hackathon_team_docs")
      .insert({ team_id: teamId, title: t, content: "" })
      .select(DOC_COLUMNS)
      .single();
    setBusy(false);
    if (e || !data) {
      setError(roomError(e));
      return;
    }
    onCreated(data as RoomDocRow);
    setTitle("");
    setCreating(false);
    onOpen((data as RoomDocRow).id);
  }

  async function remove(d: RoomDocRow) {
    if (!window.confirm(`Delete "${d.title}"? This can't be undone.`)) return;
    const { error: e } = await sprintDb().from("hackathon_team_docs").delete().eq("id", d.id);
    if (e) setError(roomError(e));
    else onDeleted(d.id);
  }

  return (
    <div className="space-y-3">
      {docs.length === 0 && !creating && (
        <div style={{ ...PANEL, padding: "18px 20px" }}>
          <div className={ui.empty}>
            <p className={ui.emptyTitle}>No docs yet.</p>
            <p className={ui.emptySub}>The plan, the spec, the pitch: write them here together.</p>
          </div>
        </div>
      )}
      {docs.map((d) => (
        <RoomItemCard
          key={d.id}
          link={false}
          title={d.title}
          onOpen={() => onOpen(d.id)}
          meta={
            <>
              {d.updated_by && d.updated_at !== d.created_at ? `Edited by ${nameOf(d.updated_by)}` : `Started by ${nameOf(d.created_by)}`} ·{" "}
              {timeAgo(d.updated_at)} ago
            </>
          }
          action={
            writable && d.created_by === viewerId ? (
              <button
                type="button"
                onClick={() => remove(d)}
                aria-label={`Delete ${d.title}`}
                title="Delete doc"
                className={`${ui.textBtn} px-1 hover:!text-red-400`}
              >
                ✕
              </button>
            ) : undefined
          }
        />
      ))}

      {error && <p style={{ fontSize: 12, color: "#f87171" }}>{error}</p>}

      {!writable ? null : creating ? (
        <div className="space-y-3" style={{ ...PANEL, padding: 16 }}>
          <input
            placeholder="Doc title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
            }}
            autoFocus
            className={`${ui.search} w-full`}
          />
          <div className="flex justify-end items-center gap-3">
            <button type="button" onClick={() => setCreating(false)} className={ui.textBtn} style={{ fontSize: 12 }}>
              Cancel
            </button>
            <button type="button" onClick={create} disabled={busy || !title.trim()} className={ui.primaryBtn}>
              Create doc
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setCreating(true)} className={`${ui.ghostBtn} w-full`}>
          New doc
        </button>
      )}
    </div>
  );
}

/** Loads the doc's content, then opens the editor on it. */
function DocEditor(props: {
  doc: RoomDocRow;
  nameOf: (id: string | null) => string;
  viewerId: string;
  writable: boolean;
  remote: RemoteDocChange | null;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<{ content: string; updated_at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    sprintDb()
      .from("hackathon_team_docs")
      .select("content, updated_at")
      .eq("id", props.doc.id)
      .single()
      .then(({ data, error: e }) => {
        if (gone) return;
        if (e || !data) setError(roomError(e));
        else setLoaded(data as { content: string; updated_at: string });
      });
    return () => {
      gone = true;
    };
  }, [props.doc.id]);

  if (!loaded) {
    return (
      <div style={{ ...PANEL, padding: "18px 20px" }}>
        <button type="button" onClick={props.onClose} className={ui.textBtn} style={{ fontSize: 12 }}>
          ← All docs
        </button>
        <p style={{ ...META, marginTop: 12 }}>{error ?? "Opening…"}</p>
      </div>
    );
  }
  return <DocEditorLoaded {...props} initial={loaded} />;
}

type Conflict = { by: string | null; content: string; title: string; updated_at: string };

function DocEditorLoaded({
  doc,
  nameOf,
  viewerId,
  writable,
  remote,
  onClose,
  initial,
}: {
  doc: RoomDocRow;
  nameOf: (id: string | null) => string;
  viewerId: string;
  writable: boolean;
  remote: RemoteDocChange | null;
  onClose: () => void;
  initial: { content: string; updated_at: string };
}) {
  const [title, setTitle] = useState(doc.title);
  const [status, setStatus] = useState<"saved" | "unsaved" | "saving">("saved");
  const [savedAt, setSavedAt] = useState<string>(initial.updated_at);
  // Re-label "Saved … ago" as time passes.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const known = useRef(initial.updated_at);
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;

  const [content] = useState(() => parseContent(initial.content));
  const { editor, editorRef, slashMenu, wordCount } = useRichEditor({
    content,
    editable: writable,
    placeholder: writable ? "Type / for blocks, or just start writing…" : "",
    onChange: () => markDirty(),
  });

  function markDirty() {
    if (!writable) return;
    dirty.current = true;
    setStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 1000);
  }

  async function save(force = false) {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed || !writable || saving.current) return;
    if (!dirty.current && !force) return;
    const text = JSON.stringify(ed.getJSON());
    if (text.length > MAX_CONTENT) {
      setError("This doc is too long to save. Split it into two docs.");
      return;
    }
    const t = titleRef.current.trim() || doc.title;
    saving.current = true;
    setStatus("saving");
    setError(null);
    dirty.current = false;
    const { data, error: e } = await sprintDb()
      .from("hackathon_team_docs")
      .update({ content: text, title: t })
      .eq("id", doc.id)
      .eq("updated_at", known.current)
      .select("updated_at");
    saving.current = false;
    if (e) {
      dirty.current = true;
      setStatus("unsaved");
      setError(roomError(e));
      return;
    }
    if (!data || data.length === 0) {
      // Someone saved first: their version is newer than the one we started from.
      dirty.current = true;
      setStatus("unsaved");
      await loadConflict();
      return;
    }
    known.current = (data[0] as { updated_at: string }).updated_at;
    setSavedAt(known.current);
    setStatus(dirty.current ? "unsaved" : "saved");
  }

  async function loadConflict() {
    const { data } = await sprintDb()
      .from("hackathon_team_docs")
      .select("content, title, updated_at, updated_by")
      .eq("id", doc.id)
      .single();
    if (data) setConflict({ by: data.updated_by, content: data.content, title: data.title, updated_at: data.updated_at });
  }

  function takeTheirs(c: Conflict) {
    editorRef.current?.commands.setContent(parseContent(c.content), { emitUpdate: false });
    setTitle(c.title);
    known.current = c.updated_at;
    setSavedAt(c.updated_at);
    dirty.current = false;
    setStatus("saved");
    setConflict(null);
  }

  function keepMine(c: Conflict) {
    known.current = c.updated_at;
    setConflict(null);
    void save(true);
  }

  // A teammate saved this doc.
  useEffect(() => {
    if (!remote || parseDbTime(remote.updated_at).getTime() === parseDbTime(known.current).getTime()) return;
    if (remote.updated_by === viewerId) return; // our own save, echoed back
    if (dirty.current || saving.current) {
      void loadConflict();
      return;
    }
    (async () => {
      const { data } = await sprintDb()
        .from("hackathon_team_docs")
        .select("content, title, updated_at")
        .eq("id", doc.id)
        .single();
      if (!data || dirty.current) return;
      editorRef.current?.commands.setContent(parseContent(data.content), { emitUpdate: false });
      setTitle(data.title);
      known.current = data.updated_at;
      setSavedAt(data.updated_at);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote]);

  // Leaving with unsaved changes: save them on the way out.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current) void save();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const hairline = "1px solid rgba(255, 255, 255, 0.06)";
  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "unsaved"
        ? "Unsaved changes"
        : Date.now() - parseDbTime(savedAt).getTime() < 15_000
          ? "Saved just now"
          : `Saved ${timeAgo(savedAt)} ago`;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={async () => {
          if (timer.current) clearTimeout(timer.current);
          await save();
          onClose();
        }}
        className={ui.textBtn}
        style={{ fontSize: 12.5 }}
      >
        ← All docs
      </button>

      {conflict && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 flex-wrap"
          style={{ border: "1px solid rgba(245, 158, 11, 0.4)", background: "rgba(245, 158, 11, 0.08)", borderRadius: 12, padding: "10px 14px" }}
        >
          <p style={{ fontSize: 13, color: "var(--text-primary)" }}>
            {nameOf(conflict.by)} saved a newer version while you were editing.
          </p>
          <div className="flex items-center gap-3">
            <button type="button" className={ui.textBtn} style={{ fontSize: 12.5 }} onClick={() => keepMine(conflict)}>
              Keep mine
            </button>
            <button type="button" className={ui.softBtn} onClick={() => takeTheirs(conflict)}>
              Load theirs
            </button>
          </div>
        </div>
      )}

      <div
        className={`${ui.editor} min-h-[480px] md:min-h-[600px] flex flex-col relative`}
        style={{ background: "var(--bg-surface)", border: "1px solid rgba(255, 255, 255, 0.07)", borderRadius: 12 }}
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3" style={{ borderBottom: hairline }}>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            readOnly={!writable}
            maxLength={200}
            placeholder="Untitled doc"
            aria-label="Doc title"
            className="flex-1 min-w-0 bg-transparent placeholder:text-text-muted focus:outline-none"
            style={{
              fontSize: 19,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              border: "none",
              background: "transparent",
              padding: 0,
              boxShadow: "none",
            }}
          />
          <span className="shrink-0" style={{ fontSize: 11.5, color: status === "unsaved" ? "#f8c56a" : "var(--text-muted)" }}>
            {writable ? statusText : "Read-only"}
          </span>
        </div>

        {editor && writable && <EditorToolbar editor={editor} />}

        <div className="flex-1 overflow-y-auto scroll-thin relative">
          <EditorContent editor={editor} />
          {slashMenu}
        </div>

        <div className="px-6 py-3 flex items-center justify-between gap-2" style={{ borderTop: hairline }}>
          <span style={META}>
            {doc.updated_by ? `Last edited by ${nameOf(doc.updated_by)}` : `Started by ${nameOf(doc.created_by)}`}
          </span>
          <span className="shrink-0" style={META}>
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
        </div>
      </div>
      {error && <p style={{ fontSize: 12, color: "#f87171" }}>{error}</p>}
    </div>
  );
}
