"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell, { AUTH_CARD, AUTH_ERROR, AUTH_LABEL, AUTH_LINK, sentence } from "@/components/AuthShell";
import LegalLinks from "@/components/LegalLinks";
import ui from "@/components/ui/sleek.module.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Seeded from ?error= so a dead auth link (expired reset, spent confirmation)
  // explains itself here instead of dumping the user on a blank login form.
  const seeded = searchParams.get("error");
  const [error, setError] = useState<string | null>(seeded ? sentence(seeded) : null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(sentence(signInError.message));
      setLoading(false);
      return;
    }

    // Where a member belongs (pending, suspended, or in) is decided on the
    // server: "/" and the app layout both route on it, and they know whether the
    // waitlist is on. Deciding here as well would be a second copy of that rule.
    router.push(safeNext ?? "/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" style={AUTH_CARD}>
      <div>
        <label htmlFor="login-email" style={AUTH_LABEL}>Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="login-password" style={AUTH_LABEL}>Password</label>
          <Link href="/forgot-password" className={ui.tileLink} style={{ fontSize: 12 }}>
            Forgot?
          </Link>
        </div>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p role="alert" style={AUTH_ERROR}>{error}</p>}

      <button type="submit" disabled={loading} className={`${ui.primaryBtn} w-full`} style={{ padding: "11px 16px" }}>
        {loading ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your room."
      footer={
        <>
          <p>
            No account?{" "}
            <Link href="/signup" style={AUTH_LINK} className="hover:underline">
              Request access
            </Link>
          </p>
          <LegalLinks className="mt-8" />
        </>
      }
    >
      <Suspense fallback={<div style={{ ...AUTH_CARD, height: 240 }} />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
