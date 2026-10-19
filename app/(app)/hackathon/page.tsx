import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import NoGrid from "@/components/ui/NoGrid";
import { getMemberStanding } from "@/lib/hackathons/viewer";
import { pickCurrentSprint, SPRINT_COLUMNS, type SprintRow } from "@/lib/hackathons/sprint";
import BuildathonHome from "@/components/hackathon/home/BuildathonHome";
import type { CurrentSprint } from "@/components/hackathon/home/CurrentSprintBanner";

export const dynamic = "force-dynamic";

// The Buildathon home. It stays its own page: the Sprint that's on (live, then
// judging, teams locked, registration, announced, then the latest revealed)
// gets a banner with its clock and the way in, and each Sprint keeps its own
// page at /hackathon/N. Below that, what the format is.
//
// Development only: /hackathon?preview=empty shows the page as if no Sprint
// were on, for working on it.
export default async function BuildathonIndex(props: { searchParams: Promise<{ preview?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const previewing = process.env.NODE_ENV === "development" && (await props.searchParams).preview === "empty";

  const [{ tier }, { data }] = await Promise.all([
    getMemberStanding(supabase, user.id),
    supabase.from("hackathon_overview").select(SPRINT_COLUMNS).eq("is_published", true),
  ]);
  const rows = (data ?? []) as unknown as SprintRow[];
  const picked = previewing ? null : pickCurrentSprint(rows);
  const current = picked ? await describe(supabase, picked, user.id) : null;

  return (
    <>
      <NoGrid />
      <TopBar sleek title="buildathon" tier={tier} userId={user.id} />
      <div className="page-pad" style={{ padding: "24px 26px 56px", width: "100%" }}>
        <BuildathonHome current={current} hasPast={rows.some((r) => r.state === "revealed" || r.state === "cancelled")} />
      </div>
    </>
  );
}

/** The banner's words for the current Sprint, from the viewer's side of it. */
async function describe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sprint: SprintRow,
  userId: string,
): Promise<CurrentSprint> {
  const href = `/hackathon/${sprint.number}`;
  const [{ data: mine }, { data: people }] = await Promise.all([
    supabase.from("hackathon_registrations").select("withdrawn_at").eq("hackathon_id", sprint.id).eq("user_id", userId).maybeSingle(),
    sprint.state === "registration" ? supabase.rpc("hackathon_registrants", { p_hackathon_id: sprint.id }) : Promise.resolve({ data: null }),
  ]);
  const registered = !!mine && !mine.withdrawn_at;

  const at = (label: string, iso: string | null) => (iso ? { label, at: iso } : null);
  let countdown: CurrentSprint["countdown"] = null;
  let cta = { label: `Open Buildathon #${sprint.number}`, href };
  switch (sprint.state) {
    case "upcoming":
      countdown = at("Registration opens in", sprint.registration_opens_at);
      cta = { label: "See what it is", href };
      break;
    case "registration":
      countdown = at("Sign-ups close in", sprint.team_lock_at);
      // The Sprint's page opens by saying what it is, then its Register button.
      cta = registered ? { label: "You're signed up · open it", href } : { label: "Sign up", href };
      break;
    case "teams_locked":
      countdown = at("Kicks off in", sprint.starts_at);
      break;
    case "live":
      countdown = at("Submissions close in", sprint.ends_at);
      cta = { label: registered ? "Go to your Buildathon" : "Watch it live", href };
      break;
    case "judging":
      countdown = at("Results revealed in", sprint.reveal_at);
      break;
    case "revealed":
      cta = { label: "See the results", href };
      break;
  }

  const count = Array.isArray(people) ? people.length : null;
  return {
    number: sprint.number,
    title: sprint.title,
    tagline: sprint.tagline,
    state: sprint.state,
    countdown,
    ticking: sprint.show_countdown_in_app,
    cta,
    meta: count === null ? null : count === 0 ? "Nobody has signed up yet." : `${count} signed up so far`,
  };
}
