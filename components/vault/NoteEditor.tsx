"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BLOCK_TYPES,
  NOTE_TAGS,
  type BlockType,
  type NoteRow,
} from "@/lib/vault";

type Block = { id: string; type: BlockType; text?: string };

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const BLOCK_LABEL: Record<BlockType, string> = {
  text: "text",
  h1: "heading 1",
  h2: "heading 2",
  bullet: "bullet list",
  numbered: "numbered list",
  divider: "divider",
  quote: "quote",
  code: "code",
};

export default function NoteEditor({
  note,
  onLocalChange,
}: {
  note: NoteRow;
  onLocalChange: (patch: Partial<NoteRow>) => void;
}) {
  const [title, setTitle] = useState(note.title ?? "");
  const [blocks, setBlocks] = useState<Block[]>(() => {
    const c = Array.isArray(note.content) && note.content.length > 0
      ? note.content
      : [{ type: "text" as BlockType, text: "" }];
    return c.map((b) => ({ id: b.id ?? uid(), type: b.type, text: b.text ?? "" }));
  });
  const [tags, setTags] = useState<string[]>(note.tags ?? []);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [slashFor, setSlashFor] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirst = useRef(true);

  // debounced auto-save
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const res = await fetch("/api/vault/notes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: note.id, title, content: blocks, tags }),
      });
      if (res.ok) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1200);
        onLocalChange({ title, content: blocks, tags });
      }
    }, 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, blocks, tags]);

  function updateBlock(id: string, patch: Partial<Block>) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function insertBlockAfter(id: string, type: BlockType = "text") {
    setBlocks((bs) => {
      const idx = bs.findIndex((b) => b.id === id);
      const fresh: Block = { id: uid(), type, text: "" };
      const next = [...bs];
      next.splice(idx + 1, 0, fresh);
      return next;
    });
  }
  function removeBlock(id: string) {
    setBlocks((bs) => (bs.length <= 1 ? bs : bs.filter((b) => b.id !== id)));
  }
  function changeBlockType(id: string, type: BlockType) {
    updateBlock(id, { type, text: type === "divider" ? "" : undefined });
    setSlashFor(null);
  }
  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <div
      className="border min-h-[600px] h-full flex flex-col"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="untitled note"
          className="flex-1 bg-transparent font-sans text-2xl lowercase text-text-primary placeholder:text-text-faint focus:outline-none"
        />
        <span
          className="font-mono lowercase text-[0.6rem] transition-opacity"
          style={{ color: "var(--text-faint)", opacity: savedFlash ? 1 : 0 }}
        >
          saved
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5 space-y-1.5">
        {blocks.map((block) => (
          <BlockRow
            key={block.id}
            block={block}
            onChange={(text) => updateBlock(block.id, { text })}
            onEnter={() => insertBlockAfter(block.id)}
            onBackspaceEmpty={() => removeBlock(block.id)}
            onSlashOpen={() => setSlashFor(block.id)}
            onMoveUp={() => moveBlock(block.id, -1)}
            onMoveDown={() => moveBlock(block.id, 1)}
            slashOpen={slashFor === block.id}
            onPickType={(t) => changeBlockType(block.id, t)}
            onCloseSlash={() => setSlashFor(null)}
          />
        ))}
      </div>

      <div className="px-6 py-3 border-t flex items-center flex-wrap gap-1.5" style={{ borderColor: "var(--border)" }}>
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
            +
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
    </div>
  );
}

