import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RoomPlaceholder from "@/components/hackathon/RoomPlaceholder";
import { loadSprint } from "@/lib/hackathons/page";
import { getMemberStanding } from "@/lib/hackathons/viewer";

export const dynamic = "force-dynamic";

// The Sprint-wide chat. PLACEHOLDER until the lobby prompt builds it.
// Participants, accepted judges and admins get in (the same people the
// lobby's RLS lets read it); everyone else goes back to the Sprint page.
export default async function LobbyPage(props: { params: Promise<{ number: string }> }) {
  const { number } = await props.params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const sprint = await loadSprint(supabase, n);
  if (!sprint) notFound();

  const [standing, { data: reg }, { data: judge }] = await Promise.all([
    getMemberStanding(supabase, user.id),
    supabase
      .from("hackathon_registrations")
      .select("id")
      .eq("hackathon_id", sprint.id)
      .eq("user_id", user.id)
      .is("withdrawn_at", null)
      .maybeSingle(),
    supabase
      .from("hackathon_judges")
      .select("id")
      .eq("hackathon_id", sprint.id)
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .maybeSingle(),
  ]);
  if (!reg && !judge && !standing.isAdmin) redirect(`/hackathon/${n}`);

  return (
    <RoomPlaceholder
      number={n}
      title="Lobby"
      line="The chat for everyone in this Sprint opens here soon."
      tier={standing.tier}
      userId={user.id}
    />
  );
}
