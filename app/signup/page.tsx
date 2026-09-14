"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell, { AUTH_CARD, AUTH_ERROR, AUTH_LABEL, AUTH_LINK, sentence } from "@/components/AuthShell";
import ui from "@/components/ui/sleek.module.css";
import { LEGAL } from "@/lib/legal";

const STAGES = [
  { value: "idea", label: "Idea" },
  { value: "pre-seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
];

const HINT: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", marginTop: 6 };

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
      setError(sentence(signUpError.message));
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

  if (awaitingConfirmation) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a link to ${email.trim()}.`}>
        <div className="space-y-3" style={AUTH_CARD}>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            Click it and your request is in. There&apos;s nothing else to do here.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)" }}>
            No email after a few minutes? Check spam, or{" "}
            <Link href="/login" style={AUTH_LINK} className="hover:underline">
              log in
            </Link>{" "}
            to resend it.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Request access"
      subtitle="Tell us who you are and what you're building."
      width={440}
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" style={AUTH_LINK} className="hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      {referrerName && (
        <div
          style={{
            background: "rgba(34, 197, 94, 0.07)",
            border: "1px solid rgba(34, 197, 94, 0.25)",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 13, lineHeight: 1.5, color: "#4ade80" }}>
            {referrerName} invited you to Quorum. Your first month is on them.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" style={AUTH_CARD}>
        <div>
          <label htmlFor="signup-name" style={AUTH_LABEL}>Full name</label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="signup-email" style={AUTH_LABEL}>Email</label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="signup-password" style={AUTH_LABEL}>Password</label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p style={HINT}>At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="signup-building" style={AUTH_LABEL}>What are you building?</label>
          <input
            id="signup-building"
            type="text"
            required
            maxLength={140}
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="signup-stage" style={AUTH_LABEL}>Current stage</label>
          <select id="signup-stage" value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="signup-bio" style={AUTH_LABEL}>
            A line about you <span style={{ color: "var(--text-muted)" }}>(optional)</span>
          </label>
          <textarea
            id="signup-bio"
            rows={2}
            maxLength={280}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="e.g. Second-time founder, ex-product at a fintech"
          />
        </div>

        {error && <p role="alert" style={AUTH_ERROR}>{error}</p>}

        {/* A checkbox row, so the label's global block/mono styling is reset. */}
        <label
          className="flex items-start gap-2.5 cursor-pointer"
          style={{ ...AUTH_LABEL, display: "flex", marginBottom: 0, lineHeight: 1.55 }}
        >
          <input
            type="checkbox"
            required
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ marginTop: 3, accentColor: "#f59e0b" }}
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" style={AUTH_LINK} className="hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" style={AUTH_LINK} className="hover:underline">
              Privacy Policy
            </Link>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !agreed}
          className={`${ui.primaryBtn} w-full`}
          style={{ padding: "11px 16px" }}
        >
          {loading ? "Sending…" : "Request access"}
        </button>
      </form>
    </AuthShell>
  );
}
