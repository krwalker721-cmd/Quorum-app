"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import s from "./liveStage.module.css";

// The live Sprint's stage (owner's option B): the stadium takes the stage and
// the Sprint chat lives in a drawer on its right. Drag the handle to give the
// chat more room (the arena shrinks) or less; close it to give the arena the
// whole stage, and a tab says how many messages came in meanwhile. On a phone
// the chat opens over the arena. The width and open/closed are remembered in
// this browser only (a convenience; nothing depends on it).

type StageSignal = {
  /** The chat fills the drawer's height instead of its own. */
  inDrawer: boolean;
  /** Controls for the chat's header: wider, narrower, close. */
  controls: ReactNode;
  /** The chat reports each message someone else sent. */
  onIncoming: () => void;
};

const StageContext = createContext<StageSignal | null>(null);

/** For the Sprint chat: whether it's in the stage's drawer, and its controls. */
export function useStage() {
  return useContext(StageContext);
}

const KEY = "buildathon.stage";
const HINT_KEY = "buildathon.stage.resized";
const CHAT_MIN = 320; // the chat never gets narrower than a phone screen
const ARENA_MIN = 460; // nor the arena narrower than its compact layout needs
const HANDLE = 18;
const DEFAULT_W = 380;

type Size = "arena" | "even" | "chat";
const SIZES: { key: Size; label: string; title: string }[] = [
  { key: "arena", label: "Arena", title: "Most of the stage for the arena" },
  { key: "even", label: "Even", title: "Half and half" },
  { key: "chat", label: "Chat", title: "Most of the stage for the chat" },
];

function readSaved(key: string): { open: boolean; width: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return v && typeof v.open === "boolean" && typeof v.width === "number" ? v : null;
  } catch {
    return null;
  }
}
function saveTo(key: string, v: { open: boolean; width: number }) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // Private window or blocked storage: the stage just won't remember.
  }
}

export default function LiveStage({
  arena,
  chat,
  storageKey = "live",
  startEven = false,
}: {
  arena: ReactNode;
  chat: ReactNode;
  /** Each page remembers its own split ("live", "recap"). */
  storageKey?: string;
  /** With nothing remembered, start half and half (the recap, where the chat leads). */
  startEven?: boolean;
}) {
  const key = `${KEY}.${storageKey}`;
  const save = (v: { open: boolean; width: number }) => saveTo(key, v);
  const savedRef = useRef<{ open: boolean; width: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(DEFAULT_W);
  const [phone, setPhone] = useState(false);
  const [unread, setUnread] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [stageW, setStageW] = useState(0);
  const [hint, setHint] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  // Phones open the chat over the arena, and start with it closed.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setPhone(mq.matches);
    apply();
    const saved = readSaved(key);
    savedRef.current = saved;
    if (mq.matches) setOpen(false);
    else if (saved) {
      setOpen(saved.open);
      setWidth(saved.width);
    }
    mq.addEventListener("change", apply);
    try {
      setHint(!localStorage.getItem(HINT_KEY));
    } catch {
      setHint(false);
    }
    return () => mq.removeEventListener("change", apply);
  }, []);

  // The stage's width, so the chat's size stays within what leaves the arena room.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    setStageW(el.clientWidth);
    // Nothing remembered and asked to start even: half and half.
    if (startEven && !savedRef.current && el.clientWidth > 0) setWidth(Math.round((el.clientWidth - HANDLE) / 2));
    return () => ro.disconnect();
  }, [startEven]);

  const maxWidth = useCallback(() => Math.max(CHAT_MIN, (stageW || 1000) - HANDLE - ARENA_MIN), [stageW]);
  const clamp = useCallback((w: number) => Math.round(Math.min(maxWidth(), Math.max(CHAT_MIN, w))), [maxWidth]);
  const shown = clamp(width);
  const presetWidth = (size: Size) =>
    size === "arena" ? CHAT_MIN + 40 : size === "chat" ? maxWidth() : clamp(((stageW || 1000) - HANDLE) / 2);
  const activeSize = SIZES.find((x) => Math.abs(presetWidth(x.key) - shown) < 24)?.key ?? null;

  const resized = () => {
    setHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      // Fine: the hint shows again next time.
    }
  };

  const setOpenAndSave = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) setUnread(0);
      if (!phone) save({ open: next, width });
    },
    [phone, width],
  );

  // Dragging the handle: the chat's width follows the pointer.
  const onHandleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragging || !stage.current) return;
    const r = stage.current.getBoundingClientRect();
    setWidth(clamp(r.right - e.clientX));
  };
  const onHandleUp = () => {
    if (!dragging) return;
    setDragging(false);
    save({ open: true, width: shown });
    resized();
  };
  const setSize = (w: number) => {
    const next = clamp(w);
    setWidth(next);
    save({ open: true, width: next });
    resized();
  };

  const controls = (
    <span className={s.controls}>
      {!phone && (
        <span className={s.sizes} role="group" aria-label="Chat size">
          {SIZES.map((x) => (
            <button
              key={x.key}
              type="button"
              className={activeSize === x.key ? s.sizeOn : undefined}
              aria-pressed={activeSize === x.key}
              title={x.title}
              onClick={() => setSize(presetWidth(x.key))}
            >
              {x.label}
            </button>
          ))}
        </span>
      )}
      <button type="button" className={s.close} onClick={() => setOpenAndSave(false)} aria-label="Close the chat" title="Close the chat">
        ×
      </button>
    </span>
  );

  const signal: StageSignal = {
    inDrawer: true,
    controls,
    onIncoming: () => {
      if (!openRef.current) setUnread((n) => n + 1);
    },
  };

  return (
    <div ref={stage} className={`${s.stage} ${dragging ? s.dragging : ""}`}>
      <div className={s.arena}>{arena}</div>

      {open && !phone && (
        <div
          className={s.handle}
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize the chat"
          tabIndex={0}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          title="Drag to resize"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setSize(shown + 40);
            if (e.key === "ArrowRight") setSize(shown - 40);
          }}
        >
          <span className={s.grip} aria-hidden>
            <span className={s.gripArrows}>‹›</span>
          </span>
          {hint && (
            <span className={s.hint} aria-hidden>
              Drag to resize
            </span>
          )}
        </div>
      )}

      {/* The chat stays mounted while closed, so it keeps counting what comes in. */}
      <div
        className={`${s.drawer} ${phone ? s.sheet : ""}`}
        style={open ? (phone ? undefined : { width: shown }) : { display: "none" }}
        aria-hidden={!open}
      >
        <StageContext.Provider value={signal}>{chat}</StageContext.Provider>
      </div>

      {!open && (
        <button type="button" className={s.tab} onClick={() => setOpenAndSave(true)}>
          <span>Chat</span>
          {unread > 0 && <span className={s.unread}>{unread} new</span>}
        </button>
      )}
    </div>
  );
}
