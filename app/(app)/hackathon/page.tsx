import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import NoGrid from "@/components/ui/NoGrid";
import { getMemberStanding } from "@/lib/hackathons/viewer";
import { pickCurrentSprint, type SprintRow } from "@/lib/hackathons/sprint";
import EmptyBuildathon from "@/components/hackathon/empty/EmptyBuildathon";

export const dynamic = "force-dynamic";

// /hackathon opens the current Sprint's own page, so every Sprint has one
// shareable address: live, then judging, teams locked, registration,
// announced, and finally the most recently revealed. Nothing is hard-coded to
// a particular Sprint; with none published, this shows what the format is
// (EmptyBuildathon).
//
// Development only: /hackathon?preview=empty shows that page even while
// Sprints exist, for working on it.
export default async function HackathonIndex(props: { searchParams: Promise<{ preview?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const previewing = process.env.NODE_ENV === "development" && (await props.searchParams).preview === "empty";

  const { data } = await supabase
    .from("hackathon_overview")
    .select("number, state, phase, is_published, starts_at, reveal_at")
    .eq("is_published", true);
  const rows = (data ?? []) as Pick<SprintRow, "number" | "state" | "phase" | "is_published" | "starts_at" | "reveal_at">[];
  const current = previewing ? null : pickCurrentSprint(rows);
  if (current) redirect(`/hackathon/${current.number}`);

  const { tier } = await getMemberStanding(supabase, user.id);
  return (
    <>
      <NoGrid />
      <TopBar sleek title="buildathon" tier={tier} userId={user.id} />
      <div className="page-pad" style={{ padding: "24px 26px 56px", width: "100%" }}>
        <EmptyBuildathon hasPast={rows.some((r) => r.state === "revealed" || r.state === "cancelled")} />
      </div>
    </>
  );
}
