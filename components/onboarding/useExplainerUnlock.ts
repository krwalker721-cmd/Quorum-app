"use client";

import { useCallback, useMemo, useState } from "react";

// Tracks which explainer cards a user has opened. The screen's CTA stays locked
// until every card has been seen at least once. `active` is the currently open
// card (drives the live left-hand visual); `seen` is the cumulative set.
export interface ExplainerUnlock {
  active: number | null;
  seen: Set<number>;
  selectCard: (index: number) => void;
  isUnlocked: boolean;
  seenCount: number;
}

export function useExplainerUnlock(totalCards: number): ExplainerUnlock {
  const [active, setActive] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());

  const selectCard = useCallback((index: number) => {
    setActive(index);
    setSeen((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const isUnlocked = seen.size >= totalCards;

  return useMemo(
    () => ({ active, seen, selectCard, isUnlocked, seenCount: seen.size }),
    [active, seen, selectCard, isUnlocked]
  );
}
