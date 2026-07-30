"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LogoMark from "@/components/LogoMark";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <LogoMark size={44} />
          <h1 className="font-mono lowercase text-text-primary text-lg mt-4 tracking-wide">quorum</h1>
          <p className="font-mono lowercase text-text-faint text-xs mt-1">reset password</p>
        </div>

        {sent ? (
          <div className="bg-card border border-border p-6 space-y-3">
            <p className="font-mono text-xs text-text-primary lowercase">
              check your inbox
            </p>
            <p className="font-mono text-xs text-text-faint lowercase leading-relaxed">
              if an account exists for {email.trim().toLowerCase()}, a reset link is on its
              way. it expires in an hour.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card border border-border p-6 space-y-4">
            <div>
              <label>email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && <p className="font-mono text-xs text-red-400 lowercase">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "..." : "send reset link"}
            </button>
          </form>
        )}

        <p className="font-mono text-xs text-text-faint lowercase text-center mt-6">
          remembered it?{" "}
          <Link href="/login" className="text-amber hover:underline">log in</Link>
        </p>
      </div>
    </main>
  );
}
