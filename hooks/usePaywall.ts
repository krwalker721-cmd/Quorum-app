import { useState, useCallback } from "react";

export type Feature =
  | "cohort_posts"
  | "pulse_posts"
  | "replies"
  | "messages"
  | "vault_notes"
  | "collab_posts";

/** The code every write route returns when the account has no live entitlement. */
export const UPGRADE_REQUIRED = "UPGRADE_REQUIRED";

interface PaywallState {
  isOpen: boolean;
  feature: Feature | null;
  hadTrial: boolean;
}

const INITIAL: PaywallState = {
  isOpen: false,
  feature: null,
  hadTrial: false,
};

export function usePaywall() {
  const [paywallState, setPaywallState] = useState<PaywallState>(INITIAL);

  /** Open the upgrade overlay for a feature, without a round trip. */
  const openPaywall = useCallback((feature: Feature, hadTrial = false) => {
    setPaywallState({ isOpen: true, feature, hadTrial });
  }, []);

  // Check whether an action is allowed before performing it. Returns true if
  // allowed, false if blocked (and opens the upgrade overlay). Fails open on any
  // error — the write routes enforce the same gate server-side, so a network
  // hiccup here costs a wasted request, not a bypass.
  const checkAndGate = useCallback(async (feature: Feature): Promise<boolean> => {
    try {
      const res = await fetch("/api/usage");
      if (!res.ok) return true;
      const data = await res.json();

      // One bit decides it: paid or inside a live trial. This used to compare
      // usage against a limit, which meant a trialing account (limit 0, because
      // its tier is "free") was told it had hit a cap it never had.
      if (data.hasFullAccess) return true;

      setPaywallState({
        isOpen: true,
        feature,
        hadTrial: !!data.hadTrial,
      });
      return false;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Paywall check failed:", err);
      return true; // Fail open — the server route is the real gate.
    }
  }, []);

  /**
   * Handle a write route's failure response. Turns an UPGRADE_REQUIRED 403 into
   * the overlay and reports whether it was handled, so call sites can skip their
   * inline error message. Anything else is a genuine error the caller shows.
   */
  const handleGateResponse = useCallback(
    (feature: Feature, body: { code?: string } | null | undefined): boolean => {
      if (body?.code !== UPGRADE_REQUIRED) return false;
      setPaywallState({ isOpen: true, feature, hadTrial: false });
      return true;
    },
    [],
  );

  const closePaywall = useCallback(() => {
    setPaywallState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    paywallState,
    checkAndGate,
    openPaywall,
    handleGateResponse,
    closePaywall,
  };
}
