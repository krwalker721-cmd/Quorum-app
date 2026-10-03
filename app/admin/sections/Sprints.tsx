"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetch } from "../lib/api";
import { SectionShell } from "./Overview";
import { Btn, ErrorLine, StateChip } from "../ui";
import { formatNy } from "@/lib/time/newYork";
import SprintForm from "./sprints/SprintForm";
import SprintControls from "./sprints/SprintControls";
import Participants from "./sprints/Participants";
import Teams from "./sprints/Teams";
import Judges from "./sprints/Judges";
import Judging from "./sprints/Judging";
import Lobby from "./sprints/Lobby";
import ChangeLog from "./sprints/ChangeLog";
import type { SprintDetail, SprintRow } from "./sprints/types";

type View = { kind: "list" } | { kind: "new" } | { kind: "sprint"; id: string };

export default function SprintsSection() {
  const [view, setView] = useState<View>({ kind: "list" });

  return (
    <SectionShell title="sprints">
      {view.kind === "list" && <SprintList onOpen={(id) => setView({ kind: "sprint", id })} onNew={() => setView({ kind: "new" })} />}
      {view.kind === "new" && (
        <>
          <BackLink onClick={() => setView({ kind: "list" })} />
          <SprintForm sprint={null} onSaved={(id) => setView({ kind: "sprint", id })} />
        </>
      )}
      {view.kind === "sprint" && (
        <>
          <BackLink onClick={() => setView({ kind: "list" })} />
          <SprintPage key={view.id} id={view.id} onOpen={(id) => setView({ kind: "sprint", id })} />
        </>
      )}
    </SectionShell>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="font-mono lowercase text-[0.7rem] text-text-faint hover:text-text-primary mb-4">
      ← all sprints
    </button>
  );
}

function SprintList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const [rows, setRows] = useState<SprintRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await adminFetch("/api/admin/hackathons");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error ?? "Couldn't load Sprints.");
      setRows(json.sprints ?? []);
    })();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-[0.7rem] text-text-faint">every sprint, drafts included. state is worked out live from its times.</p>
        <Btn variant="primary" onClick={onNew}>
          new sprint
        </Btn>
      </div>
      <ErrorLine>{error}</ErrorLine>
      {rows === null ? (
        <p className="font-mono text-xs text-text-faint">loading…</p>
      ) : rows.length === 0 ? (
        <p className="font-mono text-xs text-text-faint">no sprints yet</p>
      ) : (
        <div className="overflow-x-auto border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="font-mono lowercase text-[0.6rem] text-text-faint text-left">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">title</th>
                <th className="px-3 py-2">state</th>
                <th className="px-3 py-2">kickoff (new york)</th>
                <th className="px-3 py-2 text-right">participants</th>
                <th className="px-3 py-2 text-right">teams</th>
                <th className="px-3 py-2 text-right">submissions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onOpen(s.id)}
                  className="border-t cursor-pointer hover:bg-white/[0.03]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-3 py-2 font-mono text-text-muted">{s.number}</td>
                  <td className="px-3 py-2 text-text-primary">{s.title}</td>
                  <td className="px-3 py-2">
                    <StateChip state={s.state} />
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.65rem] text-text-secondary">{formatNy(s.starts_at)}</td>
                  <td className="px-3 py-2 font-mono text-right">{s.participant_count}</td>
                  <td className="px-3 py-2 font-mono text-right">{s.team_count}</td>
                  <td className="px-3 py-2 font-mono text-right">{s.submission_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const TABS = ["settings", "participants", "teams", "judges", "judging", "lobby", "log"] as const;
type Tab = (typeof TABS)[number];

function SprintPage({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const [detail, setDetail] = useState<SprintDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("settings");
  // Bumped after a settings save so the form reloads from what was stored.
  const [formKey, setFormKey] = useState(0);

  // Several actions can reload at once (withdraw, then add as judge); only the
  // newest reload may update the page, or an older answer lands last.
  const latest = useRef(0);
  const load = useCallback(async () => {
    const mine = ++latest.current;
    const res = await adminFetch(`/api/admin/hackathons/${id}`);
    const json = await res.json().catch(() => ({}));
    if (mine !== latest.current) return;
    if (!res.ok) {
      setError(json.error ?? "Couldn't load this Sprint.");
      return;
    }
    setError(null);
    setDetail(json);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!detail) return <p className="font-mono text-xs text-text-faint">loading…</p>;
  const s = detail.sprint;
  const counts: Partial<Record<Tab, number>> = {
    participants: detail.participants.filter((p) => !p.withdrawn_at).length,
    teams: detail.teams.length,
    judges: detail.judges.length,
    lobby: detail.lobby.length,
    log: detail.log.length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg text-text-primary">
          <span className="font-mono text-text-faint mr-2">#{s.number}</span>
          {s.title}
        </h2>
        <StateChip state={s.state} />
        {s.state === "paused" && <span className="font-mono text-[0.6rem] text-text-faint">clock stopped at: {s.phase.replace("_", " ")}</span>}
      </div>

      <SprintControls sprint={s} onChanged={load} onDuplicated={onOpen} />

      <div className="flex gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="font-mono lowercase text-[0.7rem] px-3 py-2 whitespace-nowrap"
            style={
              tab === t
                ? { color: "var(--text-primary)", borderBottom: "2px solid #f59e0b" }
                : { color: "var(--text-muted)", borderBottom: "2px solid transparent" }
            }
          >
            {t}
            {counts[t] !== undefined && <span className="text-text-faint ml-1">{counts[t]}</span>}
          </button>
        ))}
      </div>

      {tab === "settings" && (
        <SprintForm
          // A fresh form whenever the Sprint changes (an extension, a pause), so
          // saving settings can never put back times an action just moved.
          key={`${formKey}-${s.updated_at}`}
          sprint={s}
          onSaved={async () => {
            await load();
            setFormKey((k) => k + 1);
          }}
        />
      )}
      {tab === "participants" && <Participants sprintId={id} participants={detail.participants} startsAt={detail.sprint.starts_at} onChanged={load} />}
      {tab === "teams" && <Teams sprintId={id} sprintNumber={s.number} teams={detail.teams} participants={detail.participants} onChanged={load} />}
      {tab === "judges" && <Judges sprintId={id} judges={detail.judges} onChanged={load} />}
      {tab === "judging" && <Judging sprintId={id} />}
      {tab === "lobby" && <Lobby sprintId={id} messages={detail.lobby} onChanged={load} />}
      {tab === "log" && <ChangeLog entries={detail.log} />}
    </div>
  );
}
