"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function InviteForm({
  cohorts,
  userId,
}: {
  cohorts: { id: string; name: string }[];
  userId: string;
}) {
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function generate(opts: { withEmail: boolean }) {
    if (!cohortId) return;
    if (opts.withEmail && !email.trim()) return;
    setBusy(true);
    setErr(null);
    setLink(null);
    // Direct cohort link — anyone signed in who follows it gets joined to this
    // cohort. We still record an invite row for tracking/email use.
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
    } catch {}
  }

  return (
    <div className="bg-card border border-border p-6 space-y-4">
      <div>
        <label>cohort</label>
        <select value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>{c.name.toLowerCase()}</option>
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

      {err && <p className="font-mono text-xs text-red-400 lowercase">{err}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => generate({ withEmail: false })}
          disabled={busy || !cohortId}
          className="font-mono lowercase text-[0.7rem] px-3 py-2 border disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          generate link
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
        <div className="pt-3 space-y-2 border-t" style={{ borderColor: "var(--border)" }}>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint">
            invite link · share this with the person you&apos;re inviting
          </p>
          <div className="flex gap-2">
            <input value={link} readOnly className="flex-1" />
            <button
              onClick={copy}
              type="button"
              className="btn-primary whitespace-nowrap"
            >
              copy
            </button>
          </div>
          <p className="font-mono lowercase text-[0.6rem] text-text-faint">
            note: sending the email is a manual step for now — copy the link and send it from your inbox.
          </p>
        </div>
      )}
    </div>
  );
}
