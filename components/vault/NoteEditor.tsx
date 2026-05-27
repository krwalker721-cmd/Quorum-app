"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { CharacterCount } from "@tiptap/extension-character-count";
import { NOTE_TAGS, type NoteRow } from "@/lib/vault";

// Slash-menu entry points. Each runs a chain on the editor.
type SlashItem = {
  key: string;
  label: string;
  run: (e: Editor) => void;
};

const SLASH_ITEMS: SlashItem[] = [
  { key: "text", label: "text", run: (e) => e.chain().focus().setParagraph().run() },
  { key: "h1", label: "heading 1", run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { key: "h2", label: "heading 2", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { key: "h3", label: "heading 3", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { key: "bullet", label: "bullet list", run: (e) => e.chain().focus().toggleBulletList().run() },
  { key: "numbered", label: "numbered list", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { key: "checklist", label: "checklist", run: (e) => e.chain().focus().toggleTaskList().run() },
  { key: "quote", label: "quote", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { key: "code", label: "code block", run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { key: "divider", label: "divider", run: (e) => e.chain().focus().setHorizontalRule().run() },
  {
    key: "callout",
    label: "callout",
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

const TEXT_COLORS: { key: string; value: string; label: string }[] = [
  { key: "white", value: "#e6edf3", label: "white" },
  { key: "muted", value: "#8b949e", label: "muted" },
  { key: "amber", value: "#f59e0b", label: "amber" },
  { key: "green", value: "#22c55e", label: "green" },
  { key: "blue", value: "#58a6ff", label: "blue" },
  { key: "red", value: "#f87171", label: "red" },
];

function relativeTime(date: Date | null) {
  if (!date) return "";
  const diff = Math.max(0, Date.now() - date.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "saved just now";
  if (sec < 60) return `saved ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `saved ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `saved ${hr}h ago`;
  return `saved ${Math.floor(hr / 24)}d ago`;
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
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: "" } },
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "type / for blocks, or just start writing..." }),
      CharacterCount.configure({}),
    ],
    content: initialContent,
    autofocus: false,
    editorProps: {
      attributes: { class: "tiptap" },
      handleKeyDown(view, event) {
        // Cmd/Ctrl+K → wrap selection in a link
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          const url = window.prompt("link url");
          if (url) {
            editorRef.current?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor: ed }) {
      // Detect slash trigger at start of an empty block
      const { from } = ed.state.selection;
      const before = ed.state.doc.textBetween(Math.max(0, from - 1), from, "\n", "\0");
      if (before === "/") {
        const coords = ed.view.coordsAtPos(from);
        setSlashCoords({ top: coords.bottom + 4, left: coords.left });
        setSlashOpen(true);
      } else {
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
    if (!ed) return;
    const content = ed.getJSON();
    const res = await fetch("/api/vault/notes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: note.id, title, content, tags }),
    });
    if (res.ok) {
      setLastSavedAt(new Date());
      onLocalChange({ title, content: content as any, tags });
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
    if (!ed) return;
    // Remove the trailing "/" character before applying the block change.
    const { from } = ed.state.selection;
    ed.chain()
      .focus()
      .deleteRange({ from: from - 1, to: from })
      .run();
    item.run(ed);
    setSlashOpen(false);
  }

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const wordCount = editor?.storage.characterCount.words() ?? 0;

  return (
    <div
      className="border min-h-[600px] h-full flex flex-col relative"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div
        className="flex items-center justify-between px-6 pt-5 pb-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          placeholder="untitled note"
          className="flex-1 bg-transparent font-sans font-bold text-2xl lowercase text-text-primary placeholder:text-text-faint focus:outline-none"
        />
        <span
          className="font-mono lowercase text-[0.6rem] ml-4"
          style={{ color: "var(--text-faint)" }}
        >
          {savedLabel}
        </span>
      </div>

      {editor && (
        <Toolbar editor={editor} />
      )}

      <div className="flex-1 overflow-y-auto scroll-thin relative">
        <EditorContent editor={editor} />

        {slashOpen && slashCoords && (
          <div
            ref={slashRef}
            className="fixed z-40 min-w-[200px] border"
            style={{
              top: slashCoords.top,
              left: slashCoords.left,
              background: "var(--card-elev)",
              borderColor: "var(--border)",
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {SLASH_ITEMS.map((it) => (
              <button
                key={it.key}
                onClick={() => pickSlash(it)}
                className="block w-full text-left font-mono lowercase text-[0.7rem] text-text-muted hover:text-text-primary px-3 py-1.5"
              >
                {it.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="px-6 py-3 border-t flex items-center justify-between gap-2"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center flex-wrap gap-1.5">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
              style={{
                border: "1px solid rgba(245, 158, 11,0.4)",
                color: "#f59e0b",
                background: "rgba(245, 158, 11,0.06)",
              }}
            >
              {t} ×
            </button>
          ))}
          <div className="relative">
            <button
              onClick={() => setTagPickerOpen((v) => !v)}
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5 border text-text-faint hover:text-text-muted"
              style={{ borderColor: "var(--border)" }}
            >
              + tag
            </button>
            {tagPickerOpen && (
              <div
                className="absolute bottom-full left-0 mb-1 z-30 min-w-[160px] border p-1"
                style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
              >
                {NOTE_TAGS.filter((t) => !tags.includes(t)).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      toggleTag(t);
                      setTagPickerOpen(false);
                    }}
                    className="block w-full text-left font-mono lowercase text-[0.65rem] text-text-muted hover:text-text-primary px-2 py-1"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <span
          className="font-mono lowercase text-[0.6rem]"
          style={{ color: "var(--text-faint)" }}
        >
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [colorOpen, setColorOpen] = useState(false);

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
        className={`toolbar-btn ${isActive ? "active" : ""}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="editor-toolbar mx-6 mt-3">
      {btn("B", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Bold (Cmd/Ctrl+B)")}
      {btn("I", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Italic (Cmd/Ctrl+I)")}
      {btn("U", editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "Underline (Cmd/Ctrl+U)")}
      {btn("S", editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "Strikethrough")}
      {btn("</>", editor.isActive("code"), () => editor.chain().focus().toggleCode().run(), "Inline code")}
      <span className="toolbar-divider" />
      {btn("H1", editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
      {btn("H2", editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      {btn("H3", editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
      <span className="toolbar-divider" />
      {btn("•", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "Bullet list")}
      {btn("1.", editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "Numbered list")}
      {btn("☑", editor.isActive("taskList"), () => editor.chain().focus().toggleTaskList().run(), "Checklist")}
      {btn("\"", editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "Quote")}
      {btn("{ }", editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run(), "Code block")}
      {btn("—", false, () => editor.chain().focus().setHorizontalRule().run(), "Divider")}
      <span className="toolbar-divider" />
      {btn("🖍", editor.isActive("highlight"), () => editor.chain().focus().toggleHighlight().run(), "Highlight")}
      <div className="relative">
        <button
          type="button"
          onClick={() => setColorOpen((v) => !v)}
          className="toolbar-btn"
          title="text color"
        >
          A▾
        </button>
        {colorOpen && (
          <div
            className="absolute top-full mt-1 right-0 z-40 border p-1 flex gap-1"
            style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
          >
            {TEXT_COLORS.map((c) => (
              <button
                key={c.key}
                title={c.label}
                onClick={() => {
                  editor.chain().focus().setColor(c.value).run();
                  setColorOpen(false);
                }}
                className="w-5 h-5 border"
                style={{ background: c.value, borderColor: "var(--border)" }}
              />
            ))}
            <button
              title="clear"
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setColorOpen(false);
              }}
              className="w-5 h-5 border font-mono text-[0.55rem]"
              style={{ background: "transparent", borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              ×
            </button>
          </div>
        )}
      </div>
      <span className="toolbar-divider" />
      {btn(
        "link",
        editor.isActive("link"),
        () => {
          const url = window.prompt("link url", editor.getAttributes("link").href ?? "");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
          } else {
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }
        },
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
