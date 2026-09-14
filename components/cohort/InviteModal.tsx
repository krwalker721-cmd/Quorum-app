"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      setErr(error.message ?? "Couldn't create the invite.");
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
      className="modal-overlay fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Invite a founder"
        className="modal-shell w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell-head">
          <div className="min-w-0">
            <p className="modal-kicker">Cohort</p>
            <h2 className="modal-title">Invite a founder</h2>
            <p className="modal-subtitle">
              Cohorts work because everyone was vouched for. Invite someone you&apos;d trust with
              the truth.
            </p>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn">
            Esc
          </button>
        </div>

        <div className="modal-shell-body">
          {cohorts.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              You&apos;re not in a cohort yet.{" "}
              <Link href="/cohort/create" style={{ color: "#f8c56a" }} className="hover:underline">
                Create one →
              </Link>
            </p>
          ) : (
            <>
              <div>
                <label htmlFor="invite-cohort">Cohort</label>
                <select id="invite-cohort" value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="invite-email">Email (optional)</label>
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="someone@example.com"
                />
              </div>

              {err && <p style={{ fontSize: 13, color: "#f87171" }}>{err}</p>}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => generate({ withEmail: false })}
                  disabled={busy || !cohortId}
                  className="btn-ghost disabled:opacity-50"
                >
                  Create invite link
                </button>
                <button
                  type="button"
                  onClick={() => generate({ withEmail: true })}
                  disabled={busy || !cohortId || !email.trim()}
                  className="btn-primary"
                >
                  Create email invite
                </button>
              </div>

              {link && (
                <div className="space-y-2" style={{ paddingTop: 14, borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Share this link</p>
                  <div className="flex gap-2">
                    <input value={link} readOnly aria-label="Invite link" className="flex-1" />
                    <button onClick={copy} type="button" className="btn-primary whitespace-nowrap">
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  {/* Nothing here sends an email; say so, as /cohort/invite does. */}
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Quorum doesn&apos;t send the email for you yet. Copy the link and send it yourself.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
