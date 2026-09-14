"use client";

import { useState } from "react";

export default function ConfirmDeleteModal({
  itemLabel,
  onConfirm,
  onClose,
  busy: busyProp,
}: {
  itemLabel: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  busy?: boolean;
}) {
  const [internalBusy, setInternalBusy] = useState(false);
  const busy = busyProp ?? internalBusy;

  async function handle() {
    setInternalBusy(true);
    try {
      await onConfirm();
    } finally {
      setInternalBusy(false);
    }
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="alertdialog"
        aria-label={`Delete this ${itemLabel}?`}
        className="modal-shell w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell-head" style={{ borderBottom: "none", paddingBottom: 6 }}>
          <div className="min-w-0">
            <p className="modal-kicker" style={{ color: "#f87171" }}>
              Can&apos;t be undone
            </p>
            <h2 className="modal-title">Delete this {itemLabel}?</h2>
            <p className="modal-subtitle">It&apos;s gone for good, for everyone.</p>
          </div>
        </div>
        <div className="modal-shell-foot" style={{ borderTop: "none", background: "transparent", paddingTop: 16 }}>
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={handle}
            disabled={busy}
            className="disabled:opacity-50"
            style={{
              fontSize: 13,
              fontWeight: 500,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(239, 68, 68, 0.5)",
              background: "rgba(239, 68, 68, 0.16)",
              color: "#f87171",
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
