"use client";

import { useEffect, useState } from "react";
import Tile from "@/components/ui/Tile";
import PersonAvatar from "@/components/ui/PersonAvatar";
import ui from "@/components/ui/sleek.module.css";
import { rpc, useSprintAction } from "@/lib/hackathons/actions";
import type { ArenaTeam, QueueData } from "@/lib/hackathons/page";
import MemberSearch from "./MemberSearch";
import { COLORS, EMBLEMS, StylePicker, TeamBadge } from "./TeamStyle";

// Your team, from registration through the live Sprint (Prompt 4).
//  * While registration is open: the owner answers requests, invites people,
//    shares the invite link, removes people; anyone can leave.
//  * Until the deadline: the owner (or anyone on a matched team) can rename
//    it and change its emblem and colour.
// The database enforces all of it; the buttons only appear when they'd work.

type TeamInfo = NonNullable<QueueData["team"]>;

export default function TeamPanel({
  sprint,
  team,
  panel,
  viewerId,
}: {
  sprint: { id: string; number: number; phase: string; frozen: boolean };
  team: ArenaTeam;
  panel: TeamInfo;
  viewerId: string;
}) {
  const { busy, error, run } = useSprintAction();
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const open = sprint.phase === "registration" && !sprint.frozen;
  const editable = panel.canEdit && !sprint.frozen && ["registration", "teams_locked", "live"].includes(sprint.phase);
  const full = team.members.length >= team.max_size;
  const exclude = new Set([...team.members.map((m) => m.id), ...panel.invitations.map((i) => i.person.id)]);

  return (
    <Tile
      kicker="Your team"
      right={`${team.members.length} of ${team.max_size}`}
      style={{ marginBottom: 16 }}
    >
      {editing ? (
        <EditTeam team={team} canToggleRequests={open && panel.isOwner} run={run} busy={busy} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
            <TeamBadge name={team.name} emblem={team.emblem} color={team.color} size={32} />
            <span style={{ minWidth: 0 }}>
              <span className="block truncate" style={{ fontSize: 16, fontWeight: 650, color: "var(--text-primary)" }}>
                {team.name}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {team.is_random_matched ? "Matched team" : team.is_open_to_requests ? "Open to requests" : "Invite only"}
              </span>
            </span>
          </span>
          {editable && (
            <button type="button" className={ui.ghostBtn} onClick={() => setEditing(true)}>
              Edit team
            </button>
          )}
        </div>
      )}

      <ul className="flex flex-col" style={{ gap: 4, marginTop: 12 }}>
        {team.members.map((m) => (
          <li key={m.id} className={`${ui.row} flex items-center justify-between gap-3`} style={{ padding: "5px 6px" }}>
            <span className="flex items-center gap-2" style={{ minWidth: 0 }}>
              <PersonAvatar name={m.full_name} stage={m.stage} username={m.username} size={24} />
              <span className="truncate" style={{ fontSize: 13, color: "var(--text-primary)" }}>
                {m.full_name ?? "Founder"}
                {m.id === viewerId && <span style={{ color: "var(--text-muted)" }}> (you)</span>}
              </span>
              {m.role === "owner" && <span className={ui.chip}>Owner</span>}
            </span>
            {open && panel.isOwner && m.id !== viewerId && (
              <button
                type="button"
                className={ui.textBtn}
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Remove ${m.full_name ?? "them"} from ${team.name}?`)) {
                    run(() => rpc("hackathon_remove_member", { p_team_id: team.id, p_user_id: m.id }));
                  }
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {open && panel.isOwner && panel.requests.length > 0 && (
        <Section title={`Asking to join (${panel.requests.length})`}>
          <ul className="flex flex-col" style={{ gap: 8 }}>
            {panel.requests.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 flex-wrap">
                <span className="flex items-start gap-2" style={{ minWidth: 0, flex: "1 1 200px" }}>
                  <PersonAvatar name={r.person.full_name} stage={r.person.stage} username={r.person.username} size={24} />
                  <span style={{ minWidth: 0 }}>
                    <span className="block" style={{ fontSize: 13, color: "var(--text-primary)" }}>{r.person.full_name ?? "Founder"}</span>
                    {r.message && <span className="block" style={{ fontSize: 12, color: "var(--text-secondary)" }}>“{r.message}”</span>}
                  </span>
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className={ui.primaryBtn}
                    disabled={busy || full}
                    title={full ? "Your team is full" : undefined}
                    onClick={() => run(() => rpc("hackathon_respond_to_join_request", { p_request_id: r.id, p_accept: true }))}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className={ui.ghostBtn}
                    disabled={busy}
                    onClick={() => run(() => rpc("hackathon_respond_to_join_request", { p_request_id: r.id, p_accept: false }))}
                  >
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {open && panel.invitations.length > 0 && (
        <Section title="Invited, waiting for an answer">
          <ul className="flex flex-col" style={{ gap: 6 }}>
            {panel.invitations.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  <PersonAvatar name={i.person.full_name} stage={i.person.stage} size={22} />
                  {i.person.full_name ?? "Founder"}
                </span>
                {panel.isOwner && (
                  <button
                    type="button"
                    className={ui.textBtn}
                    disabled={busy}
                    onClick={() => run(() => rpc("hackathon_cancel_invitation", { p_invitation_id: i.id }))}
                  >
                    Take back
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {open && panel.isOwner && (
        <Section title="Invite people">
          <InviteLink sprintNumber={sprint.number} teamId={team.id} code={panel.code} run={run} busy={busy} />
          {full ? (
            <p className={ui.emptySub} style={{ marginTop: 10 }}>Your team is full.</p>
          ) : inviting ? (
            <div style={{ marginTop: 12 }}>
              <MemberSearch
                sprintId={sprint.id}
                exclude={exclude}
                busy={busy}
                onInvite={(userId) => run(() => rpc("hackathon_invite_member", { p_team_id: team.id, p_user_id: userId }))}
              />
            </div>
          ) : (
            <button type="button" className={ui.ghostBtn} style={{ marginTop: 10 }} onClick={() => setInviting(true)}>
              Find people to invite
            </button>
          )}
        </Section>
      )}

      {open && (
        <div className="flex justify-end" style={{ marginTop: 12 }}>
          <button
            type="button"
            className={ui.textBtn}
            disabled={busy}
            onClick={() => {
              const alone = team.members.length === 1;
              if (
                window.confirm(
                  alone
                    ? `Leave ${team.name}? You're the only one on it, so it will be removed. You stay registered.`
                    : `Leave ${team.name}?${panel.isOwner ? " The longest-standing member becomes the owner." : ""} You stay registered.`,
                )
              ) {
                run(() => rpc("hackathon_leave_team", { p_team_id: team.id }));
              }
            }}
          >
            Leave team
          </button>
        </div>
      )}

      {error && (
        <p role="alert" style={{ fontSize: 12.5, color: "#fca5a5", marginTop: 10 }}>
          {error}
        </p>
      )}
    </Tile>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={ui.cardFoot} style={{ marginTop: 14, paddingTop: 12 }}>
      <p className={ui.label} style={{ marginBottom: 8 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

type Run = ReturnType<typeof useSprintAction>["run"];

function InviteLink({
  sprintNumber,
  teamId,
  code,
  run,
  busy,
}: {
  sprintNumber: number;
  teamId: string;
  code: string | null;
  run: Run;
  busy: boolean;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = code ? `${origin}/hackathon/${sprintNumber}/join/${code}` : null;

  if (!url) {
    return (
      <button type="button" className={ui.softBtn} disabled={busy} onClick={() => run(() => rpc("hackathon_team_invite_code", { p_team_id: teamId }))}>
        Make an invite link
      </button>
    );
  }
  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <input className={ui.search} readOnly value={url} aria-label="Invite link" style={{ flex: "1 1 220px", minWidth: 0 }} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className={ui.softBtn}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // The field is selectable as a fallback.
            }
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
        Code {code}. Anyone with it can join while there's room, until teams lock.{" "}
        <button
          type="button"
          className={ui.textBtn}
          style={{ fontSize: 11.5 }}
          disabled={busy}
          onClick={() => {
            if (window.confirm("Make a new link? The old one stops working.")) {
              run(() => rpc("hackathon_reset_invite_code", { p_team_id: teamId }));
            }
          }}
        >
          Make a new one
        </button>
      </p>
    </div>
  );
}

function EditTeam({
  team,
  canToggleRequests,
  run,
  busy,
  onDone,
}: {
  team: ArenaTeam;
  canToggleRequests: boolean;
  run: Run;
  busy: boolean;
  onDone: () => void;
}) {
  const [name, setName] = useState(team.name);
  const [style, setStyle] = useState({
    emblem: team.emblem && EMBLEMS.includes(team.emblem) ? team.emblem : EMBLEMS[0],
    color: team.color ?? COLORS[0],
  });
  const [open, setOpen] = useState(team.is_open_to_requests);

  return (
    <form
      className="flex flex-col"
      style={{ gap: 12 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(() =>
          rpc("hackathon_update_team", {
            p_team_id: team.id,
            p_name: name.trim() !== team.name ? name.trim() : null,
            p_emblem: style.emblem,
            p_color: style.color,
            p_open_to_requests: canToggleRequests && open !== team.is_open_to_requests ? open : null,
          }),
        );
        if (ok) onDone();
      }}
    >
      <span className="flex items-center gap-2">
        <TeamBadge name={name || "?"} emblem={style.emblem} color={style.color} size={34} />
        <input className={ui.search} style={{ flex: 1, minWidth: 0 }} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Team name" />
      </span>
      <StylePicker emblem={style.emblem} color={style.color} onChange={setStyle} />
      {canToggleRequests && (
        <label className="flex items-center gap-2" style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
          Open to requests
        </label>
      )}
      <span className="flex gap-2">
        <button type="submit" className={ui.primaryBtn} disabled={busy || name.trim().length < 2}>
          Save
        </button>
        <button type="button" className={ui.ghostBtn} onClick={onDone}>
          Cancel
        </button>
      </span>
    </form>
  );
}
