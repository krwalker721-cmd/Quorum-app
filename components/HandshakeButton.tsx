"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function HandshakeButton({
  currentUserId,
  recipientId,
  recipientName,
}: {
  currentUserId: string;
  recipientId: string;
  recipientName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [agreement, setAgreement] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!agreement.trim()) return;
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.from("handshakes").insert({
      initiator_id: currentUserId,
      recipient_id: recipientId,
      agreement: agreement.trim(),
      date,
    });
    setBusy(false);
    if (error) {
      setErr(error.message.toLowerCase());
      return;
    }
    setAgreement("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="font-mono lowercase text-[0.7rem] px-3 py-2 border hover:border-amber transition-colors whitespace-nowrap"
        style={{ borderColor: "var(--border)", color: "#f59e0b" }}
      >
        ◈ log handshake
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md border p-6 space-y-4"
            style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-mono lowercase text-xs text-text-muted">
                ◈ handshake with {recipientName?.toLowerCase() ?? "—"}
              </p>
              <button
                onClick={() => setOpen(false)}
                className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-primary"
              >
                close
              </button>
            </div>

            <div>
              <label>what did you agree to?</label>
              <textarea
                rows={4}
                value={agreement}
                onChange={(e) => setAgreement(e.target.value)}
                placeholder="the agreement..."
                autoFocus
              />
            </div>

            <div>
              <label>date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {err && (
              <p className="font-mono text-xs text-red-400 lowercase">{err}</p>
            )}

            <div className="flex justify-end pt-1">
              <button
                onClick={submit}
                disabled={busy || !agreement.trim()}
                className="font-mono lowercase text-xs px-4 py-2 bg-amber text-black hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "..." : "log handshake →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
