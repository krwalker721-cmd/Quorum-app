"use client";

import { useEffect, useRef, useState } from "react";

export default function PostMenu({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/vault/nominate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post_id: postId, reason }),
      });
      if (res.ok) setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="post menu"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1 text-text-faint hover:text-text-primary"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 min-w-[180px] border"
          style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setModal(true);
              setDone(false);
              setReason("");
            }}
            className="block w-full text-left font-mono lowercase text-[0.7rem] text-text-muted hover:text-text-primary px-3 py-2"
          >
            nominate to vault →
          </button>
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setModal(false)}
        >
          <div
            className="w-full max-w-md border p-6"
            style={{ background: "var(--card-elev)", borderColor: "var(--border-amber)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <>
                <p className="font-mono lowercase text-xs text-amber mb-2">nominated</p>
                <p className="text-text-secondary text-[0.92rem] mb-5">
                  thanks — admins will review it.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setModal(false)}
                    className="font-mono lowercase text-[0.7rem] px-3 py-1.5 border"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    close
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="font-mono lowercase text-xs text-text-faint mb-2">vault_nomination</p>
                <h2 className="font-sans text-text-primary text-lg lowercase mb-4">
                  why should this be in the vault?
                </h2>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="a short reason — what makes this worth preserving?"
                  rows={4}
                  className="w-full bg-transparent border p-3 text-text-secondary text-sm focus:outline-none focus:border-amber"
                  style={{ borderColor: "var(--border)" }}
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setModal(false)}
                    className="font-mono lowercase text-[0.7rem] px-3 py-1.5 border"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={busy || reason.trim().length === 0}
                    className="font-mono lowercase text-[0.7rem] px-3 py-1.5 disabled:opacity-50"
                    style={{ background: "#f59e0b", color: "#000" }}
                  >
                    {busy ? "sending…" : "nominate →"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
