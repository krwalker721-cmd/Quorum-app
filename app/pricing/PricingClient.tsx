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
import { PRICING, FOUNDING_SEATS, TRIAL_DAYS } from "@/lib/pricing";
import LegalLinks from "@/components/LegalLinks";
import NoGrid from "@/components/ui/NoGrid";
import ui from "@/components/ui/sleek.module.css";
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

const HAIRLINE = "1px solid rgba(255, 255, 255, 0.07)";
const SANS = "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif";

const cardElementOptions = {
  style: {
    base: {
      color: "#e6edf3",
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: "15px",
      "::placeholder": { color: "#6e7681" },
      backgroundColor: "transparent",
    },
    invalid: { color: "#f87171" },
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

      // 3. Create the subscription, starting when the trial ends.
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
    <form onSubmit={handleSubmit} className={ui.tileHero} style={{ padding: 24, marginTop: 20 }}>
      <p style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
        Add your card to claim your free month
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)", marginBottom: 18 }}>
        {`You won’t be charged until ${chargeDate ?? "your trial ends"}. Then your membership renews automatically at $${PRICING.member.monthly}/month until you cancel — cancel before ${chargeDate ?? "then"} to pay nothing.`}
      </p>

      <div
        style={{
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 10,
          padding: "13px 14px",
          background: "rgba(0, 0, 0, 0.25)",
          marginBottom: 16,
        }}
      >
        <CardElement options={cardElementOptions} />
      </div>

      {/* A checkbox row: the global `label` rule is lowercase mono, so the
          font and case are set here. */}
      <label
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          marginBottom: 16,
          cursor: "pointer",
          lineHeight: 1.6,
          fontFamily: SANS,
          textTransform: "none",
          letterSpacing: 0,
          fontSize: 13,
          color: "var(--text-secondary)",
        }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ marginTop: 3, accentColor: "#f59e0b" }}
        />
        <span>
          {`I agree that my membership starts automatically on ${chargeDate ?? "the day my trial ends"} and renews at $${PRICING.member.monthly}/month until I cancel. Cancelling before then costs nothing.`}{" "}
          <a href="/terms" target="_blank" rel="noreferrer" style={{ color: "#f8c56a" }}>
            Terms
          </a>
        </span>
      </label>

      {error && <p style={{ fontSize: 13, color: "#f87171", marginBottom: 12 }}>{error}</p>}

      <button
        type="submit"
        disabled={loading || done || !stripe || !agreed}
        className={`${ui.primaryBtn} w-full`}
        style={{
          padding: "12px 16px",
          fontSize: 14,
          ...(done ? { background: "#22c55e", boxShadow: "none" } : {}),
        }}
      >
        {done ? "Free month active ✓" : loading ? "Activating…" : "Activate my free month →"}
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

// Feature comparison rows. Values render as ✓ / — / "soon". (The first column's
// key is `free` for history; it is the Founding plan.)
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
  if (value === "✓") return <span style={{ fontSize: 15, color: "#4ade80" }} aria-label="Included">✓</span>;
  if (value === "—") return <span style={{ fontSize: 15, color: "var(--text-muted)", opacity: 0.6 }} aria-label="Not included">—</span>;
  return <span style={{ fontSize: 12, color: "#a78bfa" }}>Soon</span>;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={ui.tile} style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left flex justify-between items-center gap-3"
        style={{ padding: "16px 20px", background: "none", border: "none", cursor: "pointer" }}
      >
        <span style={{ fontSize: 15, color: "var(--text-primary)" }}>{q}</span>
        <span aria-hidden style={{ fontSize: 18, lineHeight: 1, color: "var(--text-muted)" }}>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-secondary)", padding: "0 20px 16px" }}>
          {a}
        </p>
      )}
    </div>
  );
}

function FeatureList({ items, dim = false }: { items: Feat[]; dim?: boolean }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="space-y-3">
      {items.map((f) => (
        <li key={f.name} className="flex gap-2.5 items-start">
          <span
            aria-hidden
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              marginTop: 8,
              flexShrink: 0,
              background: dim ? "var(--text-muted)" : "#f59e0b",
            }}
          />
          <span>
            <span style={{ display: "block", fontSize: 14, color: dim ? "var(--text-secondary)" : "var(--text-primary)" }}>
              {f.name}
            </span>
            <span style={{ display: "block", fontSize: 13, lineHeight: 1.45, color: "var(--text-muted)" }}>
              {f.desc}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function PlanHeader({
  label,
  labelColor,
  price,
  chip,
  blurb,
}: {
  label: string;
  labelColor?: string;
  price: number;
  chip?: React.ReactNode;
  blurb: string;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: labelColor ?? "var(--text-secondary)" }}>{label}</p>
        {chip}
      </div>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 42, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
          ${price}
        </span>
        <span style={{ fontSize: 15, color: "var(--text-muted)" }}>/month</span>
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)", marginTop: 8 }}>{blurb}</p>
    </>
  );
}

