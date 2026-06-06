"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LeaveCohortButton({
  cohortId,
}: {
  cohortId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/cohort/leave", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cohort_id: cohortId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data?.error ?? "failed");
      return;
    }
    setOpen(false);
    // Membership is gone — return to the cohort index so the (no-cohort /
    // selection / single-cohort) state is recomputed. refresh() ensures the
    // server components re-read the now-updated membership list.
    router.push("/cohort");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-center font-mono lowercase text-[0.65rem] py-1.5 leave-cohort-btn"
        style={{
          background: "transparent",
          border: "none",
          color: "#9b6b6b",
          cursor: "pointer",
        }}
      >
        leave cohort
      </button>
      <style jsx>{`
        .leave-cohort-btn {
          text-decoration: none;
        }
        .leave-cohort-btn:hover {
          color: #f87171;
          text-decoration: underline;
          text-decoration-color: #f87171;
        }
      `}</style>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-sm border p-6"
            style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono lowercase text-text-primary text-sm">
              leave this cohort?
            </p>
            <p className="text-text-muted text-[0.85rem] leading-relaxed mt-3">
              are you sure you want to leave this cohort? you&apos;ll immediately
              lose access to its posts, messages, and room. you can join or be
              invited to another cohort later.
            </p>
            {err && (
              <p className="font-mono text-xs text-red-400 lowercase mt-3">
                {err}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="font-mono lowercase text-[0.7rem] px-3 py-1.5 border"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                cancel
              </button>
              <button
                onClick={confirm}
                disabled={busy}
                className="font-mono lowercase text-[0.7rem] px-3 py-1.5"
                style={{
                  background: "rgba(239,68,68,0.18)",
                  color: "#f87171",
                  border: "1px solid rgba(239,68,68,0.55)",
                  fontWeight: 700,
                }}
              >
                {busy ? "leaving..." : "leave cohort"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
