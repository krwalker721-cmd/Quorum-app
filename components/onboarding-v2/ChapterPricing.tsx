"use client";

import dynamic from "next/dynamic";

// Stripe + the pricing body only ship once the user actually scrolls this far.
const PricingSection = dynamic(() => import("./PricingSection"), { ssr: false });

// Chapter 15 — the destination. Full viewport; the pricing cards animate in via
// PricingSection's own reveals. onComplete marks onboarding done and routes on.
export function ChapterPricing({
  onComplete,
}: {
  onComplete: (redirectTo: string) => void;
}) {
  return (
    <section
      id="chapter-15"
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "64px 20px",
        boxSizing: "border-box",
      }}
    >
      <PricingSection onComplete={onComplete} />
    </section>
  );
}
