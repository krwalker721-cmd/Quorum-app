"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import { NOTE_TAGS, type NoteRow } from "@/lib/vault";
import ui from "@/components/ui/sleek.module.css";
import { EditorToolbar, useRichEditor } from "@/components/editor/RichTextEditor";

function relativeTime(date: Date | null) {
  if (!date) return "";
  const diff = Math.max(0, Date.now() - date.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "Saved just now";
  if (sec < 60) return `Saved ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Saved ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Saved ${hr}h ago`;
  return `Saved ${Math.floor(hr / 24)}d ago`;
}

export default function NoteEditor({
  note,
  onLocalChange,
}: {
  note: NoteRow;
  onLocalChange: (patch: Partial<NoteRow>) => void;
}) {
  const [title, setTitle] = useState(note.title ?? "");
  const [tags, setTags] = useState<string[]>(note.tags ?? []);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedLabel, setSavedLabel] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstContent = useRef(true);
  const skipFirstTitleTags = useRef(true);

  // Tiptap content stored as JSON (ProseMirror doc). For backwards compatibility
  // with the legacy block-array shape, convert if needed on first load.
  const initialContent = useMemo(() => convertLegacyIfNeeded(note.content), [note.id]);

  const { editor, editorRef, slashMenu, wordCount } = useRichEditor({
    content: initialContent,
    onChange: () => scheduleSave(),
  });

  function scheduleSave() {
    if (skipFirstContent.current) {
      skipFirstContent.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1000);
  }

  async function save() {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed) return;
    let content: unknown;
    try {
      content = ed.getJSON();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[note editor] getJSON failed", e);
      return;
    }
    try {
      const res = await fetch("/api/vault/notes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: note.id, title, content, tags }),
      });
      if (res.ok) {
        setLastSavedAt(new Date());
        try {
          onLocalChange({ title, content: content as any, tags });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[note editor] onLocalChange failed", e);
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn("[note editor] save returned", res.status);
      }
    } catch (e) {
      // Network / fetch error — never let it propagate.
      // eslint-disable-next-line no-console
      console.warn("[note editor] save failed", e);
    }
  }

  // Save when title/tags change too
  useEffect(() => {
    if (skipFirstTitleTags.current) {
      skipFirstTitleTags.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, tags.join("|")]);

  // Globally catch unhandled rejections coming from this editor so we can
  // surface them in DevTools instead of letting them bubble to the Next.js
  // overlay. (Error boundaries don't catch async errors.)
  useEffect(() => {
    function onRej(ev: PromiseRejectionEvent) {
      // eslint-disable-next-line no-console
      console.warn("[note editor] unhandled rejection:", ev.reason);
    }
    function onErr(ev: ErrorEvent) {
      // eslint-disable-next-line no-console
      console.warn("[note editor] window error:", ev.message, ev.error);
    }
    window.addEventListener("unhandledrejection", onRej);
    window.addEventListener("error", onErr);
    return () => {
      window.removeEventListener("unhandledrejection", onRej);
      window.removeEventListener("error", onErr);
    };
  }, []);

  // Tick the "saved Xm ago" label
  useEffect(() => {
    const t = setInterval(() => setSavedLabel(relativeTime(lastSavedAt)), 15_000);
    setSavedLabel(relativeTime(lastSavedAt));
    return () => clearInterval(t);
  }, [lastSavedAt]);

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const hairline = "1px solid rgba(255, 255, 255, 0.06)";

  return (
    <div
      className={`${ui.editor} min-h-[480px] md:min-h-[600px] h-full flex flex-col relative`}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid rgba(255, 255, 255, 0.07)",
        borderRadius: 12,
      }}
    >
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3" style={{ borderBottom: hairline }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          placeholder="Untitled note"
          aria-label="Note title"
          className="flex-1 min-w-0 bg-transparent placeholder:text-text-muted focus:outline-none"
          // The global input style adds a box; the title reads as a heading.
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
        <span className="shrink-0" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          {savedLabel}
        </span>
      </div>

      {editor && <EditorToolbar editor={editor} />}

      <div className="flex-1 overflow-y-auto scroll-thin relative">
        <EditorContent editor={editor} />

        {slashMenu}
      </div>

      <div className="px-6 py-3 flex items-center justify-between gap-2" style={{ borderTop: hairline }}>
        <div className="flex items-center flex-wrap gap-1.5">
          {tags.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => toggleTag(t)}
              className={`${ui.chip} ${ui.chipAmber}`}
              aria-label={`Remove tag ${t}`}
            >
              {t} ×
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTagPickerOpen((v) => !v)}
              className={`${ui.chip} hover:text-text-primary`}
              aria-expanded={tagPickerOpen}
            >
              + Tag
            </button>
            {tagPickerOpen && (
              <div className={`absolute bottom-full left-0 mb-1 z-30 min-w-[160px] ${ui.menu}`}>
                {NOTE_TAGS.filter((t) => !tags.includes(t)).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => {
                      toggleTag(t);
                      setTagPickerOpen(false);
                    }}
                    className={ui.menuItem}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <span className="shrink-0" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
      </div>
    </div>
  );
}

/**
 * Older notes were stored as an array of { id, type, text } blocks. Tiptap
 * expects a ProseMirror JSON doc. Convert when needed.
 */
function convertLegacyIfNeeded(content: any) {
  if (!content) return { type: "doc", content: [{ type: "paragraph" }] };
  if (Array.isArray(content)) {
    const nodes: any[] = [];
    for (const b of content) {
      const text = b?.text ?? "";
      const para = (t: string) =>
        t.length > 0
          ? { type: "paragraph", content: [{ type: "text", text: t }] }
          : { type: "paragraph" };
      switch (b?.type) {
        case "h1":
          nodes.push({ type: "heading", attrs: { level: 1 }, content: text ? [{ type: "text", text }] : undefined });
          break;
        case "h2":
          nodes.push({ type: "heading", attrs: { level: 2 }, content: text ? [{ type: "text", text }] : undefined });
          break;
        case "bullet":
          nodes.push({
            type: "bulletList",
            content: [{ type: "listItem", content: [para(text)] }],
          });
          break;
        case "numbered":
          nodes.push({
            type: "orderedList",
            content: [{ type: "listItem", content: [para(text)] }],
          });
          break;
        case "quote":
          nodes.push({ type: "blockquote", content: [para(text)] });
          break;
        case "code":
          nodes.push({
            type: "codeBlock",
            content: text ? [{ type: "text", text }] : undefined,
          });
          break;
        case "divider":
          nodes.push({ type: "horizontalRule" });
          break;
        case "text":
        default:
          nodes.push(para(text));
      }
    }
    if (nodes.length === 0) nodes.push({ type: "paragraph" });
    return { type: "doc", content: nodes };
  }
  // Assume already-Tiptap JSON
  return content;
}
