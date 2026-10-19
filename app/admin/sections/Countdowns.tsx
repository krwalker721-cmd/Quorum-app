"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../lib/api";
import { SectionShell } from "./Overview";
import { Btn, Card, ErrorLine, Kicker, send } from "../ui";
import { askConfirm, tell } from "../dialog";
import ChangeLog from "./sprints/ChangeLog";
import type { LogEntry } from "./sprints/types";
import CountdownView, { formatRemaining, resolveCountdown } from "@/components/countdown/CountdownView";
import type { SiteCountdown, SprintCountdown } from "@/lib/countdowns";
import { nextMilestone } from "@/lib/hackathons/timeline";
import { useServerNow } from "@/lib/useServerNow";
import { pickRelay, type RelayData } from "@/lib/landingRelay";
import { formatNy, nyInputToUtc, nyZoneLabel, utcToNyInput } from "@/lib/time/newYork";

type SiteRow = SiteCountdown & {
  is_enabled: boolean;
  show_on_landing: boolean;
  show_in_app: boolean;
  is_launch: boolean;
  updated_at: string;
  updated_by_name: string | null;
};

type SprintRow = {
  id: string;
  number: number;
  title: string;
  state: string;
  is_published: boolean;
  status_override: "paused" | "cancelled" | null;
  registration_opens_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  reveal_at: string | null;
  show_countdown_in_app: boolean;
  show_countdown_on_landing: boolean;
  countdown_headline_override: string | null;
};

type Data = { site: SiteRow[]; sprints: SprintRow[]; platform_status: string; log: LogEntry[] };

const HOUR = 3_600_000;

function asSprintCountdown(s: SprintRow): SprintCountdown | null {
  if (!s.registration_opens_at || !s.starts_at || !s.ends_at || !s.reveal_at) return null;
  return {
    kind: "sprint",
    id: s.id,
    number: s.number,
    title: s.title,
    headline: s.countdown_headline_override,
    registration_opens_at: s.registration_opens_at,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    reveal_at: s.reveal_at,
    status_override: s.status_override,
  };
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2 font-mono text-[0.65rem] lowercase"
    >
      <span
        className="relative inline-block w-8 h-4 rounded-full transition-colors"
        style={{ background: on ? "rgba(245, 158, 11, 0.55)" : "var(--border)" }}
      >
        <span
          className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
          style={{ left: on ? 18 : 2, background: on ? "#f59e0b" : "var(--text-muted)" }}
        />
      </span>
      <span style={{ color: on ? "var(--text-primary)" : "var(--text-muted)" }}>{label}</span>
    </button>
  );
}

/** "push back by [n] [hours|days]" */
function PushBack({ onPush }: { onPush: (minutes: number) => void }) {
  const [n, setN] = useState("1");
  const [unit, setUnit] = useState<"hours" | "days">("hours");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[0.65rem] text-text-muted">push back by</span>
      <input className="!w-16" type="number" min={1} value={n} onChange={(e) => setN(e.target.value)} aria-label="amount" />
      <select className="!w-auto font-mono text-[0.65rem]" value={unit} onChange={(e) => setUnit(e.target.value as "hours" | "days")} aria-label="unit">
        <option value="hours">hours</option>
        <option value="days">days</option>
      </select>
      <Btn
        disabled={!(Number(n) >= 1)}
        onClick={() => onPush(Math.round(Number(n) * (unit === "days" ? 1440 : 60)))}
      >
        push back
      </Btn>
    </div>
  );
}

