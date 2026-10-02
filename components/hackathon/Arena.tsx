"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Tile from "@/components/ui/Tile";
import PersonAvatar from "@/components/ui/PersonAvatar";
import ui from "@/components/ui/sleek.module.css";
import { realtimeDb } from "@/lib/hackathons/actions";
import { approxServerNow } from "@/lib/useServerNow";
import type { SprintPhase } from "@/lib/hackathons/sprint";
import type { ArenaTeam, TeamPulse } from "@/lib/hackathons/page";
import s from "./arena.module.css";

// The arena (Prompt 5): every team, who's on it, which cohorts they come
// from, and how busy it is, never what it's building.
//
// The live pulse comes from hackathon_team_pulse (migration 027) over
// Supabase Realtime: one row per team holding counts and times only, kept up
// to date by triggers on the room tables. So what reaches a spectator's
// browser has nothing sealed in it, by construction. A 60 s re-read covers a
// dropped connection; "active X min ago" re-labels every 30 s on the server's
// clock.

const MIN = 60_000;
type Heat = "hot" | "warm" | "quiet" | "idle";

function heatOf(lastActive: string | null, now: number): Heat {
  if (!lastActive) return "idle";
  const ago = now - Date.parse(lastActive);
  if (ago < 5 * MIN) return "hot";
  if (ago < 30 * MIN) return "warm";
  if (ago < 120 * MIN) return "quiet";
  return "idle";
}
const HEAT_BARS: Record<Heat, number> = { hot: 4, warm: 3, quiet: 2, idle: 1 };

