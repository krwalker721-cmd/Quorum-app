import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import ReferralsDashboard from "@/components/referrals/ReferralsDashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();
  const tier = (profile?.tier ?? "free").toUpperCase();

  return (
    <>
      <TopBar title="referrals" tier={tier} userId={user.id} />
      <ReferralsDashboard />
    </>
  );
}