export default function CountdownsSection() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const now = useServerNow();

  const load = useCallback(async () => {
    const res = await adminFetch("/api/admin/countdowns");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Couldn't load the countdowns.");
      return;
    }
    setError(null);
    setData(json);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(body: Record<string, unknown>) {
    setError(null);
    const r = await send("/api/admin/countdowns", body);
    if (!r.ok) setError(r.error ?? "That didn't work.");
    await load();
    return r.ok;
  }

  if (!data) {
    return (
      <SectionShell title="countdowns">
        <ErrorLine>{error}</ErrorLine>
        {!error && <p className="font-mono text-xs text-text-faint">loading…</p>}
      </SectionShell>
    );
  }

  // Zero is display only. If the launch countdown has run out while signups
  // are still waitlist-only, say so: opening the doors is a separate step.
  const overdueLaunch = data.site.filter(
    (c) => c.is_launch && c.is_enabled && now !== null && Date.parse(c.target_at) <= now,
  );
  const doorsClosed = data.platform_status !== "open";

  return (
    <SectionShell title="countdowns">
      <p className="font-mono text-[0.7rem] text-text-faint mb-4 max-w-3xl">
        every countdown on the landing page and in the app. changes reach visitors within about a minute, no redeploy.
        a countdown reaching zero only changes what it shows: it never opens signups, flips approval or changes pricing.
      </p>

      {overdueLaunch.length > 0 && doorsClosed && (
        <div className="border p-3 mb-4" style={{ borderColor: "rgba(245, 158, 11, 0.6)", background: "rgba(245, 158, 11, 0.08)" }}>
          <p className="text-sm" style={{ color: "#f8c56a" }}>
            The launch countdown &quot;{overdueLaunch[0].label}&quot; reached zero {formatNy(overdueLaunch[0].target_at)}, but signups
            are still waitlist-only.
          </p>
          <p className="font-mono text-[0.65rem] text-text-muted mt-1">
            Nothing opens by itself. To open the doors, go to settings → platform_status and choose open.
          </p>
        </div>
      )}

      <LandingNow version={data} now={now} waitlistOn={doorsClosed} />

      <ErrorLine>{error}</ErrorLine>

      <div className="space-y-3 mt-2">
        {data.site.map((c) => (
          <SiteCard key={c.id} c={c} now={now} act={act} />
        ))}
        {data.sprints.map((s) => (
          <SprintCard key={s.id} s={s} now={now} act={act} />
        ))}
        {data.site.length === 0 && data.sprints.length === 0 && <p className="font-mono text-xs text-text-faint">no countdowns yet</p>}
      </div>

      <div className="mt-5">
        {creating ? (
          <CountdownForm
            onCancel={() => setCreating(false)}
            onSave={async (values) => {
              if (await act({ op: "create", values })) setCreating(false);
            }}
          />
        ) : (
          <Btn variant="primary" onClick={() => setCreating(true)}>
            new countdown
          </Btn>
        )}
      </div>

      <Kicker className="mt-8">recent countdown changes</Kicker>
      <ChangeLog entries={data.log} />
    </SectionShell>
  );
}

/** Asks twice when a time is under an hour away or already reached. */
async function confirmRisky(label: string, current: number | null, next: number | null, now: number | null) {
  const n = now ?? Date.now();
  const soon = (t: number | null) => t !== null && t <= n + HOUR;
  if (!soon(current) && !soon(next)) return true;
  return askConfirm(
    `${label}: that time is under an hour away or has already been reached. Visitors see the change within a minute.\n\nGo ahead?`,
  );
}

