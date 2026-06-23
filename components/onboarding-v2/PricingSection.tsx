"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import TierPill from "@/components/TierPill";
import { C, MONO, SANS, hexToRgba, Reveal } from "./theme";

// Publishable key is safe to expose. If it's missing the embedded card form
// simply won't mount — the cold-signup checkout flow still works without it.
// Lazy: only loaded when the pricing section is actually rendered.
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

const cardElementOptions = {
  style: {
    base: {
      color: "#e6edf3",
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: "14px",
      "::placeholder": { color: "#484f58" },
      backgroundColor: "transparent",
    },
    invalid: { color: "#f85149" },
  },
};

interface Sub {
  tier: "free" | "member" | "partner";
  status: string;
  referred_free_month_available: boolean;
  referred_free_month_expires_at: string | null;
  partner_waitlist: boolean;
  referrer_name: string | null;
}

const FREE_FEATURES = [
  "Read everything — always",
  "Weekly check-in — always",
  "3 cohort posts per month",
  "2 pulse posts per month",
  "5 replies per month",
  "3 messages per month",
  "1 vault note",
  "No collab board access",
];
const MEMBER_FEATURES = [
  "Everything in Free",
  "Unlimited cohort posting",
  "Unlimited pulse posts",
  "Unlimited replies",
  "Unlimited messages",
  "Unlimited vault notes",
  "Full collab board access",
  "Unlimited referrals",
  "7 day free trial",
];
const PARTNER_FEATURES = [
  "Everything in Member",
  "Private Partner-only feed",
  "Curated cohort of established founders",
  "Deal flow and introductions",
  "Senior founder network",
  "Priority support",
];

// HH:MM:SS until the referred free-month offer expires.
function useCountdown(expiresAt: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!expiresAt) return "";
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return "expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function Feature({ label, color, bullet }: { label: string; color: string; bullet: string }) {
  return (
    <li
      style={{
        fontFamily: SANS,
        fontSize: 12,
        color,
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        marginBottom: 7,
      }}
    >
      <span style={{ color: bullet, lineHeight: 1.4 }}>•</span>
      <span>{label}</span>
    </li>
  );
}