function BlockRow({
  block,
  onChange,
  onEnter,
  onBackspaceEmpty,
  onSlashOpen,
  onMoveUp,
  onMoveDown,
  slashOpen,
  onPickType,
  onCloseSlash,
}: {
  block: Block;
  onChange: (text: string) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  onSlashOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  slashOpen: boolean;
  onPickType: (t: BlockType) => void;
  onCloseSlash: () => void;
}) {
  const text = block.text ?? "";

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnter();
      return;
    }
    if (e.key === "Backspace" && text.length === 0) {
      e.preventDefault();
      onBackspaceEmpty();
      return;
    }
    if (e.key === "/" && text.length === 0) {
      e.preventDefault();
      onSlashOpen();
    }
  }

  const sharedClass = "block w-full bg-transparent resize-none focus:outline-none placeholder:text-text-faint";

  if (block.type === "divider") {
    return (
      <div className="group flex items-center gap-2 py-1.5">
        <DragHandle onUp={onMoveUp} onDown={onMoveDown} />
        <div className="flex-1 border-t" style={{ borderColor: "var(--border)" }} />
      </div>
    );
  }

  const Wrap = (inner: React.ReactNode) => (
    <div className="group relative flex items-start gap-2">
      <DragHandle onUp={onMoveUp} onDown={onMoveDown} />
      <div className="flex-1">{inner}</div>
      {slashOpen && <SlashMenu onPick={onPickType} onClose={onCloseSlash} />}
    </div>
  );

  if (block.type === "h1") {
    return Wrap(
      <Auto
        value={text}
        onChange={onChange}
        onKeyDown={handleKey}
        placeholder="heading 1"
        className={`${sharedClass} font-sans font-bold text-2xl text-text-primary py-1`}
      />,
    );
  }
  if (block.type === "h2") {
    return Wrap(
      <Auto
        value={text}
        onChange={onChange}
        onKeyDown={handleKey}
        placeholder="heading 2"
        className={`${sharedClass} font-sans font-bold text-xl text-text-primary py-1`}
      />,
    );
  }
  if (block.type === "bullet") {
    return Wrap(
      <div className="flex gap-2">
        <span className="text-amber pt-0.5">•</span>
        <Auto
          value={text}
          onChange={onChange}
          onKeyDown={handleKey}
          placeholder="list item"
          className={`${sharedClass} text-text-secondary`}
        />
      </div>,
    );
  }
  if (block.type === "numbered") {
    return Wrap(
      <div className="flex gap-2">
        <span className="font-mono text-text-faint pt-0.5">1.</span>
        <Auto
          value={text}
          onChange={onChange}
          onKeyDown={handleKey}
          placeholder="list item"
          className={`${sharedClass} text-text-secondary`}
        />
      </div>,
    );
  }
  if (block.type === "quote") {
    return Wrap(
      <div className="pl-3 italic" style={{ borderLeft: "3px solid #58a6ff" }}>
        <Auto
          value={text}
          onChange={onChange}
          onKeyDown={handleKey}
          placeholder="a quote worth keeping…"
          className={`${sharedClass} text-text-secondary italic`}
        />
      </div>,
    );
  }
  if (block.type === "code") {
    return Wrap(
      <div className="border p-3" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
        <Auto
          value={text}
          onChange={onChange}
          onKeyDown={handleKey}
          placeholder="code or framework…"
          className={`${sharedClass} font-mono text-[0.85rem] text-text-secondary`}
        />
      </div>,
    );
  }
  return Wrap(
    <Auto
      value={text}
      onChange={onChange}
      onKeyDown={handleKey}
      placeholder="write…   ( / for block types )"
      className={`${sharedClass} text-text-secondary leading-relaxed`}
    />,
  );
}

function Auto({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  className: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
    />
  );
}

function SlashMenu({
  onPick,
  onClose,
}: {
  onPick: (t: BlockType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="absolute left-6 top-7 z-40 min-w-[200px] border p-1"
      style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
    >
      {BLOCK_TYPES.map((t) => (
        <button
          key={t}
          onClick={() => onPick(t)}
          className="block w-full text-left font-mono lowercase text-[0.7rem] text-text-muted hover:text-text-primary px-2 py-1.5"
        >
          {BLOCK_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

function DragHandle({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col -ml-5 mt-0.5">
      <button
        type="button"
        onClick={onUp}
        className="text-text-faint hover:text-text-primary leading-none text-[10px]"
        aria-label="move up"
      >

      </button>
      <button
        type="button"
        onClick={onDown}
        className="text-text-faint hover:text-text-primary leading-none text-[10px]"
        aria-label="move down"
      >

      </button>
    </div>
  );
}
