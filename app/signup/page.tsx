"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LogoMark from "@/components/LogoMark";
import { LEGAL } from "@/lib/legal";

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
  // Explicit "I agree" — Massachusetts's SJC (Kauders v. Uber, 2021) strongly
  // prefers a checkbox or button over a passive "by signing up you agree" line.
  const [agreed, setAgreed] = useState(false);
  const [building, setBuilding] = useState("");
  const [stage, setStage] = useState("idea");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  // Set when Supabase has "confirm email" enabled: signUp() returns a user but
  // no session, and nothing more can happen until they click the link.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

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

    // Every profile field rides along as user metadata. The handle_new_user()
    // trigger (migration 014) reads it and creates the profiles row inside the
    // same transaction as the auth user — which is what makes this work with
    // email confirmation ON. The old client-side insert could not: with
    // confirmation on there is no session here, so the insert failed RLS and
    // left an auth user with no profile, permanently stuck.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          what_they_are_building: building,
          stage,
          // Optional; handle_new_user() copies it to the profile (migration 017).
          bio: bio.trim() || undefined,
          // Proof of assent: which Terms were accepted, and when. Lives in
          // auth.users.raw_user_meta_data; handle_new_user() ignores these keys.
          terms_version: LEGAL.effectiveDate,
          terms_accepted_at: new Date().toISOString(),
          // The referral travels with the account as well as in the cookie, so
          // a confirmation link opened on another device (no cookie there) can
          // still credit the referrer. See claimSignupReferral.
          referral_code: refCode ?? undefined,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message.toLowerCase());
      setLoading(false);
      return;
    }

    // No session means confirmation is required. The profile already exists, and
    // /auth/confirm (or /auth/callback, for old links) claims the referral once
    // they confirm — from the cookie, or from their metadata on another device.
    if (!data.session) {
      setAwaitingConfirmation(true);
      setLoading(false);
      return;
    }

    // Confirmation is off, so we're signed in already. Record the referral if
    // this signup came through a referral link — the claim route reads the user
    // from the session. Best-effort; never block signup.
    if (refCode) {
      try {
        await fetch("/api/referrals/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: refCode }),
        });
      } catch {}
    }

    // "/" sends them to the waiting room or straight in, per the admin's
    // platform_status setting.
    router.push("/");
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

        {awaitingConfirmation && (
          <div className="bg-card border border-border p-6 space-y-3">
            <p className="font-mono text-xs text-text-primary lowercase">confirm your email</p>
            <p className="font-mono text-xs text-text-faint lowercase leading-relaxed">
              we sent a link to {email.trim().toLowerCase()}. click it and you&apos;re in the
              queue — nothing else to do here.
            </p>
            <p className="font-mono text-xs text-text-faint lowercase leading-relaxed">
              no email after a few minutes? check spam, or{" "}
              <Link href="/login" className="text-amber hover:underline">log in</Link> to
              resend.
            </p>
          </div>
        )}

        {!awaitingConfirmation && referrerName && (
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

        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border p-6 space-y-4"
          hidden={awaitingConfirmation}
        >
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
          <div>
            <label>a line about you <span className="text-text-faint">(optional)</span></label>
            <textarea
              rows={2}
              maxLength={280}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. second-time founder, ex-product at a fintech"
            />
          </div>

          {error && <p className="font-mono text-xs text-red-400 lowercase">{error}</p>}

          <label className="flex items-start gap-2 cursor-pointer" style={{ lineHeight: 1.6 }}>
            <input
              type="checkbox"
              required
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ marginTop: 3, accentColor: "var(--accent)" }}
            />
            <span className="font-mono text-[0.65rem] text-text-faint lowercase">
              i agree to the{" "}
              <Link href="/terms" target="_blank" className="text-amber hover:underline">terms</Link>
              {" "}and{" "}
              <Link href="/privacy" target="_blank" className="text-amber hover:underline">privacy policy</Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !agreed}
            className="btn-primary w-full"
          >
            {loading ? "..." : "request access"}
          </button>
        </form>

        {!awaitingConfirmation && (
          <p className="font-mono text-xs text-text-faint lowercase text-center mt-6">
            already have an account?{" "}
            <Link href="/login" className="text-amber hover:underline">log in</Link>
          </p>
        )}
      </div>
    </main>
  );
}
