import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RoomPlaceholder from "@/components/hackathon/RoomPlaceholder";
import { loadSprint } from "@/lib/hackathons/page";
import { getMemberStanding } from "@/lib/hackathons/viewer";
import { roomHref } from "@/lib/hackathons/room";

export const dynamic = "force-dynamic";

// The team's submission. PLACEHOLDER until Prompt 8 builds the form. Same
// door as the room: the team's members and admins.
export default async function SubmissionPage(props: { params: Promise<{ number: string; slug: string }> }) {
  const { number, slug } = await props.params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [standing, sprint] = await Promise.all([getMemberStanding(supabase, user.id), loadSprint(supabase, n)]);
  if (!sprint) notFound();

  const { data: team } = await supabase.from("hackathon_teams").select("id").eq("hackathon_id", sprint.id).eq("slug", slug).maybeSingle();
  const { data: membership } = team
    ? await supabase.from("hackathon_team_members").select("role").eq("team_id", team.id).eq("user_id", user.id).maybeSingle()
    : { data: null };
  if (!team || (!membership && !standing.isAdmin)) redirect(`/hackathon/${n}?notice=room-private`);

  return (
    <RoomPlaceholder
      number={n}
      backHref={roomHref(n, slug)}
      backLabel="← Team room"
      title="Submission"
      line="The submission form opens here soon."
      tier={standing.tier}
      userId={user.id}
    />
  );
}
