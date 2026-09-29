import Tile from "@/components/ui/Tile";
import PersonAvatar from "@/components/ui/PersonAvatar";
import ui from "@/components/ui/sleek.module.css";
import { timeAgo } from "@/lib/stage";
import type { SprintPhase } from "@/lib/hackathons/sprint";
import type { ArenaTeam } from "@/lib/hackathons/page";

/**
 * The arena: every team, who's on it, and how busy it is, never what it's
 * building (the database only hands out names, rosters and activity counts).
 * A plain card grid for now; Prompt 5 replaces this file with the full arena.
 */
export default function Arena({
  teams,
  phase,
  myTeamId,
  title = "Arena",
}: {
  teams: ArenaTeam[];
  phase: SprintPhase;
  myTeamId: string | null;
  title?: string;
}) {
  const showActivity = phase === "live";
  const showSubmitted = phase === "judging" || phase === "revealed";
  const submitted = teams.filter((t) => t.activity?.has_submitted).length;

  return (
    <Tile
      kicker={title}
      right={
        teams.length === 0
          ? undefined
          : showSubmitted
            ? `${submitted} of ${teams.length} submitted`
            : `${teams.length} team${teams.length === 1 ? "" : "s"}`
      }
      style={{ marginBottom: 16 }}
    >
      {teams.length === 0 ? (
        <div className={ui.empty}>
          <p className={ui.emptyTitle}>{phase === "registration" ? "No teams yet." : "No teams in this Sprint."}</p>
          {phase === "registration" && <p className={ui.emptySub}>Teams appear here as they form.</p>}
        </div>
      ) : (
        <>
          {phase === "live" && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
              Every project stays sealed until the reveal. You can see who's building, not what.
            </p>
          )}
          <ul className="grid" style={{ gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {teams.map((t) => (
              <TeamCard key={t.id} team={t} mine={t.id === myTeamId} showActivity={showActivity} showSubmitted={showSubmitted} />
            ))}
          </ul>
        </>
      )}
    </Tile>
  );
}

function TeamCard({
  team,
  mine,
  showActivity,
  showSubmitted,
}: {
  team: ArenaTeam;
  mine: boolean;
  showActivity: boolean;
  showSubmitted: boolean;
}) {
  const color = team.color ?? "#f59e0b";
  const a = team.activity;
  return (
    <li
      style={{
        border: `1px solid ${mine ? "rgba(245, 158, 11, 0.45)" : "rgba(255, 255, 255, 0.08)"}`,
        borderRadius: 10,
        padding: "11px 12px",
        background: "rgba(255, 255, 255, 0.015)",
        minWidth: 0,
      }}
    >
      <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
        <span
          aria-hidden
          className="inline-flex items-center justify-center"
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            flexShrink: 0,
            fontSize: 12,
            background: `${color}22`,
            border: `1px solid ${color}66`,
            color,
          }}
        >
          {team.emblem || team.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
          {team.name}
        </span>
        {mine && <span className={`${ui.chip} ${ui.chipAmber}`}>You</span>}
        {showSubmitted &&
          (a?.has_submitted ? (
            <span
              className={ui.chip}
              style={{ marginLeft: "auto", color: "#4ade80", borderColor: "rgba(34, 197, 94, 0.35)", background: "rgba(34, 197, 94, 0.08)" }}
            >
              Submitted
            </span>
          ) : (
            <span className={ui.chip} style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
              No submission
            </span>
          ))}
      </div>

      <ul className="flex flex-wrap" style={{ gap: "6px 10px", marginTop: 9 }}>
        {team.members.map((m) => (
          <li key={m.id} className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
            <PersonAvatar name={m.full_name} stage={m.stage} username={m.username} size={20} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{(m.full_name ?? "Founder").split(/\s+/)[0]}</span>
          </li>
        ))}
      </ul>

      {(showActivity || team.is_random_matched) && (
        <div className={`${ui.cardFoot} flex items-center gap-2 flex-wrap`} style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          {showActivity &&
            (a?.last_active_at ? (
              <>
                <span className={Date.now() - Date.parse(a.last_active_at) < 15 * 60_000 ? ui.liveDot : ui.quietDot} aria-hidden />
                <span>active {timeAgo(a.last_active_at)} ago</span>
                <span>
                  · {a.message_count} message{a.message_count === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span>no activity yet</span>
            ))}
          {team.is_random_matched && <span style={{ marginLeft: showActivity ? "auto" : undefined }}>matched</span>}
        </div>
      )}
    </li>
  );
}
