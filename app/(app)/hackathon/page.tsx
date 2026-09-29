import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import NoGrid from "@/components/ui/NoGrid";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import { getMemberStanding } from "@/lib/hackathons/viewer";
import { pickCurrentSprint, type SprintRow } from "@/lib/hackathons/sprint";

export const dynamic = "force-dynamic";

// /hackathon opens the current Sprint's own page, so every Sprint has one
// shareable address: live, then judging, teams locked, registration,
// announced, and finally the most recently revealed. Nothing is hard-coded to
// a particular Sprint; with none published, this says so.
export default async function HackathonIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("hackathon_overview")
    .select("number, state, phase, is_published, starts_at, reveal_at")
    .eq("is_published", true);
  const rows = (data ?? []) as Pick<SprintRow, "number" | "state" | "phase" | "is_published" | "starts_at" | "reveal_at">[];
  const current = pickCurrentSprint(rows);
  if (current) redirect(`/hackathon/${current.number}`);

  const { tier } = await getMemberStanding(supabase, user.id);
  return (
    <>
      <NoGrid />
      <TopBar sleek title="hackathon" tier={tier} userId={user.id} />
      <div className="page-pad" style={{ padding: "24px 26px 48px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <h1 className={`${ui.titleGradient} ${ui.balance}`} style={{ fontSize: 28, fontWeight: 650, letterSpacing: "-0.03em" }}>
          Sprints
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8, marginBottom: 18 }}>
          48 hours to build something new with founders from across the network.
        </p>
        <Tile>
          <div className={ui.empty}>
            <p className={ui.emptyTitle}>No Sprint is scheduled right now.</p>
            <p className={ui.emptySub}>
              The next one will be announced here.
              {rows.length > 0 && (
                <>
                  {" "}
                  <Link href="/hackathon/archive" style={{ color: "var(--text-secondary)" }}>
                    See past Sprints →
                  </Link>
                </>
              )}
            </p>
          </div>
        </Tile>
      </div>
    </>
  );
}
