import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadSprint } from "@/lib/hackathons/page";
import { roomHref } from "@/lib/hackathons/room";

export const dynamic = "force-dynamic";

// "My team room": sends a team member to their own team's room (its address
// carries the team's slug). Anyone without a team goes back to the Sprint
// page, which says why.
export default async function MyTeamRoomPage(props: { params: Promise<{ number: string }> }) {
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

  const { data: membership } = await supabase
    .from("hackathon_team_members")
    .select("team_id")
    .eq("hackathon_id", sprint.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: team } = membership
    ? await supabase.from("hackathon_teams").select("slug").eq("id", membership.team_id).maybeSingle()
    : { data: null };
  const slug = team?.slug as string | undefined;
  if (!slug) redirect(`/hackathon/${n}?notice=no-team`);
  redirect(roomHref(n, slug));
}
