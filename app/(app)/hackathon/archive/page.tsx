import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import NoGrid from "@/components/ui/NoGrid";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import LocalTime from "@/components/hackathon/LocalTime";
import { getMemberStanding } from "@/lib/hackathons/viewer";
import { STATE_LABEL, type SprintRow } from "@/lib/hackathons/sprint";

export const dynamic = "force-dynamic";

type ArchiveRow = Pick<SprintRow, "number" | "title" | "tagline" | "state" | "starts_at" | "reveal_at" | "status_override_at">;

// Every past Sprint: revealed ones, and cancelled ones (marked as such), newest first.
export default async function HackathonArchive() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ tier }, { data }] = await Promise.all([
    getMemberStanding(supabase, user.id),
    supabase
      .from("hackathon_overview")
      .select("number, title, tagline, state, starts_at, reveal_at, status_override_at")
      .eq("is_published", true)
      .in("state", ["revealed", "cancelled"])
      .order("number", { ascending: false }),
  ]);
  const past = (data ?? []) as ArchiveRow[];

  return (
    <>
      <NoGrid />
      <TopBar sleek title="buildathon" tier={tier} userId={user.id} />
      <div className="page-pad" style={{ padding: "18px 26px 48px", maxWidth: 820, margin: "0 auto", width: "100%" }}>
        <Link href="/hackathon" style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
          ← Current Sprint
        </Link>
        <h1
          className={`${ui.titleGradient} ${ui.balance}`}
          style={{ fontSize: 28, fontWeight: 650, letterSpacing: "-0.03em", marginTop: 12, marginBottom: 16 }}
        >
          Past Sprints
        </h1>

        {past.length === 0 ? (
          <Tile>
            <div className={ui.empty}>
              <p className={ui.emptyTitle}>No Sprint has finished yet.</p>
            </div>
          </Tile>
        ) : (
          <ul className="flex flex-col" style={{ gap: 10 }}>
            {past.map((s) => (
              <li key={s.number}>
                <Tile padding="14px 16px">
                  <Link href={`/hackathon/${s.number}`} style={{ textDecoration: "none", display: "block" }}>
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Sprint #{s.number}</span>
                      <span className={ui.chip} style={s.state === "cancelled" ? { color: "#fca5a5" } : undefined}>
                        {STATE_LABEL[s.state]}
                      </span>
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>{s.title}</p>
                    {s.tagline && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{s.tagline}</p>}
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                      {s.state === "cancelled" ? "Cancelled " : "Revealed "}
                      <LocalTime iso={s.state === "cancelled" ? s.status_override_at : s.reveal_at} format="date" />
                    </p>
                  </Link>
                  {s.state === "revealed" && (
                    <Link href={`/hackathon/${s.number}/recap`} style={{ display: "inline-block", fontSize: 12.5, color: "#f8c56a", textDecoration: "none", marginTop: 8 }}>
                      Public recap ↗
                    </Link>
                  )}
                </Tile>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