// ─── Embedded card form (referred free-month claim) ──────────────────────────
function CardForm({ onActivated }: { onActivated: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    try {
      const setupRes = await fetch("/api/setup-intent", { method: "POST" });
      const setup = await setupRes.json();
      if (!setupRes.ok) throw new Error(setup.error || "Could not start card setup.");

      const card = elements.getElement(CardElement);
      if (!card) throw new Error("Card field not found.");

      const { error: confirmErr, setupIntent } = await stripe.confirmCardSetup(
        setup.clientSecret,
        { payment_method: { card } },
      );
      if (confirmErr) throw new Error(confirmErr.message || "Card could not be saved.");

      const paymentMethodId = setupIntent?.payment_method as string;

      const subRes = await fetch("/api/setup-intent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId, customerId: setup.customerId }),
      });
      const subJson = await subRes.json();
      if (!subRes.ok) throw new Error(subJson.error || "Could not activate your free month.");

      setDone(true);
      setTimeout(onActivated, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: C.surface,
        border: `1px solid ${C.amber}`,
        borderRadius: 4,
        padding: 20,
        marginTop: 16,
        width: "100%",
        maxWidth: 640,
        boxSizing: "border-box",
      }}
    >
      <p style={{ fontFamily: SANS, fontSize: 15, color: C.textPrimary, margin: "0 0 6px" }}>
        Add your card to claim your free month
      </p>
      <p style={{ fontFamily: MONO, fontSize: 11, color: C.textSecondary, margin: "0 0 18px" }}>
        You won&apos;t be charged until day 31. Cancel anytime before then.
      </p>

      <div
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: "12px 14px",
          background: C.bg,
          marginBottom: 16,
        }}
      >
        <CardElement options={cardElementOptions} />
      </div>

      {error && (
        <p style={{ fontFamily: MONO, fontSize: 11, color: C.red, margin: "0 0 12px" }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || done || !stripe}
        style={{
          width: "100%",
          background: done ? C.green : C.amber,
          color: "#0d1117",
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: "0.04em",
          padding: "12px 16px",
          borderRadius: 4,
          border: "none",
          cursor: loading || done ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {done ? "Free month active ✓" : loading ? "Activating..." : "Activate my free month →"}
      </button>
    </form>
  );
}

// ─── Pricing body ─────────────────────────────────────────────────────────────
function PricingBody({ onComplete }: { onComplete: (redirectTo: string) => void }) {
  const [sub, setSub] = useState<Sub | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Sub | null) => {
        if (d) {
          setSub(d);
          setWaitlistJoined(!!d.partner_waitlist);
        }
      })
      .catch(() => {});
  }, []);

  const referred = !!sub?.referred_free_month_available;
  const referrerName = sub?.referrer_name || "a founder";
  const countdown = useCountdown(sub?.referred_free_month_expires_at ?? null);

  async function startCheckout() {
    setLoadingCheckout(true);
    try {
      // Mark onboarding complete before leaving for Stripe; the user has reached
      // the end of the flow regardless of whether they finish checkout.
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, current_step: 18 }),
      }).catch(() => {});

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelUrl: `${window.location.origin}/onboarding` }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoadingCheckout(false);
      }
    } catch {
      setLoadingCheckout(false);
    }
  }

  async function joinWaitlist() {
    setWaitlistLoading(true);
    try {
      const res = await fetch("/api/partner-waitlist", { method: "POST" });
      if (res.ok) setWaitlistJoined(true);
    } finally {
      setWaitlistLoading(false);
    }
  }

  const memberCta = useMemo(() => {
    if (referred) return { label: "Claim my free month →", action: "claim" as const };
    return { label: "Start 7-day trial →", action: "checkout" as const };
  }, [referred]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 700,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <Reveal>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: C.amber,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          // choose your plan
        </div>
        <h1
          style={{
            fontFamily: SANS,
            fontSize: 28,
            fontWeight: 500,
            color: C.textPrimary,
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          Start building with Quorum.
        </h1>

        {referred ? (
          <p
            style={{
              fontFamily: MONO,
              fontSize: 11,
              color: C.green,
              margin: "0 0 28px",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            Your first month is on {referrerName}. Add a card to claim it — offer expires in{" "}
            {countdown}.
          </p>
        ) : (
          <p
            style={{
              fontFamily: SANS,
              fontSize: 14,
              color: C.textSecondary,
              margin: "0 0 28px",
              textAlign: "center",
            }}
          >
            Your 7-day trial is active. Upgrade anytime — or stay free.
          </p>
        )}
      </Reveal>

      {/* Referred banner */}
      {referred && (
        <div
          style={{
            background: hexToRgba(C.green, 0.06),
            border: `1px solid ${hexToRgba(C.green, 0.2)}`,
            borderRadius: 4,
            padding: "12px 16px",
            marginBottom: 20,
            fontFamily: MONO,
            fontSize: 11,
            color: C.green,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {referrerName} invited you — your first month is free. Offer expires in {countdown}.
        </div>
      )}

      {/* Current plan indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDisabled, letterSpacing: "0.08em" }}>
          // you&rsquo;re on
        </span>
        <TierPill tier={sub?.tier ?? "free"} />
      </div>

      {/* Tier cards */}
      <Reveal variant="card">
        <div
          style={{
            display: "flex",
            gap: 16,
            maxWidth: 640,
            margin: "0 auto",
            alignItems: "flex-start",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {/* ── Free ── */}
          <Card>
            <CardTag color={C.textDisabled}>// free</CardTag>
            <Price amount="$0" color={C.textPrimary} suffixColor={C.textDisabled} />
            <Tagline>Get a feel for the room.</Tagline>
            <Divider />
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {FREE_FEATURES.map((f) => (
                <Feature key={f} label={f} color={C.textMuted} bullet={C.borderMuted} />
              ))}
            </ul>
            <CardButton label="Stay on free →" onClick={() => onComplete("/home")} variant="ghost" />
          </Card>

          {/* ── Member (highlighted) ── */}
          <Card highlight={C.amber} badge="MOST POPULAR">
            <CardTag color={C.amber}>// member</CardTag>
            <Price amount="$49" color={C.textPrimary} suffixColor={C.textSecondary} />
            <Tagline>Full access. No limits. No noise.</Tagline>
            <Divider />
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {MEMBER_FEATURES.map((f) => (
                <Feature key={f} label={f} color={C.textSecondary} bullet={C.amber} />
              ))}
            </ul>
            <CardButton
              label={loadingCheckout ? "Loading..." : memberCta.label}
              disabled={loadingCheckout}
              onClick={() => {
                if (memberCta.action === "checkout") startCheckout();
                else setShowCardForm(true);
              }}
              variant="solid"
            />
          </Card>

          {/* ── Partner (coming soon) ── */}
          <Card highlight={C.purple} badge="COMING SOON">
            <CardTag color={C.purple}>// partner</CardTag>
            <Price amount="$99" color={C.textDisabled} suffixColor={C.textDisabled} />
            <Tagline>The room where real business happens.</Tagline>
            <Divider />
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {PARTNER_FEATURES.map((f) => (
                <Feature key={f} label={f} color={C.textDisabled} bullet={C.borderMuted} />
              ))}
            </ul>
            <button
              onClick={joinWaitlist}
              disabled={waitlistJoined || waitlistLoading}
              style={{
                width: "100%",
                marginTop: 20,
                padding: "12px 16px",
                borderRadius: 4,
                fontFamily: MONO,
                fontSize: 12,
                background: "transparent",
                color: waitlistJoined ? C.textDisabled : C.purple,
                border: `1px solid ${waitlistJoined ? C.borderMuted : C.purple}`,
                cursor: waitlistJoined ? "default" : "pointer",
                opacity: waitlistLoading ? 0.7 : 1,
              }}
            >
              {waitlistJoined ? "On the waitlist ✓" : waitlistLoading ? "Joining..." : "Join the waitlist →"}
            </button>
          </Card>
        </div>
      </Reveal>

      {/* Embedded card form for referred claim */}
      {showCardForm && referred && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CardForm onActivated={() => onComplete("/home?trial=activated")} />
        </div>
      )}

      {/* Decide-later escape hatch */}
      <div style={{ marginTop: 20, textAlign: "center" }}>
        <button
          onClick={() => onComplete("/home")}
          style={{
            background: "transparent",
            border: "none",
            fontFamily: MONO,
            fontSize: 11,
            color: C.textDisabled,
            cursor: "pointer",
            padding: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.textSecondary)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.textDisabled)}
        >
          I&rsquo;ll decide later — take me to Quorum →
        </button>
      </div>
    </div>
  );
}

// ─── Card primitives ──────────────────────────────────────────────────────────
function Card({
  children,
  highlight,
  badge,
}: {
  children: React.ReactNode;
  highlight?: string;
  badge?: string;
}) {
  const border = highlight ? hexToRgba(highlight, 0.5) : C.border;
  return (
    <div
      style={{
        flex: "1 1 180px",
        minWidth: 180,
        maxWidth: 220,
        background: C.surface,
        border: `1px solid ${border}`,
        borderRadius: 4,
        padding: 18,
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {highlight && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: highlight,
            borderRadius: "4px 4px 0 0",
          }}
        />
      )}
      {badge && highlight && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            background: highlight,
            color: "#0d1117",
            fontFamily: MONO,
            fontSize: 8,
            letterSpacing: "0.1em",
            padding: "3px 10px",
            borderRadius: 3,
            whiteSpace: "nowrap",
          }}
        >
          {badge}
        </div>
      )}
      {children}
    </div>
  );
}

function CardTag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: MONO,
        fontSize: 9,
        color,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        margin: "0 0 10px",
      }}
    >
      {children}
    </p>
  );
}

