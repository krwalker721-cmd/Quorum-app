"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LogoMark from "@/components/LogoMark";
import { WAITLIST_ENABLED } from "@/lib/flags";

const STAGES = [
  { value: "idea", label: "idea" },
  { value: "pre-seed", label: "pre-seed" },
  { value: "seed", label: "seed" },
  { value: "series_a", label: "series a" },
];

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [building, setBuilding] = useState("");
  const [stage, setStage] = useState("idea");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);

  // Capture ?ref=CODE from the URL (read from window to avoid needing a Suspense
  // boundary for useSearchParams). Persist it in a cookie as a fallback for any
  // later flow, and validate it to show the welcome banner.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (!code) return;
    setRefCode(code);
    document.cookie = `referral_code=${code}; path=/; max-age=86400; samesite=lax`;

    fetch(`/api/referrals/validate?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) setReferrerName(d.referrerName);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (signUpError) {
      setError(signUpError.message.toLowerCase());
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setError("signup pending email confirmation. check your inbox.");
      setLoading(false);
      return;
    }

    const username =
      fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" +
      userId.slice(0, 4);

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: fullName,
      email,
      what_they_are_building: building,
      stage,
      status: WAITLIST_ENABLED ? "pending" : "approved",
      username,
    });

    if (profileError) {
      setError(profileError.message.toLowerCase());
      setLoading(false);
      return;
    }

    // Record the referral if this signup came through a referral link. The user
    // is authenticated at this point; the claim route reads them from the session
    // and creates the referral as 'pending'. Best-effort — never block signup.
    if (refCode) {
      try {
        await fetch("/api/referrals/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: refCode }),
        });
      } catch {}
    }

    router.push(WAITLIST_ENABLED ? "/pending" : "/home");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <LogoMark size={44} />
          <h1 className="font-mono lowercase text-text-primary text-lg mt-4 tracking-wide">quorum</h1>
          <p className="font-mono lowercase text-text-faint text-xs mt-1">request access</p>
        </div>

        {referrerName && (
          <div
            style={{
              background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: "4px",
              padding: "12px 16px",
              marginBottom: "24px",
            }}
          >
            <p
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11px",
                color: "#22c55e",
                letterSpacing: "0.05em",
                margin: 0,
              }}
            >
              {referrerName} invited you to Quorum — your first month is on them.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border p-6 space-y-4">
          <div>
            <label>full name</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label>email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label>password</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label>what are you building?</label>
            <input type="text" required maxLength={140} value={building} onChange={(e) => setBuilding(e.target.value)} />
          </div>
          <div>
            <label>current stage</label>
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="font-mono text-xs text-red-400 lowercase">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "..." : "request access"}
          </button>
        </form>

        <p className="font-mono text-xs text-text-faint lowercase text-center mt-6">
          already have an account?{" "}
          <Link href="/login" className="text-amber hover:underline">log in</Link>
        </p>
      </div>
    </main>
  );
}
