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
          background: "var(--card-elev)",
          borderColor: "var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-sans lowercase text-text-primary text-base">
          delete this {itemLabel}? this cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={busy}
            className="font-mono lowercase text-[0.7rem] px-3 py-1.5 border"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            cancel
          </button>
          <button
            onClick={handle}
            disabled={busy}
            className="font-mono lowercase text-[0.7rem] px-3 py-1.5"
            style={{
              background: "rgba(239,68,68,0.18)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.55)",
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
