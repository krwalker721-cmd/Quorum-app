"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ui from "@/components/ui/sleek.module.css";

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
      {/* The colour lives in the styled-jsx rule, not inline, so the hover
          colour can actually win. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${ui.textBtn} leave-cohort-btn w-full text-center`}
        style={{ padding: "6px 0" }}
      >
        Leave cohort
      </button>
      <style jsx>{`
        .leave-cohort-btn {
          color: #b07777;
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
            className={`${ui.tile} w-full max-w-sm`}
            style={{ padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-text-primary" style={{ fontSize: 15, fontWeight: 600 }}>
              Leave this cohort?
            </p>
            <p className="text-text-secondary mt-3" style={{ fontSize: 14, lineHeight: 1.6 }}>
              You&apos;ll immediately lose access to its posts, messages, and room. You can join
              or be invited to another cohort later.
            </p>
            {err && (
              <p className="text-red-400 mt-3" style={{ fontSize: 13 }}>
                {err}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setOpen(false)} disabled={busy} className={ui.ghostBtn}>
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={busy}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "rgba(239,68,68,0.16)",
                  color: "#f87171",
                  border: "1px solid rgba(239,68,68,0.5)",
                  cursor: busy ? "default" : "pointer",
                }}
              >
                {busy ? "Leaving…" : "Leave cohort"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
