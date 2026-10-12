import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import NoGrid from "@/components/ui/NoGrid";
import ui from "@/components/ui/sleek.module.css";
import SprintAutoRefresh from "@/components/hackathon/SprintAutoRefresh";
import { StatusBanner } from "@/components/hackathon/SprintSections";
import LobbyClient, { type LobbyMessageRow, type LobbyPerson } from "@/components/hackathon/lobby/LobbyClient";
import { loadSprint } from "@/lib/hackathons/page";
import { getMemberStanding } from "@/lib/hackathons/viewer";
import { postLobbyMilestones } from "@/lib/hackathons/lobbyMilestones";
import { toTiming } from "@/lib/hackathons/sprint";

export const dynamic = "force-dynamic";

const MESSAGE_LIMIT = 300;

// The Sprint-wide chat (Phase 7): participants, accepted judges and admins,
// from registration on and after the event, until lobby_closes_at if the
// admin sets one. The database decides who reads and writes (migration 019);
// this check only gives everyone else a friendly word on the Sprint page.
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
  if (!reg && !judge && !standing.isAdmin) redirect(`/hackathon/${n}?notice=lobby-private`);

  if (sprint.is_published) await postLobbyMilestones(sprint.id);

  const [messages, welcome, people] = await Promise.all([
    supabase
      .from("hackathon_lobby_messages")
      .select("id, user_id, body, is_system, is_pinned, system_key, created_at, deleted_at")
      .eq("hackathon_id", sprint.id)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_LIMIT),
    supabase.rpc("hackathon_lobby_welcome", { p_hackathon_id: sprint.id }),
    supabase.rpc("hackathon_lobby_people", { p_hackathon_id: sprint.id }),
  ]);

  // Who may post, on the database's terms (private.can_write_lobby). The
  // database refuses anything else regardless.
  const closesAt = sprint.lobby_closes_at ? Date.parse(sprint.lobby_closes_at) : null;
  const open = sprint.is_published && sprint.state !== "cancelled" && (closesAt === null || Date.now() < closesAt);
  const mayPost =
    standing.isAdmin || Boolean(judge) || (Boolean(reg) && (sprint.phase !== "revealed" || standing.isActive));
  const closedReason = !open
    ? sprint.state === "cancelled"
      ? "This Sprint was cancelled, so the lobby is read-only."
      : "The lobby has closed. You can still read everything here."
    : !mayPost
      ? "Your membership has lapsed, so you can read the lobby but not post. Renew to join in again."
      : null;

  return (
    <>
      <NoGrid />
      <TopBar sleek title="buildathon" tier={standing.tier} userId={user.id} />
      <SprintAutoRefresh timing={toTiming(sprint)} state={sprint.state} />
      <div className="page-pad" style={{ padding: "16px 26px 40px", maxWidth: 880, margin: "0 auto", width: "100%" }}>
        <Link href={`/hackathon/${n}`} style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
          ← Sprint #{n}
        </Link>
        <h1
          className={`${ui.titleGradient} ${ui.balance}`}
          style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15, marginTop: 12 }}
        >
          Lobby
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 16 }}>
          Everyone in Sprint #{n}: participants, judges and admins.
        </p>
        <StatusBanner sprint={sprint} />
        <LobbyClient
          sprint={{
            id: sprint.id,
            number: n,
            endsAt: sprint.ends_at,
            lobbyClosesAt: sprint.lobby_closes_at,
            frozen: Boolean(sprint.status_override),
          }}
          initialMessages={((messages.data ?? []) as LobbyMessageRow[]).reverse()}
          welcome={(welcome.error ? null : (welcome.data as string | null)) ?? null}
          initialPeople={(people.error ? [] : (people.data as LobbyPerson[] | null)) ?? []}
          viewerId={user.id}
          isAdmin={standing.isAdmin}
          closedReason={closedReason}
        />
      </div>
    </>
  );
}
