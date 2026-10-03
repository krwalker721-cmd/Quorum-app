"use client";

import { useState } from "react";
import { Btn, Card, ErrorLine, Kicker, send, sendWithOverride } from "../../ui";
import type { Participant, Team } from "./types";

/**
 * Rename, create, move, remove, merge, and the per-team size override. Going
 * over a team's limit always asks first (sendWithOverride).
 */
export default function Teams({
  sprintId,
  sprintNumber,
  teams,
  participants,
  onChanged,
}: {
  sprintId: string;
  sprintNumber: number;
  teams: Team[];
  participants: Participant[];
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newMembers, setNewMembers] = useState<string[]>([]);
  const path = `/api/admin/hackathons/${sprintId}/teams`;
  const unteamed = participants.filter((p) => !p.withdrawn_at && !p.team_id);

  async function run(body: Record<string, unknown>, override = true) {
    setError(null);
    const r = override ? await sendWithOverride(path, body) : await send(path, body);
    if (!r.ok) {
      if (r.status) setError(r.error ?? "That didn't work.");
      return false;
    }
    onChanged();
    return true;
  }

  async function create() {
    if (await run({ op: "create", name: newName, member_ids: newMembers })) {
      setNewName("");
      setNewMembers([]);
    }
  }

  return (
    <div className="space-y-3">
      <ErrorLine>{error}</ErrorLine>
      {teams.length === 0 && <p className="font-mono text-xs text-text-faint">no teams yet</p>}

      {teams.map((t) => (
        <TeamCard key={t.id} sprintNumber={sprintNumber} team={t} teams={teams} unteamed={unteamed} run={run} />
      ))}

      <Card>
        <Kicker>create a team by hand</Kicker>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Team name" />
        <p className="font-mono text-[0.65rem] text-text-faint mt-3 mb-2">
          Members, from people not on a team yet (the first one ticked owns it):
        </p>
        {unteamed.length === 0 ? (
          <p className="font-mono text-[0.65rem] text-text-faint">everyone is on a team</p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {unteamed.map((p) => (
              <label key={p.user_id} className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={newMembers.includes(p.user_id)}
                  onChange={(e) =>
                    setNewMembers((m) => (e.target.checked ? [...m, p.user_id] : m.filter((x) => x !== p.user_id)))
                  }
                />
                {p.name}
              </label>
            ))}
          </div>
        )}
        <Btn className="mt-3" variant="primary" disabled={newName.trim().length < 2} onClick={create}>
          create team
        </Btn>
      </Card>
    </div>
  );
}

function TeamCard({
  sprintNumber,
  team,
  teams,
  unteamed,
  run,
}: {
  sprintNumber: number;
  team: Team;
  teams: Team[];
  unteamed: Participant[];
  run: (body: Record<string, unknown>, override?: boolean) => Promise<boolean>;
}) {
  const [name, setName] = useState(team.name);
  const [limit, setLimit] = useState(team.max_size_override ? String(team.max_size_override) : "");
  const others = teams.filter((x) => x.id !== team.id);
  const full = team.members.length >= team.limit;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-text-primary text-sm">
          {team.name}
          <span className="font-mono text-[0.65rem] text-text-faint ml-2">
            {team.members.length} / {team.limit}
            {team.max_size_override ? " (override)" : ""}
            {team.is_random_matched ? " · random" : ""}
          </span>
        </p>
        <span className="flex items-baseline gap-3">
          <span
            className="font-mono text-[0.6rem]"
            style={{ color: team.submission?.is_complete ? "#22c55e" : team.submission ? "#f59e0b" : "var(--text-faint)" }}
          >
            {team.submission?.is_complete
              ? `submitted: ${team.submission.project_name}`
              : team.submission
                ? `draft: ${team.submission.project_name ?? "untitled"}`
                : "no submission"}
          </span>
          {/* Admins can read every room (read-only); the room logs nothing. */}
          <a
            href={`/hackathon/${sprintNumber}/team/${team.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[0.6rem] text-text-muted hover:text-text-primary"
          >
            open room ↗
          </a>
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {team.members.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-secondary flex-1 min-w-[140px]">
              {m.name}
              {m.role === "owner" && <span className="font-mono text-[0.6rem] ml-2" style={{ color: "#f59e0b" }}>owner</span>}
            </span>
            <select
              className="font-mono text-[0.65rem] lowercase !w-auto"
              defaultValue=""
              onChange={(e) => {
                const to = e.target.value;
                e.target.value = "";
                if (to && window.confirm(`Move ${m.name} to ${teams.find((x) => x.id === to)?.name}?`)) {
                  run({ op: "move", user_id: m.user_id, to_team_id: to });
                }
              }}
            >
              <option value="">move to…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.members.length}/{o.limit})
                </option>
              ))}
            </select>
            <Btn
              variant="danger"
              onClick={() => window.confirm(`Remove ${m.name} from ${team.name}? They stay registered, without a team.`) && run({ op: "remove", team_id: team.id, user_id: m.user_id }, false)}
            >
              remove
            </Btn>
          </li>
        ))}
      </ul>

      {unteamed.length > 0 && (
        <select
          className="mt-3 font-mono text-[0.65rem] lowercase !w-auto"
          defaultValue=""
          onChange={(e) => {
            const who = e.target.value;
            e.target.value = "";
            if (who) run({ op: "move", user_id: who, to_team_id: team.id });
          }}
        >
          <option value="">add someone without a team{full ? " (team is full)" : ""}…</option>
          {unteamed.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="team name" />
          <Btn disabled={name.trim() === team.name || name.trim().length < 2} onClick={() => run({ op: "rename", team_id: team.id, name }, false)}>
            rename
          </Btn>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder={`limit (default ${team.limit})`}
            aria-label="size limit override"
          />
          <Btn
            onClick={() =>
              window.confirm(limit ? `Let ${team.name} have up to ${limit} members?` : `Remove ${team.name}'s size override?`) &&
              run({ op: "set_limit", team_id: team.id, limit: limit || null }, false)
            }
          >
            set limit
          </Btn>
        </div>
        <select
          className="font-mono text-[0.65rem] lowercase"
          defaultValue=""
          disabled={others.length === 0}
          onChange={(e) => {
            const target = e.target.value;
            e.target.value = "";
            const t = teams.find((x) => x.id === target);
            if (
              t &&
              window.confirm(
                `Merge ${team.name} INTO ${t.name}?\n\n${team.name}'s members, thread, docs, links and votes move to ${t.name}, and ${team.name} is deleted.`,
              )
            ) {
              run({ op: "merge", source_id: team.id, target_id: target });
            }
          }}
        >
          <option value="">merge this team into…</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );
}