function Price({ amount, color, suffixColor }: { amount: string; color: string; suffixColor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
      <span style={{ fontFamily: SANS, fontSize: 32, color }}>{amount}</span>
      <span style={{ fontFamily: SANS, fontSize: 14, color: suffixColor }}>/month</span>
    </div>
  );
}

function Tagline({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: SANS, fontSize: 13, color: C.textSecondary, margin: "8px 0 16px" }}>
      {children}
    </p>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.border, margin: "16px 0" }} />;
}

function CardButton({
  label,
  onClick,
  variant,
  disabled,
}: {
  label: string;
  onClick: () => void;
  variant: "solid" | "ghost";
  disabled?: boolean;
}) {
  const solid = variant === "solid";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        marginTop: 20,
        padding: "12px 16px",
        borderRadius: 4,
        fontFamily: MONO,
        fontSize: 12,
        background: solid ? C.amber : "transparent",
        color: solid ? "#0d1117" : C.textDisabled,
        border: solid ? "none" : `1px solid ${C.border}`,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {label}
    </button>
  );
}

// Section 14 — Pricing. Wrapped in Stripe Elements so the referred free-month
// claim can mount a CardElement. Lazy-loaded by the page so Stripe only ships
// when a user actually scrolls this far.
export default function PricingSection({
  onComplete,
}: {
  onComplete: (redirectTo: string) => void;
}) {
  return (
    <Elements stripe={stripePromise}>
      <PricingBody onComplete={onComplete} />
    </Elements>
  );
}
