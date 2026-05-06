import { createClient } from "@/lib/supabase/server";
import StubPage from "../_stub/StubPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("tier").eq("id", user.id).single();
  return <StubPage title="referrals" userId={user.id} tier={(profile?.tier ?? "free").toUpperCase()} />;
}
