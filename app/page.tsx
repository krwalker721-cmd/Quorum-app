import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WAITLIST_ENABLED } from "@/lib/flags";

export default async function RootPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!WAITLIST_ENABLED) redirect("/home");

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  if (profile?.status === "approved") redirect("/home");
  redirect("/pending");
}