const DIVIDER = <div style={{ height: 1, background: "rgba(255, 255, 255, 0.07)", margin: "20px 0" }} />;

// ─── Page body (inside Elements provider) ────────────────────────────────────
function PricingBody({ canceled }: { canceled: boolean }) {
  const router = useRouter();

  const [sub, setSub] = useState<Sub | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
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
  // to start something they couldn't start twice. There is no free plan to
  // "upgrade" from, so the paid CTA says what it is.
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
        label: "Become a member →",
        disabled: false,
        action: "checkout" as const,
        sub:
          daysLeft !== null
            ? `Your trial is running — ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left. Nothing is charged until it ends.`
            : "Your trial is running. Nothing is charged until it ends.",
      };
    }
    if (hadTrial) {
      return {
        label: "Become a member →",
        disabled: false,
        action: "checkout" as const,
        sub: "Your trial has ended. Pick up where you left off.",
      };
    }
    return { label: "Become a member →", disabled: false, action: "checkout" as const };
  }, [tier, referred, coldVisitor, trialing, daysLeft, hadTrial]);

  return (
    <main className={`min-h-screen ${ui.pageGlow}`} style={{ padding: "40px 20px 64px" }}>
      <NoGrid />
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <button type="button" onClick={goBack} className={ui.tileLink} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          ← Back
        </button>

        {/* Header */}
        <div className="text-center" style={{ marginTop: 32, marginBottom: 40 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#f8c56a", marginBottom: 12 }}>Pricing</p>
          <h1
            className={`${ui.titleGradient} ${ui.balance}`}
            style={{ fontSize: "clamp(32px, 5vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Simple, honest pricing.
          </h1>
          <p className={ui.balance} style={{ fontSize: 16, lineHeight: 1.55, color: "var(--text-secondary)", marginTop: 12 }}>
            {trialing && daysLeft !== null
              ? `Your trial is running — ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left. Then a room worth paying for.`
              : `${TRIAL_DAYS.standard} days free. Then a room worth paying for.`}
          </p>
        </div>

        {/* What is Quorum */}
        <section className={ui.tile} style={{ padding: 28, marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 18 }}>
            What is Quorum?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PRODUCT_BLOCKS.map((b) => (
              <div key={b.title} style={{ borderLeft: "2px solid rgba(245, 158, 11, 0.35)", paddingLeft: 16 }}>
                <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>{b.title}</p>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Referred banner */}
        {referred && (
          <div
            style={{
              background: "rgba(34, 197, 94, 0.07)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              borderRadius: 12,
              padding: "14px 20px",
              marginBottom: 24,
            }}
          >
            <p style={{ fontSize: 14, color: "#4ade80" }}>
              Your first month is on us — add a card below to claim it. Offer expires in {countdown}.
            </p>
          </div>
        )}

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {/* ── Founding member ── */}
          <div className={ui.tile} style={{ padding: 26 }}>
            <PlanHeader
              label="Founding member"
              price={PRICING.founding.monthly}
              blurb={`Full Member access, locked at this rate for life. First ${FOUNDING_SEATS} founders only.`}
            />
            {DIVIDER}
            <FeatureList items={FOUNDING_FEATURES} dim />
            <button
              type="button"
              onClick={() => startCheckout("founding")}
              disabled={loadingCheckout}
              className={`${ui.ghostBtn} w-full`}
              style={{ marginTop: 24, padding: "12px 16px", fontSize: 14 }}
            >
              Claim founding rate →
            </button>
          </div>

          {/* ── Member: the one amber hero ── */}
          <div className={ui.tileHero} style={{ padding: 26 }}>
            <PlanHeader
              label="Member"
              labelColor="#f8c56a"
              price={PRICING.member.monthly}
              chip={<span className={`${ui.chip} ${ui.chipAmber}`}>Most popular</span>}
              blurb="Full access. No limits. No noise."
            />
            {/* Annual prepay is the main lever against monthly churn, so it gets
                a real line rather than being buried in checkout. */}
            <button
              type="button"
              onClick={() => startCheckout("member_annual")}
              disabled={loadingCheckout}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                marginTop: 8,
                fontFamily: SANS,
                fontSize: 13,
                color: "#f8c56a",
                cursor: loadingCheckout ? "default" : "pointer",
                textAlign: "left",
              }}
            >
              Or ${PRICING.member.annual}/year — 2 months free →
            </button>
            {DIVIDER}
            <FeatureList items={MEMBER_FEATURES} />
            <button
              type="button"
              disabled={memberCta.disabled || loadingCheckout || portalLoading}
              onClick={() => {
                if (memberCta.action === "checkout") startCheckout();
                else if (memberCta.action === "claim") setShowCardForm(true);
                else if (memberCta.action === "portal") openPortal();
              }}
              className={`${ui.primaryBtn} w-full`}
              style={{
                marginTop: 24,
                padding: "12px 16px",
                fontSize: 14,
                ...(memberCta.disabled
                  ? { background: "rgba(255, 255, 255, 0.06)", color: "var(--text-muted)", boxShadow: "none" }
                  : {}),
              }}
            >
              {loadingCheckout ? "Loading…" : memberCta.label}
            </button>
            {memberCta.sub && (
              <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)", marginTop: 10, textAlign: "center" }}>
                {memberCta.sub}
              </p>
            )}
          </div>

          {/* ── Partner (coming soon) ── */}
          <div className={ui.tile} style={{ padding: 26 }}>
            <PlanHeader
              label="Partner"
              labelColor="#a78bfa"
              price={PRICING.partner.monthly}
              chip={
                <span className={ui.chip} style={{ color: "#a78bfa", borderColor: "rgba(167, 139, 250, 0.35)" }}>
                  Coming soon
                </span>
              }
              blurb="The room where real business happens."
            />
            {DIVIDER}
            <FeatureList items={PARTNER_FEATURES} dim />
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)", margin: "20px 0 12px" }}>
              We&apos;re curating the founding Partner cohort. Join the waitlist to be considered.
            </p>
            {tier === "partner" ? (
              <button type="button" disabled className={`${ui.ghostBtn} w-full`} style={{ padding: "12px 16px", fontSize: 14 }}>
                Current plan
              </button>
            ) : (
              <button
                type="button"
                onClick={joinWaitlist}
                disabled={waitlistJoined || waitlistLoading}
                className={`${ui.ghostBtn} w-full`}
                style={{
                  padding: "12px 16px",
                  fontSize: 14,
                  ...(waitlistJoined ? {} : { color: "#c4b5fd", borderColor: "rgba(167, 139, 250, 0.4)" }),
                }}
              >
                {waitlistJoined ? "On the waitlist ✓" : waitlistLoading ? "Joining…" : "Join the waitlist →"}
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
          <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", marginTop: 28 }}>
            {trialing ? "No worries — your trial is still running." : "No charge made — join whenever you're ready."}
          </p>
        )}

        {/* Feature comparison chart */}
        <section className={ui.tile} style={{ marginTop: 40, marginBottom: 40, overflow: "hidden" }}>
          <div className="comparison-scroll" style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 520 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  padding: "14px 20px",
                  fontSize: 13,
                  fontWeight: 500,
                  borderBottom: HAIRLINE,
                  background: "rgba(255, 255, 255, 0.02)",
                }}
              >
                <span style={{ color: "var(--text-muted)" }}>Feature</span>
                <span style={{ color: "var(--text-secondary)", textAlign: "center" }}>Founding</span>
                <span style={{ color: "#f8c56a", textAlign: "center" }}>Member</span>
                <span style={{ color: "#a78bfa", textAlign: "center" }}>Partner</span>
              </div>
              {COMPARISON_ROWS.map((row, i) => (
                <div
                  key={row.feature}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr",
                    alignItems: "center",
                    padding: "11px 20px",
                    borderTop: i === 0 ? "none" : "1px solid rgba(255, 255, 255, 0.04)",
                  }}
                >
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{row.feature}</span>
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
        </section>

        {/* FAQ */}
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>
          Common questions
        </h2>
        {FAQ_ITEMS.map((item) => (
          <FaqItem key={item.q} q={item.q} a={item.a} />
        ))}

        {/* Automatic-renewal terms, stated plainly on the page that sells the plan. */}
        <p
          className={ui.balance}
          style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)", textAlign: "center", marginTop: 36 }}
        >
          Memberships renew automatically — ${PRICING.member.monthly}/month, or ${PRICING.member.annual}/year —
          until you cancel. Cancel anytime from settings; access runs to the end of the period
          you&apos;ve paid for, and payments aren&apos;t refunded.
        </p>
        <LegalLinks className="mt-6" />
      </div>
    </main>
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
