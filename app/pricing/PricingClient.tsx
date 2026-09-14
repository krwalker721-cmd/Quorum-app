"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { PRICING, FOUNDING_SEATS, TRIAL_DAYS, LAPSE_GRACE_DAYS } from "@/lib/pricing";
import LegalLinks from "@/components/LegalLinks";
import { PRODUCT_BLOCKS, FAQ_ITEMS } from "@/lib/marketing-copy";

// Publishable key is safe to expose. If it's missing the card form simply won't
// mount — the cold-signup checkout flow still works without it.
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

type Sub = {
  tier: "free" | "member" | "partner";
  status: string;
  trial_ends_at: string | null;
  // Resolved server-side by lib/entitlements.ts. `tier` is "free" during a
  // card-free trial, so these are what tell the page where the founder actually
  // stands.
  is_trialing: boolean;
  had_trial: boolean;
  days_left_in_trial: number | null;
  has_full_access: boolean;
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
function CardForm({
  onActivated,
  trialEndsAt,
}: {
  onActivated: () => void;
  /** When the trial this card claims ends — which is when the first charge lands. */
  trialEndsAt: string | null;
}) {
  // This line is the only automatic-renewal notice on this path (it never passes
  // through Stripe Checkout), so it names the real date and price. It used to say
  // "day 31", which was wrong for the 45-day referred trial this form claims.
  const chargeDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Affirmative consent to the renewal terms — required by the automatic-renewal
  // laws before a trial may convert, and enforced again server-side.
  const [agreed, setAgreed] = useState(false);

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
        body: JSON.stringify({
          paymentMethodId,
          customerId: setup.customerId,
          renewalConsent: agreed,
          // This form only offers Member monthly; the route resolves the price.
          plan: "member",
        }),
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
        borderRadius: 12,
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
        {`You won’t be charged until ${chargeDate ?? "your trial ends"}. Then your membership renews automatically at $${PRICING.member.monthly}/month until you cancel — cancel before ${chargeDate ?? "then"} to pay nothing.`}
      </p>

      <div
        style={{
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: "12px 14px",
          background: "var(--bg-base)",
          marginBottom: 16,
        }}
      >
        <CardElement options={cardElementOptions} />
      </div>

      <label
        style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16, cursor: "pointer", lineHeight: 1.6 }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ marginTop: 3, accentColor: "var(--accent)" }}
        />
        <span>
          {`I agree that my membership starts automatically on ${chargeDate ?? "the day my trial ends"} and renews at $${PRICING.member.monthly}/month until I cancel. Cancelling before then costs nothing.`}{" "}
          <a href="/terms" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            Terms
          </a>
        </span>
      </label>

      {error && (
        <p className="font-mono" style={{ fontSize: 11, color: "#f85149", marginBottom: 12 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || done || !stripe || !agreed}
        className="font-mono"
        style={{
          width: "100%",
          background: done ? "#22c55e" : "var(--accent)",
          color: "#0d1117",
          fontSize: 12,
          letterSpacing: "0.04em",
          padding: "12px 16px",
          borderRadius: 12,
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

// Founding rate replaces the old free tier. A cohort seat is one of twelve, so
// there is no rung that lets someone occupy one without paying — but the room is
// still filling, and the founding rate prices that honestly.
const FOUNDING_FEATURES: Feat[] = [
  { name: "Everything in Member", desc: "Identical access — only the price differs" },
  { name: "Locked for life", desc: "Your rate never rises, no matter what Member costs later" },
  { name: "Founding member badge", desc: "Permanent mark that you were here at the start" },
  { name: "Direct line on what we build", desc: "Founding members shape the roadmap first" },
  { name: `Limited to ${FOUNDING_SEATS} seats`, desc: "When they're gone, the rate closes for good" },
];
const MEMBER_FEATURES: Feat[] = [
  { name: "Read everything", desc: "Every post, cohort, and vault entry" },
  { name: "Unlimited cohort posting", desc: "Post as much as you need to your cohort" },
  { name: "Unlimited pulse posts", desc: "Share freely with the whole network" },
  { name: "Unlimited replies", desc: "Engage with every conversation" },
  { name: "Unlimited messages", desc: "DM any founder, any time" },
  { name: "Unlimited vault notes", desc: "Full rich editor, unlimited storage" },
  { name: "Full collab board", desc: "Post projects, needs, and find hires" },
  { name: "Unlimited referrals", desc: "Invite as many founders as you want" },
  {
    name: `${TRIAL_DAYS.standard} day trial`,
    desc: "Granted the moment you join — no card required",
  },
];
const PARTNER_FEATURES: Feat[] = [
  { name: "Everything in Member", desc: "Full Member access included" },
  { name: "Private Partner feed", desc: "Exclusive feed for established founders doing real revenue" },
  { name: "Senior founder network", desc: "Curated cohort of founders who've been there" },
  { name: "Deal flow & introductions", desc: "Warm intros and opportunities from within the network" },
  { name: "Priority support", desc: "Direct access when you need it" },
];

// Feature comparison rows. Values render as ✓ / limited text / — / "soon".
const COMPARISON_ROWS: { feature: string; free: string; member: string; partner: string }[] = [
  { feature: "Cohort seat", free: "✓", member: "✓", partner: "✓" },
  { feature: "Read all content", free: "✓", member: "✓", partner: "✓" },
  { feature: "Weekly check-in", free: "✓", member: "✓", partner: "✓" },
  { feature: "Cohort posts", free: "✓", member: "✓", partner: "✓" },
  { feature: "Pulse posts", free: "✓", member: "✓", partner: "✓" },
  { feature: "Replies", free: "✓", member: "✓", partner: "✓" },
  { feature: "Messages", free: "✓", member: "✓", partner: "✓" },
  { feature: "Vault notes", free: "✓", member: "✓", partner: "✓" },
  { feature: "Collab board", free: "✓", member: "✓", partner: "✓" },
  { feature: "Referrals", free: "✓", member: "✓", partner: "✓" },
  { feature: `${TRIAL_DAYS.standard} day trial`, free: "✓", member: "✓", partner: "✓" },
  { feature: "Rate locked for life", free: "✓", member: "—", partner: "—" },
  { feature: "Partner feed", free: "—", member: "—", partner: "soon" },
  { feature: "Senior network", free: "—", member: "—", partner: "soon" },
  { feature: "Deal flow", free: "—", member: "—", partner: "soon" },
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
        borderRadius: 12,
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
function PricingBody({ canceled }: { canceled: boolean }) {
  const router = useRouter();

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

  // The trial is granted at onboarding, without a card (see
  // /api/subscription/initialize) — so by the time a signed-in founder reaches
  // this page it is already running, or already over. Nothing here can start one,
  // which is why the CTA no longer offers to.
  const trialing = !!sub?.is_trialing;
  const daysLeft = sub?.days_left_in_trial ?? null;
  const hadTrial = !!sub?.had_trial;
  // Signed out (or the fetch failed): this is a cold visitor being pitched, and
  // for them the trial genuinely is something signing up starts.
  const coldVisitor = sub === null;

  async function startCheckout(plan: "member" | "member_annual" | "founding" = "member") {
    setLoadingCheckout(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
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

  // Not a bare router.back(): Stripe returns an abandoned checkout here through
  // cancel_url as a fresh history entry, so the entry behind this page is
  // Checkout itself, and "back" would reopen it. Go to "/" in that case, and
  // when there's no history to go back through at all — it already routes each
  // visitor to the right place (login, pending, or home).
  function goBack() {
    if (canceled || window.history.length <= 1) {
      router.push("/");
    } else {
      router.back();
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

  // Member CTA depends on where the founder actually stands. "Start free trial"
  // used to be the fallback for every signed-in state, which made no sense to
  // anyone already mid-trial (or already lapsed out of one) — the button offered
  // to start something they couldn't start twice.
  const memberCta = useMemo<{
    label: string;
    disabled: boolean;
    action?: "checkout" | "claim" | "portal";
    /** Optional line under the button explaining the state. */
    sub?: string;
  }>(() => {
    if (tier === "member") return { label: "Current plan", disabled: true };
    if (tier === "partner") {
      return { label: "Downgrade to Member →", disabled: false, action: "portal" as const };
    }
    if (referred) {
      return { label: "Claim my free month →", disabled: false, action: "claim" as const };
    }
    if (coldVisitor) {
      return { label: "Join Quorum →", disabled: false, action: "checkout" as const };
    }
    if (trialing) {
      return {
        label: "Become a Member →",
        disabled: false,
        action: "checkout" as const,
        sub:
          daysLeft !== null
            ? `// your trial is running — ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left, nothing is charged until it ends`
            : "// your trial is running — nothing is charged until it ends",
      };
    }
    if (hadTrial) {
      return {
        label: "Upgrade to Member →",
        disabled: false,
        action: "checkout" as const,
        sub: "// your trial has ended — pick this up where you left off",
      };
    }
    return { label: "Upgrade to Member →", disabled: false, action: "checkout" as const };
  }, [tier, referred, coldVisitor, trialing, daysLeft, hadTrial]);

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
          onClick={goBack}
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
          {trialing && daysLeft !== null
            ? `Your trial is running — ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left. Then a room worth paying for.`
            : `${TRIAL_DAYS.standard} days free. Then a room worth paying for.`}
        </p>

        {/* What is Quorum */}
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 12,
            padding: 32,
            marginBottom: 48,
          }}
        >
          <h2 className="font-sans" style={{ fontSize: 20, fontWeight: 500, color: "#e6edf3", marginBottom: 16 }}>
            What is Quorum?
          </h2>
          <div className="stack-md" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
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
              borderRadius: 12,
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
        <div className="stack-tiers" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, alignItems: "start" }}>
          {/* ── Founding member ── */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              padding: 28,
              position: "relative",
            }}
          >
            <p className="font-mono uppercase" style={{ fontSize: 9, color: "var(--text-disabled)", marginBottom: 12 }}>
              // founding member
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span className="font-sans" style={{ fontSize: 40, color: "var(--text-primary)" }}>${PRICING.founding.monthly}</span>
              <span className="font-sans" style={{ fontSize: 16, color: "var(--text-disabled)" }}>/month</span>
            </div>
            <p className="font-sans" style={{ fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 20px" }}>
              Full Member access, locked at this rate for life. First {FOUNDING_SEATS} founders only.
            </p>
            <div style={{ height: 1, background: "var(--border-default)", margin: "20px 0" }} />
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {FOUNDING_FEATURES.map((f) => (
                <Feature key={f.name} feat={f} nameColor="var(--text-secondary)" descColor="var(--text-disabled)" bullet="var(--border-muted)" />
              ))}
            </ul>
            <button
              onClick={() => startCheckout("founding")}
              disabled={loadingCheckout}
              className="font-mono"
              style={{
                width: "100%", marginTop: 24, padding: "12px 16px", borderRadius: 12,
                background: "transparent", color: "var(--text-primary)",
                border: "1px solid var(--border-default)", fontSize: 12,
                cursor: loadingCheckout ? "default" : "pointer",
                opacity: loadingCheckout ? 0.6 : 1,
              }}
            >
              Claim founding rate →
            </button>
          </div>

          {/* ── Member (highlighted) ── */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--accent)",
              borderRadius: 12,
              padding: 28,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: "var(--accent)", borderRadius: "12px 12px 0 0",
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
              <span className="font-sans" style={{ fontSize: 40, color: "var(--text-primary)" }}>${PRICING.member.monthly}</span>
              <span className="font-sans" style={{ fontSize: 16, color: "var(--text-secondary)" }}>/month</span>
            </div>
            <p className="font-sans" style={{ fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 8px" }}>
              Full access. No limits. No noise.
            </p>
            {/* Annual prepay is the main lever against monthly churn, so it gets
                a real line rather than being buried in checkout. */}
            <button
              onClick={() => startCheckout("member_annual")}
              disabled={loadingCheckout}
              className="font-mono"
              style={{
                background: "transparent", border: "none", padding: 0, marginBottom: 20,
                fontSize: 11, color: "var(--accent)",
                cursor: loadingCheckout ? "default" : "pointer", textAlign: "left",
              }}
            >
              or ${PRICING.member.annual}/year — 2 months free →
            </button>
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
                width: "100%", marginTop: 24, padding: "12px 16px", borderRadius: 10, fontSize: 12,
                fontWeight: 500,
                border: "none",
                background: memberCta.disabled
                  ? "var(--bg-overlay)"
                  : "linear-gradient(135deg, rgba(245,158,11,.92), rgba(245,158,11,.72))",
                color: memberCta.disabled ? "var(--text-disabled)" : "#1a1204",
                cursor: memberCta.disabled ? "default" : "pointer",
                opacity: loadingCheckout || portalLoading ? 0.7 : 1,
              }}
            >
              {loadingCheckout ? "Loading..." : memberCta.label}
            </button>
            {memberCta.sub && (
              <p
                className="font-mono"
                style={{
                  fontSize: 10,
                  color: "var(--text-disabled)",
                  marginTop: 8,
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                {memberCta.sub}
              </p>
            )}
          </div>

          {/* ── Partner (coming soon) ── */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid rgba(167,139,250,0.2)",
              borderRadius: 12,
              padding: 28,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: "#a78bfa", borderRadius: "12px 12px 0 0",
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
              <span className="font-sans" style={{ fontSize: 40, color: "var(--text-primary)" }}>${PRICING.partner.monthly}</span>
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
                  width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 12,
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
                  width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 12,
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
          <CardForm
            onActivated={() => router.push("/home?trial=activated")}
            trialEndsAt={sub?.trial_ends_at ?? null}
          />
        )}

        {/* Returned from an abandoned checkout. Only claim the trial is still
            running when it actually is — this line used to reassure a lapsed
            founder about a trial that had already ended. */}
        {canceled && (
          <p
            className="font-mono"
            style={{ fontSize: 11, color: "var(--text-disabled)", textAlign: "center", marginTop: 32 }}
          >
            {trialing
              ? "No worries — your trial is still running."
              : "No charge made — upgrade whenever you're ready."}
          </p>
        )}

        {/* Feature comparison chart */}
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 12,
            overflow: "hidden",
            marginTop: 48,
            marginBottom: 48,
          }}
        >
          <div className="comparison-scroll">
          <div>
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
            <span style={{ color: "#8b949e", textAlign: "center" }}>Founding</span>
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
          </div>
        </div>

        {/* FAQ */}
        <p className="font-mono" style={{ fontSize: 10, color: "#484f58", letterSpacing: "0.1em", marginBottom: 12 }}>
          // common questions
        </p>
        {FAQ_ITEMS.map((item) => (
          <FaqItem key={item.q} q={item.q} a={item.a} />
        ))}

        {/* Automatic-renewal terms, stated plainly on the page that sells the plan. */}
        <p
          className="font-mono"
          style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.7, marginTop: 40 }}
        >
          Memberships renew automatically — ${PRICING.member.monthly}/month, or ${PRICING.member.annual}/year —
          until you cancel. Cancel anytime from settings; access runs to the end of the period
          you&apos;ve paid for, and payments aren&apos;t refunded.
        </p>
        <LegalLinks className="mt-6" />
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
              borderRadius: 12, padding: 28, maxWidth: 420, width: "100%",
            }}
          >
            <p className="font-sans" style={{ fontSize: 18, color: "var(--text-primary)", marginBottom: 8 }}>
              Cancel your membership?
            </p>
            <p className="font-mono" style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
              You&apos;ll manage this in the billing portal. Access stays active until the end of the current period, after which your cohort seat is held for {LAPSE_GRACE_DAYS} days before returning to the pool.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDowngrade(false)}
                className="font-mono"
                style={{
                  padding: "10px 16px", borderRadius: 12, fontSize: 12, background: "transparent",
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
                  padding: "10px 16px", borderRadius: 12, fontSize: 12, background: "var(--accent)",
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

// `canceled` comes from the server page (page.tsx) rather than from
// useSearchParams, which made Next skip server-rendering this page: it was
// blank until JavaScript loaded, including for link previews and crawlers.
export default function PricingClient({ canceled }: { canceled: boolean }) {
  return (
    <Elements stripe={stripePromise}>
      <PricingBody canceled={canceled} />
    </Elements>
  );
}
