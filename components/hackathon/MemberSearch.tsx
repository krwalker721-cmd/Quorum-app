"use client";

import { useEffect, useMemo, useState } from "react";
import PersonAvatar from "@/components/ui/PersonAvatar";
import ui from "@/components/ui/sleek.module.css";
import { sprintDb } from "@/lib/hackathons/actions";
import { skillKind, type SkillKind } from "@/lib/hackathons/skills";

// Find someone to invite: by name, or by what they're good at ("design",
// "python"), with quick filters for the three kinds of skill the matcher
// balances. Reads the same profile skills the Collab Board's skills index
// shows; the Collab Board itself is untouched.
//
// Anyone approved can be invited. Whether they can take part is checked when
// they accept, so this never reveals who pays.

type Member = {
  id: string;
  full_name: string | null;
  username: string | null;
  stage: string | null;
  skills: string[];
};

const KINDS: { kind: SkillKind; label: string }[] = [
  { kind: "technical", label: "Technical" },
  { kind: "design", label: "Design" },
  { kind: "business", label: "Business" },
];

export default function MemberSearch({
  sprintId,
  exclude,
  onInvite,
  busy,
}: {
  sprintId: string;
  /** Already on your team, or already invited. */
  exclude: Set<string>;
  onInvite: (userId: string) => void;
  busy: boolean;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [onATeam, setOnATeam] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<SkillKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = sprintDb();
      const [people, taken] = await Promise.all([
        db.from("profiles").select("id, full_name, username, stage, skills").eq("status", "approved").order("full_name").limit(1000),
        db.from("hackathon_team_members").select("user_id").eq("hackathon_id", sprintId),
      ]);
      if (cancelled) return;
      setMembers(
        ((people.data ?? []) as (Member & { skills: string[] | null })[]).map((m) => ({ ...m, skills: m.skills ?? [] })),
      );
      setOnATeam(new Set((taken.data ?? []).map((t) => t.user_id as string)));
    })();
    return () => {
      cancelled = true;
    };
  }, [sprintId]);

  const results = useMemo(() => {
    if (!members) return [];
    const needle = q.trim().toLowerCase();
    return members
      .filter((m) => !exclude.has(m.id))
      .filter((m) => !kind || skillKind(m.skills) === kind)
      .filter(
        (m) =>
          !needle ||
          (m.full_name ?? "").toLowerCase().includes(needle) ||
          (m.username ?? "").toLowerCase().includes(needle) ||
          m.skills.some((s) => s.toLowerCase().includes(needle)),
      )
      .sort((a, b) => Number(onATeam.has(a.id)) - Number(onATeam.has(b.id)))
      .slice(0, 12);
  }, [members, q, kind, exclude, onATeam]);

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <input
        className={ui.search}
        value={q}
        placeholder="Search by name or skill, e.g. design, python"
        aria-label="Search members to invite"
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            className={`${ui.pill} ${kind === k.kind ? ui.pillActive : ""}`}
            aria-pressed={kind === k.kind}
            onClick={() => setKind(kind === k.kind ? null : k.kind)}
          >
            {k.label}
          </button>
        ))}
      </div>
      {members === null ? (
        <p className={ui.emptySub}>Loading members…</p>
      ) : results.length === 0 ? (
        <p className={ui.emptySub}>Nobody matches that.</p>
      ) : (
        <ul className="flex flex-col" style={{ gap: 4 }}>
          {results.map((m) => {
            const taken = onATeam.has(m.id);
            return (
              <li key={m.id} className={`${ui.row} flex items-center justify-between gap-3`} style={{ padding: "6px 6px" }}>
                <span className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
                  <PersonAvatar name={m.full_name} stage={m.stage} size={26} />
                  <span style={{ minWidth: 0 }}>
                    <span className="block truncate" style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      {m.full_name ?? "Founder"}
                    </span>
                    <span className="block truncate" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      {m.skills.length ? m.skills.slice(0, 3).join(" · ") : "no skills listed"}
                    </span>
                  </span>
                </span>
                {taken ? (
                  <span className={ui.chip}>On a team</span>
                ) : (
                  <button type="button" className={ui.softBtn} disabled={busy} onClick={() => onInvite(m.id)}>
                    Invite
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
