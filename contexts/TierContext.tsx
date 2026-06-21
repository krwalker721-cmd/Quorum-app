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
 * APPROVED direct /api/subscription callers (do not need to use useTier):
 * - components/SettingsBilling.tsx — needs POST for portal session
 * - components/ProfileBilling.tsx — needs POST for portal session
 * - components/PaywallModal.tsx — needs POST for checkout action
 * - app/(app)/layout.tsx — server-side bootstrap
 * - components/onboarding/Step18_Pricing.tsx — onboarding checkout context
 *
 * All other components must use useTier() from this context.
 */
export type Tier = "free" | "member" | "partner";

interface TierData {
  tier: Tier;
  status: string;
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
}

const DEFAULTS: TierData = {
  tier: "free",
  status: "trialing",
  trialEndsAt: null,
  daysLeftInTrial: null,
  subscriptionCreatedAt: null,
  partnerWaitlist: false,
};

const TierContext = createContext<TierContextValue>({
  ...DEFAULTS,
  isLoading: true,
  refresh: () => {},
});

export function TierProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TierData>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription");
      const json = await res.json();

      // Client-side trial expiry check — if the trial window has passed but the
      // server-side expire-trials cron hasn't flipped status yet (up to a 1h
      // window), treat the user as free locally so caps kick in immediately.
      if (json.status === "trialing" && json.trial_ends_at) {
        const trialEnd = new Date(json.trial_ends_at);
        if (trialEnd < new Date()) {
          setData({
            tier: "free",
            status: "active",
            trialEndsAt: null,
            daysLeftInTrial: 0,
            subscriptionCreatedAt: json.created_at || null,
            partnerWaitlist: !!json.partner_waitlist,
          });
          return;
        }
      }

      let daysLeft: number | null = null;
      if (json.trial_ends_at) {
        const trialEnd = new Date(json.trial_ends_at);
        const now = new Date();
        const diff = Math.ceil(
          (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        daysLeft = diff > 0 ? diff : 0;
      }

      setData({
        tier: (json.tier as Tier) || "free",
        status: json.status || "trialing",
        trialEndsAt: json.trial_ends_at || null,
        daysLeftInTrial: daysLeft,
        subscriptionCreatedAt: json.created_at || null,
        partnerWaitlist: !!json.partner_waitlist,
      });
    } catch (err) {
      console.error("TierContext fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <TierContext.Provider value={{ ...data, isLoading, refresh: fetchData }}>
      {children}
    </TierContext.Provider>
  );
}

export function useTier() {
  return useContext(TierContext);
}
