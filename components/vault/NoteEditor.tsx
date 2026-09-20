"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import { CharacterCount } from "@tiptap/extension-character-count";
import { NOTE_TAGS, type NoteRow } from "@/lib/vault";
import ui from "@/components/ui/sleek.module.css";

// Slash-menu entry points. Each runs a chain on the editor.
type SlashItem = {
  key: string;
  label: string;
  run: (e: Editor) => void;
};

const SLASH_ITEMS: SlashItem[] = [
  { key: "text", label: "Text", run: (e) => e.chain().focus().setParagraph().run() },
  { key: "h1", label: "Heading 1", run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { key: "h2", label: "Heading 2", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { key: "h3", label: "Heading 3", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { key: "bullet", label: "Bullet list", run: (e) => e.chain().focus().toggleBulletList().run() },
  { key: "numbered", label: "Numbered list", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { key: "checklist", label: "Checklist", run: (e) => e.chain().focus().toggleTaskList().run() },
  { key: "quote", label: "Quote", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { key: "code", label: "Code block", run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { key: "divider", label: "Divider", run: (e) => e.chain().focus().setHorizontalRule().run() },
  {
    key: "callout",
    label: "Callout",
    run: (e) =>
      e
        .chain()
        .focus()
        .insertContent({
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "💡 " }],
            },
          ],
        })
        .run(),
  },
];

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
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashCoords, setSlashCoords] = useState<{ top: number; left: number } | null>(null);
  const slashRef = useRef<HTMLDivElement>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstContent = useRef(true);
  const skipFirstTitleTags = useRef(true);

  // Tiptap content stored as JSON (ProseMirror doc). For backwards compatibility
  // with the legacy block-array shape, convert if needed on first load.
  const initialContent = useMemo(() => convertLegacyIfNeeded(note.content), [note.id]);

  const editor = useEditor({
    // Tiptap v3 + Next.js SSR: without this we get a hydration mismatch that
    // surfaces as "client-side exception" once hydration runs.
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      // StarterKit v3 bundles bold/italic/underline/strike/headings/lists/code/
      // blockquote/hr/link — configure link here instead of adding twice.
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: "" } },
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Type / for blocks, or just start writing…" }),
      CharacterCount.configure({}),
    ],
    content: initialContent,
    autofocus: false,
    editorProps: {
      attributes: { class: "tiptap" },
      handleKeyDown(_view, event) {
        // Cmd/Ctrl+K → wrap selection in a link
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          const url = window.prompt("Link URL");
          if (url) {
            editorRef.current?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor: ed }) {
      try {
        const { from } = ed.state.selection;
        const before = ed.state.doc.textBetween(Math.max(0, from - 1), from, "\n", "\0");
        if (before === "/") {
          const coords = ed.view.coordsAtPos(from);
          setSlashCoords({ top: coords.bottom + 4, left: coords.left });
          setSlashOpen(true);
        } else {
          setSlashOpen(false);
        }
      } catch {
        // coordsAtPos can throw during transitions; ignore.
        setSlashOpen(false);
      }
      scheduleSave();
    },
  });

  // Keep latest editor in a ref for keyboard handlers.
  const editorRef = useRef<Editor | null>(null);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

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

  // Close slash menu on click outside
  useEffect(() => {
    if (!slashOpen) return;
    function onDoc(e: MouseEvent) {
      if (!slashRef.current?.contains(e.target as Node)) setSlashOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [slashOpen]);

  function pickSlash(item: SlashItem) {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed) return;
    try {
      const { from } = ed.state.selection;
      if (from > 0) {
        ed.chain()
          .focus()
          .deleteRange({ from: from - 1, to: from })
          .run();
      }
      item.run(ed);
    } catch {
      // ignore — fall through to closing the menu
    }
    setSlashOpen(false);
  }

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  let wordCount = 0;
  try {
    const fromCC = editor?.storage?.characterCount?.words?.();
    if (typeof fromCC === "number") {
      wordCount = fromCC;
    } else {
      const text = editor?.getText() ?? "";
      wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    }
  } catch {
    wordCount = 0;
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

      {editor && <Toolbar editor={editor} />}

      <div className="flex-1 overflow-y-auto scroll-thin relative">
        <EditorContent editor={editor} />

        {slashOpen && slashCoords && (
          <div
            ref={slashRef}
            className={`fixed z-40 min-w-[200px] ${ui.menu}`}
            style={{
              top: slashCoords.top,
              left: slashCoords.left,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {SLASH_ITEMS.map((it) => (
              <button type="button" key={it.key} onClick={() => pickSlash(it)} className={ui.menuItem}>
                {it.label}
              </button>
            ))}
          </div>
        )}
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

function Toolbar({ editor }: { editor: Editor }) {
  function safeRun(fn: () => void) {
    return () => {
      try {
        fn();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[note editor] toolbar action failed:", e);
      }
    };
  }
  function safeActive(name: string, attrs?: Record<string, unknown>) {
    try {
      return editor.isActive(name, attrs as any);
    } catch {
      return false;
    }
  }

  function btn(
    label: string,
    isActive: boolean | undefined,
    onClick: () => void,
    title?: string,
  ) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        aria-pressed={!!isActive}
        className={`toolbar-btn ${isActive ? "active" : ""}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="editor-toolbar mx-6 mt-3">
      {btn("B", safeActive("bold"), safeRun(() => editor.chain().focus().toggleBold().run()), "Bold (Cmd/Ctrl+B)")}
      {btn("I", safeActive("italic"), safeRun(() => editor.chain().focus().toggleItalic().run()), "Italic (Cmd/Ctrl+I)")}
      {btn("U", safeActive("underline"), safeRun(() => editor.chain().focus().toggleUnderline().run()), "Underline (Cmd/Ctrl+U)")}
      {btn("S", safeActive("strike"), safeRun(() => editor.chain().focus().toggleStrike().run()), "Strikethrough")}
      {btn("</>", safeActive("code"), safeRun(() => editor.chain().focus().toggleCode().run()), "Inline code")}
      <span className="toolbar-divider" />
      {btn("H1", safeActive("heading", { level: 1 }), safeRun(() => editor.chain().focus().toggleHeading({ level: 1 }).run()), "Heading 1")}
      {btn("H2", safeActive("heading", { level: 2 }), safeRun(() => editor.chain().focus().toggleHeading({ level: 2 }).run()), "Heading 2")}
      {btn("H3", safeActive("heading", { level: 3 }), safeRun(() => editor.chain().focus().toggleHeading({ level: 3 }).run()), "Heading 3")}
      <span className="toolbar-divider" />
      {btn("•", safeActive("bulletList"), safeRun(() => editor.chain().focus().toggleBulletList().run()), "Bullet list")}
      {btn("1.", safeActive("orderedList"), safeRun(() => editor.chain().focus().toggleOrderedList().run()), "Numbered list")}
      {btn("\"", safeActive("blockquote"), safeRun(() => editor.chain().focus().toggleBlockquote().run()), "Quote")}
      {btn("{ }", safeActive("codeBlock"), safeRun(() => editor.chain().focus().toggleCodeBlock().run()), "Code block")}
      {btn("—", false, safeRun(() => editor.chain().focus().setHorizontalRule().run()), "Divider")}
      <span className="toolbar-divider" />
      {btn(
        "Link",
        safeActive("link"),
        safeRun(() => {
          const url = window.prompt("Link URL", editor.getAttributes("link").href ?? "");
          if (url === null) return;
          if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
          else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }),
        "Link (Cmd/Ctrl+K)",
      )}
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
