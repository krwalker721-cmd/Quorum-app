"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LogoMark from "@/components/LogoMark";

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
      setError("passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("password must be at least 8 characters");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message.toLowerCase());
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

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <LogoMark size={44} />
          <h1 className="font-mono lowercase text-text-primary text-lg mt-4 tracking-wide">quorum</h1>
          <p className="font-mono lowercase text-text-faint text-xs mt-1">new password</p>
        </div>

        {checking ? (
          <div className="bg-card border border-border p-6 h-40" />
        ) : done ? (
          <div className="bg-card border border-border p-6 space-y-2">
            <p className="font-mono text-xs text-green-400 lowercase">password updated</p>
            <p className="font-mono text-xs text-text-faint lowercase">signing you in...</p>
          </div>
        ) : !hasSession ? (
          <div className="bg-card border border-border p-6 space-y-3">
            <p className="font-mono text-xs text-text-primary lowercase">link expired</p>
            <p className="font-mono text-xs text-text-faint lowercase leading-relaxed">
              reset links are single-use and last an hour. request a fresh one.
            </p>
            <Link href="/forgot-password" className="btn-primary w-full block text-center">
              send a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card border border-border p-6 space-y-4">
            <div>
              <label>new password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label>confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            {error && <p className="font-mono text-xs text-red-400 lowercase">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "..." : "set password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
