"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ui from "@/components/ui/sleek.module.css";

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
      setErr(error.message ?? "failed");
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
    <div className={`${ui.tile} space-y-4`} style={{ padding: 24 }}>
      <div>
        <label>cohort</label>
        <select value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
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

      {err && <p className="text-red-400" style={{ fontSize: 13 }}>{err}</p>}

      {/* Neither button sends an email: Quorum has no invite email yet. The
          email one records who the invite is for; both hand back a link. */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => generate({ withEmail: false })}
          disabled={busy || !cohortId}
          className={ui.ghostBtn}
        >
          Generate link
        </button>
        <button
          type="button"
          onClick={() => generate({ withEmail: true })}
          disabled={busy || !cohortId || !email.trim()}
          className={ui.primaryBtn}
        >
          Create email invite
        </button>
      </div>

      {link && (
        <div className="pt-4 space-y-2 border-t" style={{ borderColor: "var(--border-default)" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Invite link. Share it with the person you&apos;re inviting.
          </p>
          <div className="flex gap-2">
            <input value={link} readOnly className="flex-1" />
            <button onClick={copy} type="button" className={ui.primaryBtn}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Quorum doesn&apos;t send the email for you yet. Copy the link and send it from your own
            inbox.
          </p>
        </div>
      )}
    </div>
  );
}
