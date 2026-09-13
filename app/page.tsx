import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isWaitlistOn } from "@/lib/platform";
import { approveUser } from "@/lib/admin/approve";
import Landing from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "quorum — a private network for founders",
  description:
    "A private network of founders sharing real decisions, wins, and blockers, anchored by a cohort of twelve you meet every week.",
};

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const waitlistOn = await isWaitlistOn();

  // Signed-out visitors get the landing page instead of a bare login box.
  if (!user) return <Landing waitlistOn={waitlistOn} />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  if (profile?.status === "approved") redirect("/home");

  // Open signup (admin → Settings → platform_status: open) has no waiting
  // room. Approve on arrival, which starts the trial and seats them in a cohort
  // exactly as a manual approval does, minus the "you're in" email.
  if (!waitlistOn && profile?.status === "pending") {
    await approveUser(createAdminClient(), user.id, { notify: false });
    redirect("/home");
  }

  redirect("/pending");
}