function agoText(iso: string, now: number) {
  const m = Math.max(0, Math.floor((now - Date.parse(iso)) / MIN));
  if (m < 1) return "active just now";
  if (m < 60) return `active ${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `active ${h} h ago`;
  return `active ${Math.floor(h / 24)} d ago`;
}

const firstName = (n: string | null) => (n ?? "Founder").split(/\s+/)[0];

export default function Arena({
  sprintId,
  sprintNumber,
  teams,
  phase,
  myTeamId,
  title = "Arena",
  live = false,
}: {
  sprintId: string;
  sprintNumber: number;
  teams: ArenaTeam[];
  phase: SprintPhase;
  myTeamId: string | null;
  title?: string;
  /** Subscribe to the pulse (while the Sprint is running). */
  live?: boolean;
}) {
  const router = useRouter();
  const showPulse = ["teams_locked", "live", "judging", "revealed"].includes(phase);
  const showSubmitted = ["live", "judging", "revealed"].includes(phase);
  const sealed = phase !== "revealed";

  // Pulses, starting from the server's, then kept live.
  const [pulses, setPulses] = useState<Map<string, TeamPulse>>(
    () => new Map(teams.filter((t) => t.pulse).map((t) => [t.id, t.pulse!])),
  );
  const [rippling, setRippling] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<number>(() => Date.now());
  const known = useRef(new Set(teams.map((t) => t.id)));
  const current = useRef(pulses);

  useEffect(() => {
    const fresh = new Map(teams.filter((t) => t.pulse).map((t) => [t.id, t.pulse!]));
    current.current = fresh;
    setPulses(fresh);
    known.current = new Set(teams.map((t) => t.id));
  }, [teams]);

  // "X min ago" on the server's clock, re-labelled every 30 s.
  useEffect(() => {
    setNow(approxServerNow());
    const t = setInterval(() => setNow(approxServerNow()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!live) return;
    let stopped = false;
    let cleanup = () => {};

    const apply = (p: TeamPulse, ripple: boolean) => {
      if (!known.current.has(p.team_id)) {
        // A team this page hasn't drawn yet: fetch the page again.
        router.refresh();
        return;
      }
      const before = current.current.get(p.team_id);
      const next = new Map(current.current);
      next.set(p.team_id, p);
      current.current = next;
      setPulses(next);
      setNow(approxServerNow());
      if (ripple && before && p.activity_count > before.activity_count) {
        setRippling((r) => new Set(r).add(p.team_id));
        setTimeout(
          () =>
            setRippling((r) => {
              const n = new Set(r);
              n.delete(p.team_id);
              return n;
            }),
          3000,
        );
      }
    };

    (async () => {
      const db = await realtimeDb();
      if (stopped) return;
      const channel = db
        .channel(`arena-${sprintId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "hackathon_team_pulse", filter: `hackathon_id=eq.${sprintId}` },
          (payload) => {
            if (payload.eventType === "DELETE") return;
            apply(payload.new as TeamPulse, true);
          },
        )
        .subscribe();

      const reread = setInterval(async () => {
        if (document.visibilityState !== "visible") return;
        const { data } = await db
          .from("hackathon_team_pulse")
          .select("team_id, activity_count, last_active_at, has_submitted, submitted_at")
          .eq("hackathon_id", sprintId);
        for (const p of (data as TeamPulse[] | null) ?? []) apply(p, true);
      }, 60_000);

      cleanup = () => {
        clearInterval(reread);
        db.removeChannel(channel);
      };
    })();

    return () => {
      stopped = true;
      cleanup();
    };
  }, [live, sprintId, router]);

  // Your team first, then the busiest.
  const ordered = useMemo(() => {
    const last = (t: ArenaTeam) => {
      const p = pulses.get(t.id);
      return p?.last_active_at ? Date.parse(p.last_active_at) : 0;
    };
    return [...teams].sort((a, b) => {
      if (a.id === myTeamId) return -1;
      if (b.id === myTeamId) return 1;
      return showPulse ? last(b) - last(a) : 0;
    });
  }, [teams, pulses, myTeamId, showPulse]);

  const builders = teams.reduce((n, t) => n + t.members.length, 0);
  const cohorts = new Set(teams.flatMap((t) => t.members.map((m) => m.cohort).filter(Boolean))).size;
  const submitted = teams.filter((t) => pulses.get(t.id)?.has_submitted).length;

  if (teams.length === 0) {
    return (
      <Tile kicker={title} style={{ marginBottom: 16 }}>
        <div className={ui.empty}>
          <p className={ui.emptyTitle}>{phase === "registration" ? "No teams yet." : "No teams in this Sprint."}</p>
          {phase === "registration" && <p className={ui.emptySub}>Teams appear here as they form.</p>}
        </div>
      </Tile>
    );
  }

  return (
    <section style={{ marginBottom: 16 }} aria-label={title}>
      <div className="flex items-baseline justify-between flex-wrap gap-x-3 gap-y-1" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>
        {sealed && showPulse && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Every project is sealed until the reveal</span>
        )}
      </div>

      <div className={s.stats}>
        <Stat value={teams.length} label={teams.length === 1 ? "team" : "teams"} />
        <Stat value={builders} label={builders === 1 ? "builder" : "builders"} />
        <Stat value={cohorts} label={cohorts === 1 ? "cohort represented" : "cohorts represented"} />
        {showSubmitted ? (
          <Stat value={`${submitted} of ${teams.length}`} label="teams submitted" amber={submitted > 0} />
        ) : (
          <Stat
            value={teams.reduce((n, t) => n + Math.max(0, t.max_size - t.members.length), 0)}
            label="open spots"
          />
        )}
      </div>

      <ul className={s.grid}>
        {ordered.map((t) => {
          const p = pulses.get(t.id) ?? null;
          const heat = showPulse ? heatOf(p?.last_active_at ?? null, now) : "idle";
          const mine = t.id === myTeamId;
          const teamCohorts = Array.from(new Set(t.members.map((m) => m.cohort).filter(Boolean))) as string[];
          const cls = [s.card, mine ? s.mine : "", heat === "hot" ? s.hot : "", rippling.has(t.id) ? s.rippling : ""].join(" ");
          return (
            <li key={t.id} className={cls} style={{ ["--team" as string]: t.color ?? "#f59e0b" }}>
              {mine && (
                <div className={s.mineBar}>
                  <span className={`${ui.chip} ${ui.chipAmber}`}>Your team</span>
                  {phase !== "registration" && (
                    <Link href={`/hackathon/${sprintNumber}/team/${t.slug}`} className={ui.softBtn}>
                      Go to my team room →
                    </Link>
                  )}
                </div>
              )}

              <div className={s.head}>
                <span className={s.emblemWrap}>
                  <span className={s.ring} aria-hidden />
                  <span className={s.emblem} aria-hidden>
                    {t.emblem || t.name.slice(0, 1).toUpperCase()}
                  </span>
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className={`${s.name} block truncate`}>{t.name}</span>
                  <span className={s.sub}>
                    {t.members.length} builder{t.members.length === 1 ? "" : "s"}
                    {t.is_random_matched ? " · matched" : ""}
                    {phase === "registration" && t.is_open_to_requests && t.members.length < t.max_size
                      ? ` · ${t.max_size - t.members.length} open`
                      : ""}
                  </span>
                </span>
              </div>

              <div className="flex flex-col" style={{ gap: 6 }}>
                <div className={s.avatars}>
                  {t.members.map((m) => (
                    <span key={m.id} className={s.avatar} title={m.cohort ? `${m.full_name ?? "Founder"} · ${m.cohort}` : (m.full_name ?? "Founder")}>
                      <PersonAvatar name={m.full_name} stage={m.stage} username={m.username} size={30} />
                    </span>
                  ))}
                </div>
                <p className={s.names}>{t.members.map((m) => firstName(m.full_name)).join(", ")}</p>
                {teamCohorts.length > 0 && (
                  <div className={s.cohorts}>
                    {teamCohorts.map((c) => (
                      <span key={c} className={s.cohort}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className={s.foot}>
                {sealed ? (
                  <span className={s.seal}>
                    <span className={s.sealMark} aria-hidden>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a4 4 0 0 0-4 4v2H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4Zm-2 6V5a2 2 0 1 1 4 0v2H6Z" />
                      </svg>
                    </span>
                    Sealed
                  </span>
                ) : (
                  <span className={s.seal}>Unsealed</span>
                )}
                {showSubmitted && p?.has_submitted ? (
                  <span className={s.submitted}>Submitted ✓</span>
                ) : showPulse ? (
                  <span className={s.live}>
                    <span className={s.heat} aria-label={`activity: ${heat}`}>
                      {[1, 2, 3, 4].map((i) => (
                        <span key={i} className={`${s.bar} ${i <= HEAT_BARS[heat] && heat !== "idle" ? s.barOn : ""}`} style={{ height: 3 + i * 2 }} />
                      ))}
                    </span>
                    {p?.last_active_at ? agoText(p.last_active_at, now) : "no activity yet"}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({ value, label, amber = false }: { value: number | string; label: string; amber?: boolean }) {
  return (
    <div className={s.stat}>
      <div className={`${s.statValue} ${amber ? s.statValueAmber : ""}`}>{value}</div>
      <div className={s.statLabel}>{label}</div>
    </div>
  );
}
