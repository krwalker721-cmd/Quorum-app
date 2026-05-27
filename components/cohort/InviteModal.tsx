"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function InviteModal({
  userId,
  cohorts,
  onClose,
}: {
  userId: string;
  cohorts: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function generate(opts: { withEmail: boolean }) {
    if (!cohortId) return;
    if (opts.withEmail && !email.trim()) return;
    setBusy(true);
    setErr(null);
    setLink(null);
    const supabase = createClient();
    const { error } = await supabase.from("cohort_invites").insert({
      cohort_id: cohortId,
      inviter_id: userId,
      email: opts.withEmail ? email.trim() : null,
    });
    setBusy(false);
    if (error) {
      setErr(error.message?.toLowerCase() ?? "failed");
      return;
    }
    setLink(`${origin}/join/cohort/${cohortId}`);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg border p-6 space-y-4"
        style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-mono lowercase text-xs text-text-muted">
            invite to cohort
          </p>
          <button
            onClick={onClose}
            className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-primary"
          >
            close
          </button>
        </div>

        {cohorts.length === 0 ? (
          <p className="font-mono lowercase text-xs text-text-faint">
            you&apos;re not in any cohorts yet. create one from{" "}
            <a className="text-amber hover:underline" href="/cohort/create">
              cohort/create
            </a>
            .
          </p>
        ) : (
          <>
            <div>
              <label>cohort</label>
              <select
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
              >
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="someone@example.com"
              />
            </div>

            {err && (
              <p className="font-mono text-xs text-red-400 lowercase">{err}</p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => generate({ withEmail: false })}
                disabled={busy || !cohortId}
                className="font-mono lowercase text-[0.7rem] px-3 py-2 border disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                copy unique invite link
              </button>
              <button
                type="button"
                onClick={() => generate({ withEmail: true })}
                disabled={busy || !cohortId || !email.trim()}
                className="btn-primary"
              >
                invite by email
              </button>
            </div>

            {link && (
              <div
                className="pt-3 space-y-2 border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <p className="font-mono lowercase text-[0.65rem] text-text-faint">
                  share this link
                </p>
                <div className="flex gap-2">
                  <input value={link} readOnly className="flex-1" />
                  <button
                    onClick={copy}
                    type="button"
                    className="btn-primary whitespace-nowrap"
                  >
                    {copied ? "copied" : "copy"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
