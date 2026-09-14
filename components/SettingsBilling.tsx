"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TierPill from "@/components/TierPill";
import ui from "@/components/ui/sleek.module.css";

type Sub = {
  tier: "free" | "member" | "partner";
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  has_stripe_subscription: boolean;
  /** Paid, or mid-trial. Gate on this, not the tier string (a card-free trial
   *  reports tier "free"). */
  has_full_access: boolean;
  access_reason: "paid" | "trial" | "none";
  is_trialing: boolean;
};

// From GET /api/billing: what Stripe holds, read-only.
type Billing = {
  subscription: {
    planLabel: string;
    amount: number | null;
    currency: string;
    interval: string | null;
    status: string;
    trialEnd: string | null;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    card: { brand: string; last4: string } | null;
    discounts: string[];
  } | null;
  invoices: {
    id: string;
    number: string | null;
    created: string;
    total: number;
    currency: string;
    status: string | null;
    url: string | null;
  }[];
};

const HAIRLINE = "1px solid rgba(255, 255, 255, 0.06)";

function fmtDate(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

// Whole days remaining until `ts` (0 once it's in the past).
function daysLeft(ts: string | null): number {
  if (!ts) return 0;
  const diff = new Date(ts).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}

function sentence(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// There is no free tier: an account without a membership or a live trial can
// read, but its write limits are zero. Say so, rather than naming a plan that
// doesn't exist.
function statusLine(sub: Sub): { text: string; color: string } {
  const muted = "var(--text-secondary)";
  if (sub.cancel_at_period_end) {
    return { text: `Cancels ${fmtDate(sub.current_period_end)}`, color: muted };
  }
  if (sub.status === "past_due") {
    return { text: "Payment failed — update your card", color: "#f87171" };
  }
  if (sub.status === "trialing") {
    const d = daysLeft(sub.trial_ends_at);
    // An expired trial must read as expired — never a stale future-tense
    // "trial ends" with a past date sitting next to "Unlimited".
    if (d <= 0) {
      return { text: "Trial ended — add a card to keep your cohort seat", color: muted };
    }
    return { text: `Trial ends in ${d} ${d === 1 ? "day" : "days"}`, color: "#f8c56a" };
  }
  if (sub.access_reason === "paid") {
    return {
      text: sub.current_period_end
        ? `Active — next billing ${fmtDate(sub.current_period_end)}`
        : "Active",
      color: "#4ade80",
    };
  }
  if (sub.status === "canceled") {
    return { text: "Membership ended — rejoin to post, reply, and message", color: muted };
  }
  return { text: "No active membership — join to post, reply, and message", color: muted };
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4" style={{ fontSize: 14 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-right" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export default function SettingsBilling() {
  const router = useRouter();
  const [sub, setSub] = useState<Sub | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [billingError, setBillingError] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSub(d))
      .catch(() => {});
    fetch("/api/billing")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Billing) => setBilling(d))
      .catch(() => setBillingError(true));
  }, []);

  async function manageBilling() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/subscription", { method: "POST" });
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } finally {
      setPortalLoading(false);
    }
  }

  const tier = sub?.tier ?? "free";
  const status = sub ? statusLine(sub) : null;
  // Accounts with no Stripe subscription (a card-free trial, or no membership
  // at all) get a path to a plan instead of the billing portal.
  const showUpgrade = tier === "free" && !sub?.has_stripe_subscription;
  const s = billing?.subscription ?? null;
  const invoices = billing?.invoices ?? [];

  // The next date money moves: the trial's end for a Stripe trial, otherwise
  // the end of the current period. Nothing moves once cancellation is set.
  const chargeLabel = s?.cancelAtPeriodEnd ? "Access ends" : s?.status === "trialing" ? "First charge" : "Next charge";
  const chargeDate = s?.status === "trialing" ? s.trialEnd : s?.periodEnd ?? null;

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid rgba(255, 255, 255, 0.07)",
        borderRadius: 12,
        padding: 24,
        marginBottom: 16,
      }}
    >
      <div className="flex items-center justify-between gap-3" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Billing</h2>
        <TierPill sleek tier={tier} />
      </div>

      <p style={{ fontSize: 14, color: status?.color ?? "var(--text-muted)" }}>
        {status ? status.text : "Loading…"}
      </p>

      {/* There are no metered free limits to show: an account either has full
          access or can't write at all. */}
      {sub && (
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)", marginTop: 8 }}>
          {sub.has_full_access
            ? "Unlimited posts, replies, messages, and notes this month."
            : "You can read everything. Posting, replies, and messages open up with a membership."}
        </p>
      )}

      {/* What Stripe holds — read-only here; changes go through the portal. */}
      {s && (
        <div className="space-y-2.5" style={{ marginTop: 18, paddingTop: 16, borderTop: HAIRLINE }}>
          <Row
            label="Plan"
            value={
              s.amount != null && s.interval
                ? `${s.planLabel} · ${money(s.amount, s.currency)}/${s.interval}`
                : s.planLabel
            }
          />
          {chargeDate && <Row label={chargeLabel} value={fmtDate(chargeDate)} />}
          {s.card && <Row label="Card" value={`${sentence(s.card.brand)} ending ${s.card.last4}`} />}
          {s.discounts.map((d) => (
            <Row key={d} label="Discount" value={d} />
          ))}
        </div>
      )}

      {invoices.length > 0 && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: HAIRLINE }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>Invoices</p>
          <div className="space-y-1" style={{ margin: "0 -8px" }}>
            {invoices.map((inv) => (
              <div key={inv.id} className={`flex items-center gap-3 ${ui.row}`} style={{ padding: "7px 8px", fontSize: 14 }}>
                <span className="flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                  {fmtDate(inv.created)}
                </span>
                <span style={{ color: "var(--text-secondary)" }}>{money(inv.total, inv.currency)}</span>
                <span
                  className={ui.chip}
                  style={
                    inv.status === "paid"
                      ? { color: "#4ade80", borderColor: "rgba(34, 197, 94, 0.35)" }
                      : inv.status === "open"
                        ? { color: "#f8c56a", borderColor: "rgba(245, 158, 11, 0.35)" }
                        : undefined
                  }
                >
                  {sentence(inv.status ?? "draft")}
                </span>
                {inv.url ? (
                  <a href={inv.url} target="_blank" rel="noopener noreferrer" className={ui.tileLink}>
                    View →
                  </a>
                ) : (
                  <span style={{ width: 44 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {billingError && sub?.has_stripe_subscription && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 14 }}>
          Couldn&apos;t load your plan details right now. The billing portal has everything.
        </p>
      )}

      <button
        type="button"
        onClick={showUpgrade ? () => router.push("/pricing") : manageBilling}
        disabled={portalLoading}
        className={showUpgrade ? ui.primaryBtn : ui.ghostBtn}
        style={{ marginTop: 18 }}
      >
        {portalLoading
          ? "Opening…"
          : showUpgrade
            ? sub?.is_trialing
              ? "Choose a plan →"
              : "Become a member →"
            : "Change card, plan, or cancel →"}
      </button>
    </section>
  );
}
