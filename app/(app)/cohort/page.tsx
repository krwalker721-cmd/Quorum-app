import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CohortClient from "@/components/cohort/CohortClient";

export const dynamic = "force-dynamic";

export default async function CohortPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, stage")
    .eq("status", "approved")
    .neq("id", user.id)
    .order("created_at", { ascending: true });

  return (
    <>
      <TopBar title="cohort" tier={(profile?.tier ?? "free").toUpperCase()} userId={user.id} />
      <CohortClient members={members ?? []} currentUserId={user.id} />
    </>
  );
}
