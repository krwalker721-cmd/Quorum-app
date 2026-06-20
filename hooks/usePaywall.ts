import { useState, useCallback } from "react";

export type Feature =
  | "cohort_posts"
  | "pulse_posts"
  | "replies"
  | "messages"
  | "vault_notes"
  | "collab_posts";

interface PaywallState {
  isOpen: boolean;
  feature: Feature | null;
  currentUsage: number;
  limit: number;
  hadTrial: boolean;
}

const INITIAL: PaywallState = {
  isOpen: false,
  feature: null,
  currentUsage: 0,
  limit: 0,
  hadTrial: false,
};

export function usePaywall() {
  const [paywallState, setPaywallState] = useState<PaywallState>(INITIAL);

  // Check if an action is allowed before performing it. Returns true if allowed,
  // false if blocked (and opens the paywall). Fails open on any error so a
  // network hiccup never blocks a user.
  const checkAndGate = useCallback(async (feature: Feature): Promise<boolean> => {
    try {
      const res = await fetch("/api/usage");
      const data = await res.json();

      // Paid users always pass.
      if (data.tier === "member" || data.tier === "partner") return true;

      // Active trial — full access, no caps.
      if (data.status === "trialing") return true;

      const current = (data.usage?.[feature] as number) || 0;
      const limit = data.limits?.[feature] as number;

      // Unlimited (-1) always passes.
      if (limit === -1) return true;

      // At or over the limit — show the paywall.
      if (current >= limit) {
        setPaywallState({
          isOpen: true,
          feature,
          currentUsage: current,
          limit,
          hadTrial: data.hadTrial || false,
        });
        return false;
      }

      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Paywall check failed:", err);
      return true; // Fail open — don't block users if the check fails.
    }
  }, []);

  const closePaywall = useCallback(() => {
    setPaywallState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    paywallState,
    checkAndGate,
    closePaywall,
  };
}
