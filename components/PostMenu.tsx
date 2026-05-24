"use client";

import { useEffect, useRef, useState } from "react";

const REPORT_REASONS = ["spam", "inappropriate", "harassment", "misinformation", "other"];

export default function PostMenu({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [nominateModal, setNominateModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [reportReason, setReportReason] = useState("spam");
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function submitNominate() {
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

  async function submitReport() {
    setReportBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post_id: postId, reason: reportReason, note: reportNote }),
      });
      if (res.ok) setReportDone(true);
    } finally {
      setReportBusy(false);
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
              setNominateModal(true);
              setDone(false);
              setReason("");
            }}
            className="block w-full text-left font-mono lowercase text-[0.7rem] text-text-muted hover:text-text-primary px-3 py-2"
          >
            nominate to vault â†’
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setReportModal(true);
              setReportDone(false);
              setReportReason("spam");
              setReportNote("");
            }}
            className="block w-full text-left font-mono lowercase text-[0.7rem] text-text-muted hover:text-text-primary px-3 py-2 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            report post
          </button>
        </div>
      )}

      {nominateModal && (
        <Modal onClose={() => setNominateModal(false)}>
          {done ? (
            <>
              <p className="font-mono lowercase text-xs text-amber mb-2">nominated</p>
              <p className="text-text-secondary text-[0.92rem] mb-5">
                thanks â€” admins will review it.
              </p>
              <div className="flex justify-end">
                <CloseBtn onClick={() => setNominateModal(false)} />
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
                placeholder="a short reason â€” what makes this worth preserving?"
                rows={4}
              />
              <div className="flex justify-end gap-2 mt-4">
                <CloseBtn onClick={() => setNominateModal(false)} label="cancel" />
                <button
                  onClick={submitNominate}
                  disabled={busy || reason.trim().length === 0}
                  className="font-mono lowercase text-[0.7rem] px-3 py-1.5 disabled:opacity-50"
                  style={{ background: "#e8702a", color: "#000" }}
                >
                  {busy ? "sendingâ€¦" : "nominate â†’"}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {reportModal && (
        <Modal onClose={() => setReportModal(false)}>
          {reportDone ? (
            <>
              <p className="font-mono lowercase text-xs text-amber mb-2">reported</p>
              <p className="text-text-secondary text-[0.92rem] mb-5">
                thanks â€” an admin will review it.
              </p>
              <div className="flex justify-end">
                <CloseBtn onClick={() => setReportModal(false)} />
              </div>
            </>
          ) : (
            <>
              <p className="font-mono lowercase text-xs text-text-faint mb-2">report_post</p>
              <h2 className="font-sans text-text-primary text-lg lowercase mb-4">
                what's wrong with this post?
              </h2>
              <div className="mb-3">
                <label>reason</label>
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                  {REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label>note (optional)</label>
                <textarea
                  rows={3}
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="anything else admins should know"
                />
              </div>
              <div className="flex justify-end gap-2">
                <CloseBtn onClick={() => setReportModal(false)} label="cancel" />
                <button
                  onClick={submitReport}
                  disabled={reportBusy}
                  className="font-mono lowercase text-[0.7rem] px-3 py-1.5 disabled:opacity-50"
                  style={{ background: "#e8702a", color: "#000" }}
                >
                  {reportBusy ? "sendingâ€¦" : "submit report"}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border p-6"
        style={{ background: "var(--card-elev)", borderColor: "var(--border-amber)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function CloseBtn({ onClick, label = "close" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="font-mono lowercase text-[0.7rem] px-3 py-1.5 border"
      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
    >
      {label}
    </button>
  );
}
