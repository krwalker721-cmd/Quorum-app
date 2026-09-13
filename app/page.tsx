import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WAITLIST_ENABLED } from "@/lib/flags";
import Landing from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "quorum — a private network for founders",
  description:
    "A private network of founders sharing real decisions, wins, and blockers, anchored by a cohort of twelve you meet every week.",
};

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Signed-out visitors get the landing page instead of a bare login box.
  if (!user) return <Landing />;

  if (!WAITLIST_ENABLED) redirect("/home");

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  if (profile?.status === "approved") redirect("/home");
  redirect("/pending");
}
