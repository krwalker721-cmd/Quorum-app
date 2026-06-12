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
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-sm border p-6"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--border-muted)",
          borderRadius: "var(--radius-modal)",
          boxShadow: "var(--shadow-modal)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="modal-kicker" style={{ color: "#f85149" }}>destructive action</p>
        <p className="font-sans lowercase text-text-primary text-base mt-1.5">
          delete this {itemLabel}?
        </p>
        <p className="font-sans lowercase text-text-secondary text-xs mt-1">
          this cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} disabled={busy} className="btn-ghost">
            cancel
          </button>
          <button
            onClick={handle}
            disabled={busy}
            className="font-mono lowercase text-[0.7rem] px-4 py-1.5 transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: "rgba(239,68,68,0.16)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.50)",
              borderRadius: "var(--radius-ctl)",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            {busy ? "deleting..." : "delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
