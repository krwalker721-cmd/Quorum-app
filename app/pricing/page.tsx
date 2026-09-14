import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Founding member, Member, and Partner plans. A free trial to start, no card required.",
};

// Reads ?canceled here, on the server, so the page renders in full before any
// JavaScript runs (see PricingClient).
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled } = await searchParams;
  return <PricingClient canceled={canceled === "true"} />;
}
