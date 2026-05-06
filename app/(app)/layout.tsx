import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WAITLIST_ENABLED } from "@/lib/flags";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, stage, status, tier")
    .eq("id", user.id)
    .single();

  if (WAITLIST_ENABLED && profile?.status !== "approved") redirect("/pending");

  const { data: cohortRaw } = await supabase
    .from("profiles")
    .select("id, full_name, stage")
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(20);

  const cohort = cohortRaw ?? [];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar cohort={cohort} currentUserId={user.id} />
      <div style={{ marginLeft: 192 }}>{children}</div>
    </div>
  );
}
