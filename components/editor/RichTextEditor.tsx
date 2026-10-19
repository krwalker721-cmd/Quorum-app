"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditor } from "@tiptap/react";
import { Editor, type Content } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import { CharacterCount } from "@tiptap/extension-character-count";
import ui from "@/components/ui/sleek.module.css";

// The full editor (Tiptap): toolbar, slash menu, Cmd/Ctrl+K links, word
// count. Moved here unchanged from the Vault's NoteEditor so the Hackathon
// team room's docs can use it too. Each user lays out its own frame (title,
// save state, footer) around these pieces.

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

/**
 * The editor and its slash menu. `onChange` runs after every edit; render
 * `slashMenu` next to <EditorContent> (it positions itself).
 */
export function useRichEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Type / for blocks, or just start writing…",
}: {
  content: Content;
  onChange?: () => void;
  editable?: boolean;
  placeholder?: string;
}): { editor: Editor | null; editorRef: React.MutableRefObject<Editor | null>; slashMenu: ReactNode; wordCount: number } {
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashCoords, setSlashCoords] = useState<{ top: number; left: number } | null>(null);
  const slashRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    // Tiptap v3 + Next.js SSR: without this we get a hydration mismatch that
    // surfaces as "client-side exception" once hydration runs.
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable,
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
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({}),
    ],
    content,
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
      onChange?.();
    },
  });

  // Keep latest editor in a ref for keyboard handlers.
  const editorRef = useRef<Editor | null>(null);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Locking and unlocking (a room closing while it's open).
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

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

  const slashMenu =
    slashOpen && slashCoords ? (
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
    ) : null;

  return { editor, editorRef, slashMenu, wordCount };
}

export function EditorToolbar({ editor }: { editor: Editor }) {
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
