"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = ["free", "tier_1", "tier_2"] as const;
type Tier = (typeof OPTIONS)[number];

export default function TierSelect({ id, currentTier }: { id: string; currentTier: string }) {
  const router = useRouter();
  const [tier, setTier] = useState<Tier>((OPTIONS as readonly string[]).includes(currentTier) ? (currentTier as Tier) : "free");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(next: Tier) {
    if (next === tier) return;
    const prev = tier;
    setTier(next);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/set-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, tier: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body.error ?? "failed").toString().toLowerCase());
        setTier(prev);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        {OPTIONS.map((opt) => {
          const active = tier === opt;
          const color = opt === "free" ? "#707070" : opt === "tier_1" ? "#dc6414" : "#22c55e";
          return (
            <button
              key={opt}
              onClick={() => update(opt)}
              disabled={isPending}
              className="font-mono lowercase text-[0.6rem] px-2 py-1 border disabled:opacity-50 transition-opacity"
              style={{
                borderColor: color,
                color: active ? "#000" : color,
                background: active ? color : "transparent",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {error && <p className="font-mono text-[0.6rem] text-red-400 lowercase">{error}</p>}
    </div>
  );
}
