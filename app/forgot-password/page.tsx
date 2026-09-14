"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell, { AUTH_CARD, AUTH_LABEL, AUTH_LINK } from "@/components/AuthShell";
import ui from "@/components/ui/sleek.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      // The recovery link has to come back through /auth/callback so the code
      // gets exchanged for a session before the reset form loads.
      { redirectTo: `${window.location.origin}/auth/callback?type=recovery` },
    );

    setLoading(false);

    // Deliberately reports success even on failure. The error text distinguishes
    // "no account with that email" from "sent", which turns this form into a
    // membership oracle for a private community.
    if (resetError) console.error("[forgot-password]", resetError.message);
    setSent(true);
  }

  const footer = (
    <p>
      Remembered it?{" "}
      <Link href="/login" style={AUTH_LINK} className="hover:underline">
        Log in
      </Link>
    </p>
  );

  if (sent) {
    return (
      <AuthShell title="Check your inbox" footer={footer}>
        <div style={AUTH_CARD}>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            If an account exists for {email.trim()}, a reset link is on its way. It expires in an
            hour, and works in the browser you requested it from.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one." footer={footer}>
      <form onSubmit={handleSubmit} className="space-y-4" style={AUTH_CARD}>
        <div>
          <label htmlFor="forgot-email" style={AUTH_LABEL}>Email</label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading} className={`${ui.primaryBtn} w-full`} style={{ padding: "11px 16px" }}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}
