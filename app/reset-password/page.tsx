"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell, { AUTH_CARD, AUTH_ERROR, AUTH_LABEL, sentence } from "@/components/AuthShell";
import ui from "@/components/ui/sleek.module.css";

// Reached from a recovery link, after /auth/callback has already exchanged the
// code for a session. The session is what authorizes updateUser() below — so if
// there isn't one, the link was expired or already spent and there is nothing
// this page can do but say so.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setChecking(false);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(sentence(updateError.message));
      return;
    }

    setDone(true);
    // Straight into the app — the recovery session is a real session, and `/`
    // routes to pending or home based on profile status.
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1200);
  }

  if (checking) {
    return (
      <AuthShell title="Choose a new password">
        <div style={{ ...AUTH_CARD, height: 200 }} />
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated">
        <div style={AUTH_CARD}>
          <p style={{ fontSize: 14, color: "#4ade80" }}>You&apos;re all set. Signing you in…</p>
        </div>
      </AuthShell>
    );
  }

  if (!hasSession) {
    return (
      <AuthShell title="This link has expired">
        <div className="space-y-4" style={AUTH_CARD}>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            Reset links work once and last an hour. Request a fresh one.
          </p>
          <Link href="/forgot-password" className={`${ui.primaryBtn} block w-full`} style={{ padding: "11px 16px" }}>
            Send a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4" style={AUTH_CARD}>
        <div>
          <label htmlFor="reset-password" style={AUTH_LABEL}>New password</label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="reset-confirm" style={AUTH_LABEL}>Confirm password</label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && <p role="alert" style={AUTH_ERROR}>{error}</p>}

        <button type="submit" disabled={loading} className={`${ui.primaryBtn} w-full`} style={{ padding: "11px 16px" }}>
          {loading ? "Saving…" : "Set password"}
        </button>
      </form>
    </AuthShell>
  );
}
