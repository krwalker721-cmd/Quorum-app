import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RoomPlaceholder from "@/components/hackathon/RoomPlaceholder";
import { loadSprint } from "@/lib/hackathons/page";
import { getMemberStanding } from "@/lib/hackathons/viewer";

export const dynamic = "force-dynamic";

// Your team's private room. PLACEHOLDER until the team room prompt builds it.
// Only the team's own members get past this check (the room's tables are
// sealed by RLS regardless); everyone else goes back to the Sprint page.
export default async function TeamRoomPage(props: { params: Promise<{ number: string }> }) {
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

  const [{ tier }, { data: membership }] = await Promise.all([
    getMemberStanding(supabase, user.id),
    supabase
      .from("hackathon_team_members")
      .select("team_id")
      .eq("hackathon_id", sprint.id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!membership) redirect(`/hackathon/${n}`);

  return (
    <RoomPlaceholder
      number={n}
      title="Team room"
      line="Your team's private room (thread, docs, links and votes) opens here soon."
      tier={tier}
      userId={user.id}
    />
  );
}
