"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

/**
 * TierContext provides tier and subscription status app-wide.
 *
 * Gate features on `hasFullAccess`, never on `tier === "free"`. A card-free trial
 * stores tier "free" (there is no paid tier to stamp), so tier comparisons treat
 * trialing founders as lapsed — which is how the app came to show upgrade nudges
 * to people whose trial banner said "full member access".
 *
 * APPROVED direct /api/subscription callers (do not need to use useTier):
 * - components/SettingsBilling.tsx — needs POST for portal session
 * - components/ProfileBilling.tsx — needs POST for portal session
 * - components/PaywallModal.tsx — needs POST for checkout action
 * - app/(app)/layout.tsx — server-side bootstrap
 * - app/pricing/page.tsx — checkout + portal context
 *
 * All other components must use useTier() from this context.
 */
export type Tier = "free" | "member" | "partner";

export type AccessReason = "paid" | "trial" | "none";

interface TierData {
  tier: Tier;
  status: string;
  /** THE permission bit: paid or inside a live trial. */
  hasFullAccess: boolean;
  accessReason: AccessReason;
  /** The trial window is open right now (not merely that status says trialing). */
  isTrialing: boolean;
  hadTrial: boolean;
  paymentFailing: boolean;
  trialEndsAt: string | null;
  daysLeftInTrial: number | null;
  // created_at of the subscription row — used to detect the first-24h welcome
  // window on the home feed.
  subscriptionCreatedAt: string | null;
  partnerWaitlist: boolean;
}

interface TierContextValue extends TierData {
  isLoading: boolean;
  refresh: () => void;
  /** Force a Stripe → Supabase sync, then refresh. Use after checkout returns. */
  reconcile: () => Promise<void>;
}

const DEFAULTS: TierData = {
  tier: "free",
  status: "trialing",
  hasFullAccess: false,
  accessReason: "none",
  isTrialing: false,
  hadTrial: false,
  paymentFailing: false,
  trialEndsAt: null,
  daysLeftInTrial: null,
  subscriptionCreatedAt: null,
  partnerWaitlist: false,
};

const TierContext = createContext<TierContextValue>({
  ...DEFAULTS,
  isLoading: true,
  refresh: () => {},
  reconcile: async () => {},
});

export function TierProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TierData>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription");
      if (!res.ok) return;
      const json = await res.json();

      // Entitlement is resolved server-side now (lib/entitlements.ts), including
      // the trial-window check that used to be duplicated here — and including a
      // Stripe reconcile when the stored state grants nothing, so a paying member
      // whose webhook was missed arrives here already healed.
      setData({
        tier: (json.tier as Tier) || "free",
        status: json.status || "trialing",
        hasFullAccess: !!json.has_full_access,
        accessReason: (json.access_reason as AccessReason) || "none",
        isTrialing: !!json.is_trialing,
        hadTrial: !!json.had_trial,
        paymentFailing: !!json.payment_failing,
        trialEndsAt: json.trial_ends_at || null,
        daysLeftInTrial:
          typeof json.days_left_in_trial === "number" ? json.days_left_in_trial : null,
        subscriptionCreatedAt: json.created_at || null,
        partnerWaitlist: !!json.partner_waitlist,
      });
    } catch (err) {
      console.error("TierContext fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reconcile = useCallback(async () => {
    try {
      await fetch("/api/subscription/reconcile", { method: "POST" });
    } catch (err) {
      console.error("TierContext reconcile failed:", err);
    }
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <TierContext.Provider value={{ ...data, isLoading, refresh: fetchData, reconcile }}>
      {children}
    </TierContext.Provider>
  );
}

export function useTier() {
  return useContext(TierContext);
}
