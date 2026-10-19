"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/api";
import { Btn, Card, ErrorLine, Kicker, send, when } from "../../ui";
import { askChoice, askConfirm } from "../../dialog";
import type { Judge } from "./types";

type Member = { id: string; full_name: string | null; username: string | null; email: string | null };

/**
 * Judges: pick an existing member, or invite an email (for someone without an
 * account; linking comes with the external-judge flow, deferred to Sprint #2). A registered participant can't judge the
 * same Sprint, so the screen offers to withdraw their registration first.
 */
export default function Judges({ sprintId, judges, onChanged }: { sprintId: string; judges: Judge[]; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const path = `/api/admin/hackathons/${sprintId}/people`;

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await adminFetch(`/api/admin/members?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json().catch(() => ({}));
      setResults(json.members ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function run(body: Record<string, unknown>) {
    setError(null);
    const r = await send(path, body);
    if (!r.ok) {
      setError(r.error ?? "That didn't work.");
      return r;
    }
    onChanged();
    return r;
  }

  async function addMember(m: Member) {
    const name = m.full_name || m.username || "They";
    const pick = await askChoice(
      `Make ${name} a judge.\n\nMark them as having accepted (for someone you've already asked), or invite them and wait for them to accept?`,
      [
        { value: "invite", label: "invite", variant: "ghost" },
        { value: "accepted", label: "mark accepted" },
      ],
    );
    if (!pick) return;
    const accepted = pick === "accepted";
    const r = await run({ op: "judge_add_member", user_id: m.id, accepted });
    if (!r.ok && r.hint === "participant_cannot_judge") {
      if (await askConfirm(`${name} is registered for this Buildathon, so they can't judge it.\n\nWithdraw their registration and make them a judge?`, { ok: "withdraw + make judge" })) {
        const w = await run({ op: "withdraw", user_id: m.id });
        if (w.ok) await run({ op: "judge_add_member", user_id: m.id, accepted });
      }
    }
    if (r.ok) {
      setQ("");
      setResults([]);
    }
  }

  return (
    <div className="space-y-3">
      {judges.length === 0 ? (
        <p className="font-mono text-xs text-text-faint">no judges yet</p>
      ) : (
        judges.map((j) => (
          <Card key={j.id} className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-text-primary break-words">{j.name ?? j.invite_email}</p>
              <p className="font-mono text-[0.6rem] text-text-faint">
                {j.user_id ? j.email : "email invite · no account yet"} · invited {when(j.invited_at)} ·{" "}
                <span style={{ color: j.accepted_at ? "#22c55e" : "#f59e0b" }}>{j.accepted_at ? "accepted" : "not accepted yet"}</span>
              </p>
            </div>
            <div className="flex gap-2">
              {!j.accepted_at && j.user_id && (
                <Btn onClick={async () => (await askConfirm("Mark this judge as accepted?")) && run({ op: "judge_accept", judge_id: j.id })}>mark accepted</Btn>
              )}
              <Btn variant="danger" onClick={async () => (await askConfirm(`Remove ${j.name ?? j.invite_email} as a judge?`, { ok: "remove", danger: true })) && run({ op: "judge_remove", judge_id: j.id })}>
                remove
              </Btn>
            </div>
          </Card>
        ))
      )}

      <Card>
        <Kicker>add an existing member</Kicker>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" />
        {results.length > 0 && (
          <ul className="mt-2 border" style={{ borderColor: "var(--border)" }}>
            {results.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => addMember(m)} className="w-full text-left px-3 py-2 hover:bg-white/5">
                  <span className="text-sm text-text-primary">{m.full_name || m.username}</span>
                  <span className="font-mono text-[0.6rem] text-text-faint ml-2">{m.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <Kicker>invite someone outside Quorum</Kicker>
        <div className="flex gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="judge@example.com" />
          <Btn
            disabled={!email.includes("@")}
            onClick={async () => {
              const r = await run({ op: "judge_invite_email", email });
              if (r.ok) setEmail("");
            }}
          >
            invite
          </Btn>
        </div>
        <p className="font-mono text-[0.6rem] text-text-faint mt-2">Stored for now. Judges from outside Quorum get accounts in a later release (planned for Buildathon #2); until then, judges must be existing members.</p>
      </Card>
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}
