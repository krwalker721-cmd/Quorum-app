import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Stable, guessable entry point to the current user's profile. Resolves the
// username server-side and redirects to /profile/[username] so the sidebar can
// link here without knowing the slug.
export default async function MyProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile?.username) redirect("/home");

  redirect(`/profile/${profile.username}`);
}