function SiteCard({ c, now, act }: { c: SiteRow; now: number | null; act: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(utcToNyInput(c.target_at));
  const target_ms = Date.parse(c.target_at);
  const r = now === null ? null : resolveCountdown(c, now);
  const status = !c.is_enabled ? "off" : r && !r.show ? "hidden (reached zero)" : now !== null && now >= target_ms ? "showing its zero message" : "on";

  async function saveTarget() {
    const p = nyInputToUtc(target);
    if (!p.ok) return tell(p.error);
    if (!(await confirmRisky(`Move "${c.label}"`, target_ms, Date.parse(p.iso), now))) return;
    await act({ op: "update", id: c.id, values: { target_at: p.iso } });
  }

  return (
    <Card style={c.is_launch ? { borderColor: "rgba(245, 158, 11, 0.35)" } : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-text-primary">
          {c.label}
          <span className="font-mono text-[0.6rem] text-text-faint ml-2">
            {c.key} · standalone{c.is_launch ? " · launch" : ""}
          </span>
        </p>
        <span className="font-mono text-[0.65rem]" style={{ color: status === "on" ? "#22c55e" : "var(--text-muted)" }}>
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <div className="space-y-1">
          <p className="font-mono text-[0.65rem] text-text-muted">counts to {formatNy(c.target_at)}</p>
          <p className="font-mono text-sm tabular-nums" style={{ color: "#f8c56a" }}>
            {now === null ? "…" : now < target_ms ? formatRemaining(target_ms - now) : "reached zero"}
          </p>
          <p className="font-mono text-[0.6rem] text-text-faint">
            at zero: {c.zero_behavior === "hide" ? "hide" : `show "${c.zero_message}"`}
            {c.updated_by_name ? ` · last edited by ${c.updated_by_name}` : ""}
          </p>
        </div>
        <div className="space-y-2">
          <Switch
            on={c.is_enabled}
            label={c.is_enabled ? "on" : "off"}
            onChange={async (v) => {
              if (v && !(await confirmRisky(`Turn on "${c.label}"`, null, target_ms, now))) return;
              act({ op: "update", id: c.id, values: { is_enabled: v } });
            }}
          />
          <div className="flex flex-wrap gap-4">
            <Switch on={c.show_on_landing} label="landing" onChange={(v) => act({ op: "update", id: c.id, values: { show_on_landing: v } })} />
            <Switch on={c.show_in_app} label="app" onChange={(v) => act({ op: "update", id: c.id, values: { show_in_app: v } })} />
          </div>
        </div>
      </div>

      <Preview c={c} now={now} />

      <div className="flex flex-wrap items-end gap-3 mt-3">
        <label className="block">
          <span className="font-mono text-[0.65rem] text-text-muted">change target ({nyZoneLabel(c.target_at)})</span>
          <div className="flex gap-2 mt-1">
            <input type="datetime-local" value={target} onChange={(e) => setTarget(e.target.value)} />
            <Btn disabled={!target || target === utcToNyInput(c.target_at)} onClick={saveTarget}>
              save
            </Btn>
          </div>
        </label>
        <PushBack
          onPush={async (minutes) => {
            if (!(await confirmRisky(`Push "${c.label}" back`, target_ms, target_ms + minutes * 60_000, now))) return;
            act({ op: "push_back", kind: "site", id: c.id, minutes });
          }}
        />
      </div>

      <div className="flex gap-2 mt-3">
        <Btn onClick={() => setEditing((e) => !e)}>{editing ? "close" : "edit text"}</Btn>
        <Btn variant="danger" onClick={async () => (await askConfirm(`Delete the countdown "${c.label}"?`, { ok: "delete", danger: true })) && act({ op: "delete", id: c.id })}>
          delete
        </Btn>
      </div>
      {editing && (
        <div className="mt-3">
          <CountdownForm
            initial={c}
            onCancel={() => setEditing(false)}
            onSave={async (values) => {
              if (await act({ op: "update", id: c.id, values })) setEditing(false);
            }}
          />
        </div>
      )}
    </Card>
  );
}

function SprintCard({ s, now, act }: { s: SprintRow; now: number | null; act: (b: Record<string, unknown>) => Promise<boolean> }) {
  const c = asSprintCountdown(s);
  const next = c && now !== null ? nextMilestone(c, now) : null;
  const shows = s.is_published && s.status_override !== "cancelled" && (s.show_countdown_on_landing || s.show_countdown_in_app);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-text-primary">
          {s.countdown_headline_override || s.title}
          <span className="font-mono text-[0.6rem] text-text-faint ml-2">Buildathon #{s.number} · {s.state}</span>
        </p>
        <span className="font-mono text-[0.65rem]" style={{ color: shows ? "#22c55e" : "var(--text-muted)" }}>
          {!s.is_published ? "draft: not shown" : s.status_override === "cancelled" ? "cancelled: not shown" : shows ? "on" : "off"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <div className="space-y-1">
          <p className="font-mono text-[0.65rem] text-text-muted">
            {!c ? "no dates yet" : s.status_override === "paused" ? "paused" : next ? `counts to ${next.label.toLowerCase()} · ${formatNy(next.at)}` : "nothing left to count to"}
          </p>
          <p className="font-mono text-sm tabular-nums" style={{ color: "#f8c56a" }}>
            {next && now !== null && s.status_override !== "paused" ? formatRemaining(Date.parse(next.at) - now) : "—"}
          </p>
          <p className="font-mono text-[0.6rem] text-text-faint">Always the Buildathon&apos;s real times. Moving it moves the Buildathon.</p>
        </div>
        <div className="flex flex-wrap gap-4 content-start">
          <Switch
            on={s.show_countdown_on_landing}
            label="landing"
            onChange={(v) => act({ op: "sprint_toggle", id: s.id, field: "show_countdown_on_landing", value: v })}
          />
          <Switch
            on={s.show_countdown_in_app}
            label="app"
            onChange={(v) => act({ op: "sprint_toggle", id: s.id, field: "show_countdown_in_app", value: v })}
          />
        </div>
      </div>

      {c && <Preview c={c} now={now} />}

      {next && (
        <div className="mt-3">
          <PushBack
            onPush={async (minutes) => {
              const at = Date.parse(next.at);
              const running = ["live", "judging", "paused"].includes(s.state);
              const risky = at <= (now ?? Date.now()) + HOUR || running;
              if (
                !(await askConfirm(
                  `Push Buildathon #${s.number}'s ${next.label.toLowerCase()} and everything after it back by ${minutes >= 1440 && minutes % 1440 === 0 ? `${minutes / 1440} day(s)` : `${minutes / 60} hour(s)`}?\n\n` +
                    "This moves the Buildathon's real times: countdowns, locks and emails all follow." +
                    (risky ? "\n\nThat time is under an hour away or the Buildathon is running: members see it within a minute." : ""),
                  { ok: "push back" },
                ))
              )
                return;
              act({ op: "push_back", kind: "sprint", id: s.id, minutes });
            }}
          />
        </div>
      )}
    </Card>
  );
}

/** How it looks, drawn with the same component the site uses. */
function Preview({ c, now }: { c: SiteCountdown | SprintCountdown; now: number | null }) {
  return (
    <details className="mt-3">
      <summary className="font-mono text-[0.65rem] text-text-muted cursor-pointer">preview</summary>
      <div className="mt-2 space-y-3">
        <div>
          <p className="font-mono text-[0.6rem] text-text-faint mb-1">landing page</p>
          <div className="p-3" style={{ background: "#0b0e13" }}>
            <CountdownView countdown={c} now={now} variant="landing" />
          </div>
        </div>
        <div>
          <p className="font-mono text-[0.6rem] text-text-faint mb-1">in the app</p>
          <div className="px-4 py-2" style={{ background: "rgba(245, 158, 11, 0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <CountdownView countdown={c} now={now} variant="app" />
          </div>
        </div>
      </div>
    </details>
  );
}

// Defined outside the form so inputs keep their focus between keystrokes.
function L({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono lowercase text-[0.65rem] text-text-muted">{t}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CountdownForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: SiteRow;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState(initial?.key ?? "launch");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [subtext, setSubtext] = useState(initial?.subtext ?? "");
  const [target, setTarget] = useState(utcToNyInput(initial?.target_at ?? null));
  const [zero, setZero] = useState<"hide" | "show_message">(initial?.zero_behavior ?? "show_message");
  const [zeroMsg, setZeroMsg] = useState(initial?.zero_message ?? "");
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? "");
  const [ctaUrl, setCtaUrl] = useState(initial?.cta_url ?? "");
  const [landing, setLanding] = useState(initial?.show_on_landing ?? true);
  const [app, setApp] = useState(initial?.show_in_app ?? false);
  const [launch, setLaunch] = useState(initial?.is_launch ?? !initial);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    const p = nyInputToUtc(target);
    if (!p.ok) return setErr(p.error);
    const values: Record<string, unknown> = {
      label,
      subtext,
      zero_behavior: zero,
      zero_message: zeroMsg,
      cta_label: ctaLabel,
      cta_url: ctaUrl,
      show_on_landing: landing,
      show_in_app: app,
      is_launch: launch,
    };
    if (!initial) {
      values.key = key;
      values.target_at = p.iso;
      values.is_enabled = false; // new ones start off; switch on when ready
    } else if (p.iso !== new Date(initial.target_at).toISOString()) {
      values.target_at = p.iso;
    }
    setErr(null);
    onSave(values);
  }

  return (
    <Card>
      <Kicker>{initial ? "edit countdown" : "new countdown (starts switched off)"}</Kicker>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!initial && (
          <L t="key (e.g. launch, teaser)">
            <input value={key} onChange={(e) => setKey(e.target.value.toLowerCase())} />
          </L>
        )}
        <L t="headline">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Founding seats open" />
        </L>
        <L t="subtext (optional)">
          <input value={subtext} onChange={(e) => setSubtext(e.target.value)} />
        </L>
        <L t={`target (new york · ${nyZoneLabel(null)})`}>
          <input type="datetime-local" value={target} onChange={(e) => setTarget(e.target.value)} />
        </L>
        <L t="at zero">
          <select value={zero} onChange={(e) => setZero(e.target.value as "hide" | "show_message")}>
            <option value="show_message">show a message</option>
            <option value="hide">hide</option>
          </select>
        </L>
        {zero === "show_message" && (
          <L t="message at zero">
            <input value={zeroMsg} onChange={(e) => setZeroMsg(e.target.value)} placeholder="Doors are open" />
          </L>
        )}
        <L t="button label (optional)">
          <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Request an invite" />
        </L>
        <L t="button link">
          <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/signup" />
        </L>
      </div>
      <div className="flex flex-wrap gap-4 mt-3">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={landing} onChange={(e) => setLanding(e.target.checked)} /> landing page
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={app} onChange={(e) => setApp(e.target.checked)} /> in the app
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={launch} onChange={(e) => setLaunch(e.target.checked)} /> this is the launch countdown
        </label>
      </div>
      <div className="flex gap-2 mt-4">
        <Btn variant="primary" onClick={save} disabled={!label.trim() || !target}>
          {initial ? "save" : "create"}
        </Btn>
        <Btn onClick={onCancel}>cancel</Btn>
      </div>
      <ErrorLine>{err}</ErrorLine>
    </Card>
  );
}

/**
 * Which one message the landing page's relay shows right now (Phase 11),
 * picked by the same code as the page, from the same public data. Re-read
 * whenever this section reloads.
 */
function LandingNow({ version, now, waitlistOn }: { version: unknown; now: number | null; waitlistOn: boolean }) {
  const [relay, setRelay] = useState<RelayData | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/countdowns/landing", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && j && setRelay(j as RelayData))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);
  if (!relay || now === null) return null;
  const item = pickRelay(relay, now, waitlistOn);
  return (
    <Card className="mb-4">
      <p className="font-mono text-[0.65rem] text-text-faint">on the landing page now (one message: standalone, then a buildathon about to start, live, judging, the latest recap)</p>
      <p className="text-sm text-text-primary mt-1">
        {item ? (
          <>
            {item.title}
            {item.countLabel ? ` · ${item.countLabel.toLowerCase()}` : ""}
            {item.target !== null ? ` ${formatRemaining(Math.max(0, item.target - now))}` : ""}
            {item.message ? ` · ${item.message}` : ""}
          </>
        ) : (
          <span className="text-text-muted">nothing: every landing countdown is off or over, so the hero shows no relay</span>
        )}
      </p>
      <p className="font-mono text-[0.6rem] text-text-faint mt-1">visitors see a change within about a minute.</p>
    </Card>
  );
}
