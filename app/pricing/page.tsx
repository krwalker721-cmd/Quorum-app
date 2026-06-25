"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Publishable key is safe to expose. If it's missing the card form simply won't
// mount — the cold-signup checkout flow still works without it.
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

type Sub = {
  tier: "free" | "member" | "partner";
  status: string;
  trial_ends_at: string | null;
  has_stripe_subscription: boolean;
  referred_free_month_available: boolean;
  referred_free_month_expires_at: string | null;
  partner_waitlist: boolean;
};

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
      // 1. Create the SetupIntent on demand.
      const setupRes = await fetch("/api/setup-intent", { method: "POST" });
      const setup = await setupRes.json();
      if (!setupRes.ok) throw new Error(setup.error || "Could not start card setup.");

      const card = elements.getElement(CardElement);
      if (!card) throw new Error("Card field not found.");

      // 2. Confirm the card setup (saves the card, no charge).
      const { error: confirmErr, setupIntent } = await stripe.confirmCardSetup(
        setup.clientSecret,
        { payment_method: { card } },
      );
      if (confirmErr) throw new Error(confirmErr.message || "Card could not be saved.");

      const paymentMethodId = setupIntent?.payment_method as string;

      // 3. Create the subscription with the 30-day trial.
      const subRes = await fetch("/api/setup-intent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId, customerId: setup.customerId }),
      });
      const subJson = await subRes.json();
      if (!subRes.ok) throw new Error(subJson.error || "Could not activate your free month.");

      setDone(true);
      setTimeout(onActivated, 2000);
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
        background: "var(--bg-surface)",
        border: "1px solid var(--accent)",
        borderRadius: 4,
        padding: 24,
        marginTop: 16,
      }}
    >
      <p
        className="font-sans"
        style={{ fontSize: 16, color: "var(--text-primary)", marginBottom: 6 }}
      >
        Add your card to claim your free month
      </p>
      <p
        className="font-mono"
        style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 20 }}
      >
        You won&apos;t be charged until day 31. Cancel anytime before then.
      </p>

      <div
        style={{
          border: "1px solid var(--border-default)",
          borderRadius: 4,
          padding: "12px 14px",
          background: "var(--bg-base)",
          marginBottom: 16,
        }}
      >
        <CardElement options={cardElementOptions} />
      </div>

      {error && (
        <p className="font-mono" style={{ fontSize: 11, color: "#f85149", marginBottom: 12 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || done || !stripe}
        className="font-mono"
        style={{
          width: "100%",
          background: done ? "#22c55e" : "var(--accent)",
          color: "#0d1117",
          fontSize: 12,
          letterSpacing: "0.04em",
          padding: "12px 16px",
          borderRadius: 4,
          border: "none",
          cursor: loading || done ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {done
          ? "Free month active ✓"
          : loading
            ? "Activating..."
            : "Activate my free month →"}
      </button>
    </form>
  );
}

// ─── Countdown for the referred-offer banner ─────────────────────────────────
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
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

// ─── Shared bits ─────────────────────────────────────────────────────────────
type Feat = { name: string; desc: string };

const FREE_FEATURES: Feat[] = [
  { name: "Read everything", desc: "See all posts, cohort activity, and vault content" },
  { name: "Weekly check-in", desc: "Show your cohort where you are each week" },
  { name: "3 cohort posts / month", desc: "Post decisions, wins, or blockers to your cohort" },
  { name: "2 pulse posts / month", desc: "Share with the broader Quorum network" },
  { name: "5 replies / month", desc: "Engage with posts across the platform" },
  { name: "3 messages / month", desc: "Direct message other founders" },
  { name: "1 vault note", desc: "Save one note in your personal vault" },
  { name: "3 referrals max", desc: "Invite up to 3 founders to join" },
];
const MEMBER_FEATURES: Feat[] = [
  { name: "Everything in Free", desc: "All free tier features included" },
  { name: "Unlimited cohort posting", desc: "Post as much as you need to your cohort" },
  { name: "Unlimited pulse posts", desc: "Share freely with the whole network" },
  { name: "Unlimited replies", desc: "Engage with every conversation" },
  { name: "Unlimited messages", desc: "DM any founder, any time" },
  { name: "Unlimited vault notes", desc: "Full rich editor, unlimited storage" },
  { name: "Full collab board", desc: "Post projects, needs, and find hires" },
  { name: "Unlimited referrals", desc: "Invite as many founders as you want" },
  { name: "7 day free trial", desc: "Full access, no card required to start" },
];
const PARTNER_FEATURES: Feat[] = [
  { name: "Everything in Member", desc: "Full Member access included" },
  { name: "Private Partner feed", desc: "Exclusive feed for established founders doing real revenue" },
  { name: "Senior founder network", desc: "Curated cohort of founders who've been there" },
  { name: "Deal flow & introductions", desc: "Warm intros and opportunities from within the network" },
  { name: "Priority support", desc: "Direct access when you need it" },
];

const PRODUCT_BLOCKS = [
  {
    color: "#f59e0b",
    title: "Your Cohort",
    desc: "A private group of 12 vetted founders with the same drive as you. Real talk, real problems, real answers — no noise.",
  },
  {
    color: "#58a6ff",
    title: "The Pulse Feed",
    desc: "A network-wide feed where founders share decisions, wins, blockers, and questions. The honest version of LinkedIn.",
  },
  {
    color: "#22c55e",
    title: "The Collab Board",
    desc: "Post projects, find co-builders, list needs, and hire from a network you already trust. Work gets done here.",
  },
  {
    color: "#a78bfa",
    title: "The Vault",
    desc: "Save resources, write notes with a full rich editor, and access community wisdom nominated by the best founders in the network.",
  },
];

// Feature comparison rows. Values render as ✓ / limited text / — / "soon".
const COMPARISON_ROWS: { feature: string; free: string; member: string; partner: string }[] = [
  { feature: "Cohort access", free: "✓", member: "✓", partner: "✓" },
  { feature: "Read all content", free: "✓", member: "✓", partner: "✓" },
  { feature: "Weekly check-in", free: "✓", member: "✓", partner: "✓" },
  { feature: "Cohort posts", free: "3/mo", member: "✓", partner: "✓" },
  { feature: "Pulse posts", free: "2/mo", member: "✓", partner: "✓" },
  { feature: "Replies", free: "5/mo", member: "✓", partner: "✓" },
  { feature: "Messages", free: "3/mo", member: "✓", partner: "✓" },
  { feature: "Vault notes", free: "1", member: "✓", partner: "✓" },
  { feature: "Collab board", free: "—", member: "✓", partner: "✓" },
  { feature: "Referrals", free: "3 max", member: "✓", partner: "✓" },
  { feature: "7 day trial", free: "✓", member: "✓", partner: "✓" },
  { feature: "Partner feed", free: "—", member: "—", partner: "soon" },
  { feature: "Senior network", free: "—", member: "—", partner: "soon" },
  { feature: "Deal flow", free: "—", member: "—", partner: "soon" },
];

const FAQ_ITEMS = [
  {
    q: "Can I cancel anytime?",
    a: "Yes — cancel from your settings page at any time. You keep access until the end of your billing period.",
  },
  {
    q: "What happens when my trial ends?",
    a: "You drop to the free tier automatically. No surprise charges. Upgrade whenever you're ready.",
  },
  {
    q: "How do referrals work?",
    a: "Share your invite link. When someone joins and activates their account, you earn rewards — from $10 off to a free year of Member.",
  },
];

function ComparisonValue({ value }: { value: string }) {
  let color = "#8b949e";
  if (value === "✓") color = "#22c55e";
  else if (value === "—") color = "#30363d";
  else if (value === "soon") color = "#a78bfa";
  return (
    <span className="font-mono" style={{ fontSize: 11, color, textAlign: "center" }}>
      {value}
    </span>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen((v) => !v)}
      style={{
        background: "#161b22",
        border: "1px solid #21262d",
        borderRadius: 4,
        padding: "16px 20px",
        marginBottom: 8,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span className="font-sans" style={{ fontSize: 14, color: "#e6edf3" }}>
          {q}
        </span>
        <span className="font-mono" style={{ fontSize: 12, color: "#484f58" }}>
          {open ? "−" : "+"}
        </span>
      </div>
      {open && (
        <p className="font-sans" style={{ fontSize: 13, color: "#8b949e", marginTop: 10, lineHeight: 1.6 }}>
          {a}
        </p>
      )}
    </div>
  );
}

function Feature({ feat, nameColor, descColor, bullet }: { feat: Feat; nameColor: string; descColor: string; bullet: string }) {
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
      <span style={{ color: bullet, lineHeight: 1.4 }}>•</span>
      <span>
        <span className="font-sans" style={{ fontSize: 13, color: nameColor, display: "block" }}>
          {feat.name}
        </span>
        <span className="font-sans" style={{ fontSize: 12, color: descColor, display: "block", lineHeight: 1.4 }}>
          {feat.desc}
        </span>
      </span>
    </li>
  );
}

// ─── Page body (inside Elements provider) ────────────────────────────────────
function PricingBody() {
  const router = useRouter();
  const params = useSearchParams();
  const canceled = params.get("canceled") === "true";

  const [sub, setSub] = useState<Sub | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [showDowngrade, setShowDowngrade] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

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

  const tier = sub?.tier ?? "free";
  const referred = !!sub?.referred_free_month_available;
  const countdown = useCountdown(sub?.referred_free_month_expires_at ?? null);

  async function startCheckout() {
    setLoadingCheckout(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/subscription", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
      setShowDowngrade(false);
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

  // Member CTA depends on tier + referral state.
  const memberCta = useMemo(() => {
    if (tier === "member") return { label: "Current plan", disabled: true };
    if (tier === "partner") return { label: "Downgrade to Member →", disabled: false, action: "portal" as const };
    if (referred) return { label: "Claim my free month →", disabled: false, action: "claim" as const };
    return { label: "Start free trial →", disabled: false, action: "checkout" as const };
  }, [tier, referred]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        padding: "60px 40px",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{
            background: "transparent",
            border: "none",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
            color: "#484f58",
            letterSpacing: "0.06em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 40,
          }}
        >
          ← back
        </button>

        {/* Header */}
        <p
          className="font-mono uppercase"
          style={{ fontSize: 10, color: "var(--accent)", letterSpacing: "0.12em", textAlign: "center", marginBottom: 14 }}
        >
          // pricing
        </p>
        <h1
          className="font-sans"
          style={{ fontSize: 36, color: "var(--text-primary)", textAlign: "center", marginBottom: 12 }}
        >
          Simple, honest pricing.
        </h1>
        <p
          className="font-sans"
          style={{ fontSize: 16, color: "var(--text-secondary)", textAlign: "center", marginBottom: 60 }}
        >
          Start free. Upgrade when Quorum changes how you build.
        </p>

        {/* What is Quorum */}
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 4,
            padding: 32,
            marginBottom: 48,
          }}
        >
          <h2 className="font-sans" style={{ fontSize: 20, fontWeight: 500, color: "#e6edf3", marginBottom: 16 }}>
            What is Quorum?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
            {PRODUCT_BLOCKS.map((b) => (
              <div key={b.title} style={{ borderLeft: `2px solid ${b.color}`, padding: "0 0 0 16px" }}>
                <p className="font-sans" style={{ fontSize: 14, fontWeight: 500, color: "#e6edf3", marginBottom: 6 }}>
                  {b.title}
                </p>
                <p className="font-sans" style={{ fontSize: 13, color: "#6e7681", lineHeight: 1.6 }}>
                  {b.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Referred banner */}
        {referred && (
          <div
            style={{
              background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 4,
              padding: "14px 20px",
              marginBottom: 32,
            }}
          >
            <p className="font-mono" style={{ fontSize: 11, color: "#22c55e" }}>
              Your first month is on us — add a card below to claim it. Offer expires in {countdown}.
            </p>
          </div>
        )}

        {/* Tier cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, alignItems: "start" }}>
          {/* ── Free ── */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              padding: 28,
              position: "relative",
            }}
          >
            <p className="font-mono uppercase" style={{ fontSize: 9, color: "var(--text-disabled)", marginBottom: 12 }}>
              // free
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span className="font-sans" style={{ fontSize: 40, color: "var(--text-primary)" }}>$0</span>
              <span className="font-sans" style={{ fontSize: 16, color: "var(--text-disabled)" }}>/month</span>
            </div>
            <p className="font-sans" style={{ fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 20px" }}>
              Get a feel for the room.
            </p>
            <div style={{ height: 1, background: "var(--border-default)", margin: "20px 0" }} />
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {FREE_FEATURES.map((f) => (
                <Feature key={f.name} feat={f} nameColor="var(--text-secondary)" descColor="var(--text-disabled)" bullet="var(--border-muted)" />
              ))}
            </ul>
            {tier === "free" ? (
              <button
                disabled
                className="font-mono"
                style={{
                  width: "100%", marginTop: 24, padding: "12px 16px", borderRadius: 4,
                  background: "var(--bg-overlay)", color: "var(--text-disabled)", border: "none",
                  fontSize: 12, cursor: "default",
                }}
              >
                Current plan
              </button>
            ) : (
              <button
                onClick={() => setShowDowngrade(true)}
                className="font-mono"
                style={{
                  width: "100%", marginTop: 24, padding: "12px 16px", borderRadius: 4,
                  background: "transparent", color: "var(--text-disabled)",
                  border: "1px solid var(--border-default)", fontSize: 12, cursor: "pointer",
                }}
              >
                Downgrade to free →
              </button>
            )}
          </div>

          {/* ── Member (highlighted) ── */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--accent)",
              borderRadius: 4,
              padding: 28,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: "var(--accent)", borderRadius: "4px 4px 0 0",
              }}
            />
            <div
              className="font-mono"
              style={{
                position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                background: "var(--accent)", color: "#0d1117", fontSize: 9, letterSpacing: "0.1em",
                padding: "4px 12px", borderRadius: 3, whiteSpace: "nowrap",
              }}
            >
              MOST POPULAR
            </div>
            <p className="font-mono uppercase" style={{ fontSize: 9, color: "var(--accent)", marginBottom: 12 }}>
              // member
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span className="font-sans" style={{ fontSize: 40, color: "var(--text-primary)" }}>$49</span>
              <span className="font-sans" style={{ fontSize: 16, color: "var(--text-secondary)" }}>/month</span>
            </div>
            <p className="font-sans" style={{ fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 20px" }}>
              Full access. No limits. No noise.
            </p>
            <div style={{ height: 1, background: "var(--border-default)", margin: "20px 0" }} />
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {MEMBER_FEATURES.map((f) => (
                <Feature key={f.name} feat={f} nameColor="var(--text-secondary)" descColor="var(--text-disabled)" bullet="var(--accent)" />
              ))}
            </ul>
            <button
              disabled={memberCta.disabled || loadingCheckout || portalLoading}
              onClick={() => {
                if (memberCta.action === "checkout") startCheckout();
                else if (memberCta.action === "claim") setShowCardForm(true);
                else if (memberCta.action === "portal") openPortal();
              }}
              className="font-mono"
              style={{
                width: "100%", marginTop: 24, padding: "12px 16px", borderRadius: 4, fontSize: 12,
                border: "none",
                background: memberCta.disabled ? "var(--bg-overlay)" : "var(--accent)",
                color: memberCta.disabled ? "var(--text-disabled)" : "#0d1117",
                cursor: memberCta.disabled ? "default" : "pointer",
                opacity: loadingCheckout || portalLoading ? 0.7 : 1,
              }}
            >
              {loadingCheckout ? "Loading..." : memberCta.label}
            </button>
          </div>

          {/* ── Partner (coming soon) ── */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid rgba(167,139,250,0.2)",
              borderRadius: 4,
              padding: 28,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: "#a78bfa", borderRadius: "4px 4px 0 0",
              }}
            />
            <div
              className="font-mono"
              style={{
                position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                background: "#a78bfa", color: "#0d1117", fontSize: 9, letterSpacing: "0.1em",
                padding: "4px 12px", borderRadius: 3, whiteSpace: "nowrap",
              }}
            >
              COMING SOON
            </div>
            <p className="font-mono uppercase" style={{ fontSize: 9, color: "#a78bfa", marginBottom: 12 }}>
              // partner
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span className="font-sans" style={{ fontSize: 40, color: "var(--text-primary)" }}>$99</span>
              <span className="font-sans" style={{ fontSize: 16, color: "var(--text-disabled)" }}>/month</span>
            </div>
            <p className="font-sans" style={{ fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 20px" }}>
              The room where real business happens.
            </p>
            <div style={{ height: 1, background: "var(--border-default)", margin: "20px 0" }} />
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {PARTNER_FEATURES.map((f) => (
                <Feature key={f.name} feat={f} nameColor="var(--text-disabled)" descColor="var(--text-disabled)" bullet="var(--border-muted)" />
              ))}
            </ul>
            <p className="font-mono" style={{ fontSize: 10, color: "var(--text-disabled)", margin: "20px 0 12px" }}>
              We&apos;re curating the founding Partner cohort. Join the waitlist to be considered.
            </p>
            {tier === "partner" ? (
              <button
                disabled
                className="font-mono"
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 4, fontSize: 12,
                  background: "transparent", color: "var(--text-disabled)",
                  border: "1px solid var(--border-muted)", cursor: "default",
                }}
              >
                Current plan
              </button>
            ) : (
              <button
                onClick={joinWaitlist}
                disabled={waitlistJoined || waitlistLoading}
                className="font-mono"
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 4, fontSize: 12,
                  background: "transparent",
                  color: waitlistJoined ? "var(--text-disabled)" : "#a78bfa",
                  border: `1px solid ${waitlistJoined ? "var(--border-muted)" : "#a78bfa"}`,
                  cursor: waitlistJoined ? "default" : "pointer",
                  opacity: waitlistLoading ? 0.7 : 1,
                }}
              >
                {waitlistJoined ? "On the waitlist ✓" : waitlistLoading ? "Joining..." : "Join the waitlist →"}
              </button>
            )}
          </div>
        </div>

        {/* Embedded card form for referred claim */}
        {showCardForm && referred && (
          <CardForm onActivated={() => router.push("/home?trial=activated")} />
        )}

        {/* Canceled state */}
        {canceled && (
          <p
            className="font-mono"
            style={{ fontSize: 11, color: "var(--text-disabled)", textAlign: "center", marginTop: 32 }}
          >
            No worries — your free trial is still active.
          </p>
        )}

        {/* Feature comparison chart */}
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 4,
            overflow: "hidden",
            marginTop: 48,
            marginBottom: 48,
          }}
        >
          <div
            className="font-mono uppercase"
            style={{
              background: "#1c2128",
              padding: "14px 20px",
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr",
              fontSize: 10,
              letterSpacing: "0.08em",
            }}
          >
            <span style={{ color: "#484f58" }}>Feature</span>
            <span style={{ color: "#8b949e", textAlign: "center" }}>Free</span>
            <span style={{ color: "#f59e0b", textAlign: "center" }}>Member</span>
            <span style={{ color: "#a78bfa", textAlign: "center" }}>Partner</span>
          </div>
          {COMPARISON_ROWS.map((row, i) => (
            <div
              key={row.feature}
              style={{
                padding: "12px 20px",
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                borderTop: "1px solid #21262d",
                alignItems: "center",
                background: i % 2 === 0 ? "#161b22" : "rgba(255,255,255,0.01)",
              }}
            >
              <span className="font-sans" style={{ fontSize: 13, color: "#8b949e" }}>
                {row.feature}
              </span>
              <span style={{ textAlign: "center" }}>
                <ComparisonValue value={row.free} />
              </span>
              <span style={{ textAlign: "center" }}>
                <ComparisonValue value={row.member} />
              </span>
              <span style={{ textAlign: "center" }}>
                <ComparisonValue value={row.partner} />
              </span>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <p className="font-mono" style={{ fontSize: 10, color: "#484f58", letterSpacing: "0.1em", marginBottom: 12 }}>
          // common questions
        </p>
        {FAQ_ITEMS.map((item) => (
          <FaqItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>

      {/* Downgrade confirmation modal */}
      {showDowngrade && (
        <div
          onClick={() => setShowDowngrade(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)", border: "1px solid var(--border-default)",
              borderRadius: 4, padding: 28, maxWidth: 420, width: "100%",
            }}
          >
            <p className="font-sans" style={{ fontSize: 18, color: "var(--text-primary)", marginBottom: 8 }}>
              Downgrade to Free?
            </p>
            <p className="font-mono" style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
              You&apos;ll manage this in the billing portal. Your access stays active until the end of the current period.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDowngrade(false)}
                className="font-mono"
                style={{
                  padding: "10px 16px", borderRadius: 4, fontSize: 12, background: "transparent",
                  color: "var(--text-secondary)", border: "1px solid var(--border-default)", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="font-mono"
                style={{
                  padding: "10px 16px", borderRadius: 4, fontSize: 12, background: "var(--accent)",
                  color: "#0d1117", border: "none", cursor: "pointer", opacity: portalLoading ? 0.7 : 1,
                }}
              >
                {portalLoading ? "Opening..." : "Continue →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PricingPage() {
  return (
    <Elements stripe={stripePromise}>
      <Suspense fallback={null}>
        <PricingBody />
      </Suspense>
    </Elements>
  );
}
