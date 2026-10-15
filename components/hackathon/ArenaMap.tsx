"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Countdown from "@/components/countdown/Countdown";
import PersonAvatar from "@/components/ui/PersonAvatar";
import type { ArenaTeam, TeamPulse } from "@/lib/hackathons/page";
import s from "./arenaMap.module.css";

// The arena as a stadium (live page): the Sprint's clock on the field in the
// middle, every team a pod on the rings around it, glowing with how recently
// it was active. Drag to move; pinch, ⌘/Ctrl + scroll or the buttons to zoom.
//
// It never squishes: each ring holds as many pods as fit its length, more
// teams add rings (like stadium tiers) and the map zooms out to fit. Zoomed
// out, pods drop their faces and status line and keep the name in larger type,
// then just a plate with the emblem (levels of detail), so a big Sprint still
// reads as a crowd, not a smear. The field's clock keeps a readable size.
//
// A pod is a compact version of the arena's team card, in the same finish.
//
// Pods keep their seats: placement follows the server's team order (your team
// first, at the top), not activity, so nothing jumps around as teams work.

export type Heat = "hot" | "warm" | "quiet" | "idle";

const POD_W = 232;
const POD_H = 104;
const FIELD_RX = 215; // the field in the middle
const FIELD_RY = 130;
const CLEAR = 40; // between the field and the first ring of pods (pod corners included)
const RING_GAP = 150;
const SPACING = POD_W + 30; // along a ring
const MARGIN = 44;
// Levels of detail. A Sprint of up to SMALL teams always shows full pods. A
// bigger one keeps them down to NEAR, shows names only below that, and plain
// plates only for a very big crowd (more than CROWD) seen whole, below FAR.
const SMALL = 16;
const CROWD = 60;
const NEAR = 0.4;
const FAR = 0.2;
const MIN_K = 0.12;
const MAX_K = 2.4;

type Seat = { team: ArenaTeam; x: number; y: number; ring: number };

/** Points along an ellipse, evenly spaced by arc length, starting at the top. */
function placeOnEllipse(rx: number, ry: number, n: number, offset: number): { x: number; y: number }[] {
  const steps = 720;
  const pts: { x: number; y: number; len: number }[] = [];
  let len = 0;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    const p = { x: rx * Math.cos(a), y: ry * Math.sin(a) };
    if (i > 0) len += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    pts.push({ ...p, len });
  }
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const target = (((i + offset) / n) % 1) * len;
    let j = 0;
    while (j < steps && pts[j + 1].len < target) j++;
    // Whole pixels, so the server's HTML and the browser's agree exactly.
    out.push({ x: Math.round(pts[j].x), y: Math.round(pts[j].y) });
  }
  return out;
}

function perimeter(rx: number, ry: number) {
  // Ramanujan's approximation.
  return Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
}

/** Seats on the rings. Upright (portrait) when the map's box is taller than wide. */
function layout(teams: ArenaTeam[], upright: boolean) {
  const seats: Seat[] = [];
  const rings: { rx: number; ry: number }[] = [];
  let i = 0;
  for (let ring = 0; i < teams.length; ring++) {
    // The first ring just clears the field (whichever way it stands); each
    // further ring is one pod deeper.
    const fieldRx = upright ? FIELD_RY : FIELD_RX;
    const fieldRy = upright ? FIELD_RX : FIELD_RY;
    const rx = fieldRx + POD_W / 2 + CLEAR + ring * RING_GAP;
    const ry = fieldRy + POD_H / 2 + CLEAR + ring * RING_GAP;
    const cap = Math.max(4, Math.floor(perimeter(rx, ry) / SPACING));
    const here = teams.slice(i, i + cap);
    // Every other ring is staggered half a seat, like stadium rows.
    placeOnEllipse(rx, ry, here.length, ring % 2 ? 0.5 : 0).forEach((p, k) => seats.push({ team: here[k], ...p, ring }));
    rings.push({ rx, ry });
    i += here.length;
  }
  const outer = rings[rings.length - 1] ?? { rx: FIELD_RX + POD_W, ry: FIELD_RY + POD_H };
  const w = Math.round(2 * (outer.rx + POD_W / 2 + MARGIN));
  const h = Math.round(2 * (outer.ry + POD_H / 2 + MARGIN));
  return { seats, rings, w, h };
}

const firstName = (n: string | null) => (n ?? "Founder").split(/\s+/)[0];

export default function ArenaMap({
  teams,
  pulses,
  heatOf,
  agoText,
  now,
  myTeamId,
  sprintNumber,
  rippling,
  center,
  fill = false,
}: {
  teams: ArenaTeam[];
  pulses: Map<string, TeamPulse>;
  heatOf: (lastActive: string | null, now: number) => Heat;
  agoText: (iso: string, now: number) => string;
  now: number;
  myTeamId: string | null;
  sprintNumber: number;
  rippling: Set<string>;
  center: { label: string; at: string | null; theme: string | null };
  /** Fill the height of its container (beside the Sprint chat) instead of its own. */
  fill?: boolean;
}) {
  // Your team takes the top seat; the rest keep the server's order.
  const seated = useMemo(() => {
    const mine = teams.filter((t) => t.id === myTeamId);
    return [...mine, ...teams.filter((t) => t.id !== myTeamId)];
  }, [teams, myTeamId]);
  const [upright, setUpright] = useState(false);
  const uprightRef = useRef(false);
  uprightRef.current = upright;
  const { seats, rings, w, h } = useMemo(() => layout(seated, upright), [seated, upright]);
  const fieldRx = upright ? FIELD_RY : FIELD_RX;
  const fieldRy = upright ? FIELD_RX : FIELD_RY;
  const submitted = teams.filter((t) => pulses.get(t.id)?.has_submitted).length;

  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const [lod, setLod] = useState<"near" | "mid" | "far">("near");
  const countRef = useRef(teams.length);
  countRef.current = teams.length;
  const [selected, setSelected] = useState<string | null>(null);
  const moved = useRef(false);

  const apply = useCallback(() => {
    const { x, y, k } = view.current;
    if (world.current) world.current.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    // The field's words grow a little as the map zooms out, never past the
    // field; zoomed out, it drops the theme line.
    if (field.current) {
      field.current.style.transform = `translate(-50%, -50%) scale(${Math.min(1.12, Math.max(1, 0.8 / k))})`;
      field.current.dataset.compact = String(k < 0.6);
    }
    const n = countRef.current;
    setLod(n <= SMALL || k >= NEAR ? "near" : n <= CROWD || k >= FAR ? "mid" : "far");
  }, []);

  const fit = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const k = Math.min(MAX_K, Math.max(MIN_K, Math.min(width / w, height / h) * 0.96));
    view.current = { k, x: (width - w * k) / 2, y: (height - h * k) / 2 };
    apply();
  }, [w, h, apply]);

  // Fit on first draw, and again when the map's box changes size (standing
  // the stadium upright in a box taller than it is wide).
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const orient = () => {
      const r = el.getBoundingClientRect();
      setUpright(r.height > r.width * 1.05);
    };
    orient();
    fit();
    const ro = new ResizeObserver(() => {
      orient();
      fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = view.current;
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const f = k / v.k;
      view.current = { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
      apply();
    },
    [apply],
  );
  const zoomCenter = (factor: number) => {
    const r = viewport.current?.getBoundingClientRect();
    if (r) zoomAt(factor, r.width / 2, r.height / 2);
  };

  // ⌘/Ctrl + scroll (and a trackpad pinch, which arrives as one) zooms; a
  // plain scroll keeps scrolling the page.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0045), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Dragging and pinching. One pointer moves the map (on a phone, a vertical
  // swipe still scrolls the page: touch-action pan-y); two pinch and move.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mx: number; my: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(`.${s.controls}, .${s.card}`)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // The pointer is captured only once it starts dragging, so a tap still
    // reaches the pod under it.
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      for (const id of pointers.current.keys()) (e.currentTarget as HTMLElement).setPointerCapture(id);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    const r = viewport.current!.getBoundingClientRect();
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      view.current.x += mx - pinch.current.mx;
      view.current.y += my - pinch.current.my;
      zoomAt(dist / pinch.current.dist, mx - r.left, my - r.top);
      pinch.current = { dist, mx, my };
      moved.current = true;
      return;
    }
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 0) {
      if (!moved.current && Math.abs(dx) + Math.abs(dy) > 2) {
        moved.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
      view.current.x += dx;
      view.current.y += dy;
      apply();
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const chosen = selected ? teams.find((t) => t.id === selected) ?? null : null;
  const chosenPulse = chosen ? pulses.get(chosen.id) ?? null : null;

  return (
    <div className={s.frame} style={fill ? { height: "100%" } : undefined}>
      <div
        ref={viewport}
        className={`${s.viewport} ${lod === "near" ? "" : lod === "mid" ? s.mid : s.far}`}
        style={fill ? { height: "100%", minHeight: 280 } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          if (!moved.current && e.target === e.currentTarget) setSelected(null);
        }}
      >
        <div ref={world} className={s.world} style={{ width: w, height: h }}>
          <svg className={s.stadium} width={w} height={h} viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} aria-hidden>
            <defs>
              <radialGradient id="arena-field" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(245, 158, 11, 0.16)" />
                <stop offset="100%" stopColor="rgba(245, 158, 11, 0.02)" />
              </radialGradient>
            </defs>
            {/* The stands: one track per ring, outermost first. */}
            {[...rings].reverse().map((r, i) => (
              <ellipse
                key={i}
                cx={0}
                cy={0}
                rx={r.rx + POD_H * 0.75}
                ry={r.ry + POD_H * 0.75}
                className={s.stand}
              />
            ))}
            {rings.map((r, i) => (
              <ellipse key={`t${i}`} cx={0} cy={0} rx={r.rx} ry={r.ry} className={s.track} />
            ))}
            <ellipse cx={0} cy={0} rx={fieldRx} ry={fieldRy} fill="url(#arena-field)" className={s.field} />
            <ellipse cx={0} cy={0} rx={fieldRx - (upright ? 22 : 26)} ry={fieldRy - (upright ? 26 : 22)} className={s.fieldLine} />
          </svg>

          <div ref={field} className={s.center} style={{ left: w / 2, top: h / 2, width: fieldRx * 1.7 }}>
            <p className={s.centerLabel}>{center.label}</p>
            {center.at && (
              <div className={s.centerClock}>
                <Countdown target={center.at} />
              </div>
            )}
            <p className={s.centerMeta}>
              {submitted} of {teams.length} submitted
            </p>
            {center.theme && <p className={s.centerTheme}>{center.theme}</p>}
          </div>

          {seats.map((seat) => (
            <Pod
              key={seat.team.id}
              team={seat.team}
              x={w / 2 + seat.x - POD_W / 2}
              y={h / 2 + seat.y - POD_H / 2}
              pulse={pulses.get(seat.team.id) ?? null}
              heat={heatOf(pulses.get(seat.team.id)?.last_active_at ?? null, now)}
              activity={(() => {
                const at = pulses.get(seat.team.id)?.last_active_at;
                return at ? agoText(at, now) : "no activity yet";
              })()}
              mine={seat.team.id === myTeamId}
              rippling={rippling.has(seat.team.id)}
              selected={seat.team.id === selected}
              onPick={() => {
                if (!moved.current) setSelected((cur) => (cur === seat.team.id ? null : seat.team.id));
              }}
            />
          ))}
        </div>

        <div className={s.controls}>
          <button type="button" onClick={() => zoomCenter(1.3)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomCenter(1 / 1.3)} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={fit} aria-label="Fit everyone" className={s.fitBtn}>
            fit
          </button>
        </div>
        <p className={s.hint}>Drag to move · pinch or ⌘/Ctrl + scroll to zoom · tap a team</p>

        {chosen && (
          <div className={s.card} role="dialog" aria-label={chosen.name}>
            <div className={s.cardHead}>
              <span className={s.cardEmblem} style={{ ["--team" as string]: chosen.color ?? "#f59e0b" }}>
                {chosen.emblem || chosen.name.slice(0, 1).toUpperCase()}
              </span>
              <div style={{ minWidth: 0 }}>
                <p className={s.cardName}>{chosen.name}</p>
                <p className={s.cardSub}>
                  {chosen.members.length} builder{chosen.members.length === 1 ? "" : "s"}
                  {chosen.is_random_matched ? " · matched" : ""} ·{" "}
                  {chosenPulse?.has_submitted
                    ? "submitted ✓"
                    : chosenPulse?.last_active_at
                      ? agoText(chosenPulse.last_active_at, now)
                      : "no activity yet"}
                </p>
              </div>
              <button type="button" className={s.cardClose} onClick={() => setSelected(null)} aria-label="Close">
                ×
              </button>
            </div>
            <ul className={s.cardPeople}>
              {chosen.members.map((m) => (
                <li key={m.id}>
                  <PersonAvatar name={m.full_name} stage={m.stage} username={m.username} size={22} />
                  <span>{firstName(m.full_name)}</span>
                  {m.cohort && <span className={s.cardCohort}>{m.cohort}</span>}
                </li>
              ))}
            </ul>
            <p className={s.cardSealed}>The project is sealed until the reveal.</p>
            {chosen.id === myTeamId && (
              <Link href={`/hackathon/${sprintNumber}/team/${chosen.slug}`} className={s.cardLink}>
                Go to my team room →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const HEAT_BARS: Record<Heat, number> = { hot: 4, warm: 3, quiet: 2, idle: 1 };

const Pod = memo(function Pod({
  team,
  x,
  y,
  pulse,
  heat,
  activity,
  mine,
  rippling,
  selected,
  onPick,
}: {
  team: ArenaTeam;
  x: number;
  y: number;
  pulse: TeamPulse | null;
  heat: Heat;
  activity: string;
  mine: boolean;
  rippling: boolean;
  selected: boolean;
  onPick: () => void;
}) {
  const shown = team.members.slice(0, 4);
  const done = !!pulse?.has_submitted;
  return (
    <button
      type="button"
      className={[s.pod, s[`heat_${heat}`], done ? s.done : "", mine ? s.mine : "", rippling ? s.ripple : "", selected ? s.picked : ""].join(" ")}
      style={{ left: x, top: y, width: POD_W, height: POD_H, ["--team" as string]: team.color ?? "#f59e0b" }}
      onClick={onPick}
      aria-label={`${team.name}, ${team.members.length} builders, ${done ? "submitted" : activity}${mine ? ", your team" : ""}`}
      title={team.name}
    >
      <span className={s.podTop}>
        <span className={s.podEmblem} aria-hidden>
          {team.emblem || team.name.slice(0, 1).toUpperCase()}
        </span>
        <span className={s.podName}>{team.name}</span>
        {done ? (
          <span className={s.podDone}>Submitted ✓</span>
        ) : (
          <span className={s.podBars} aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={`${s.podBar} ${i <= HEAT_BARS[heat] && heat !== "idle" ? s.podBarOn : ""}`} style={{ height: 3 + i * 2 }} />
            ))}
          </span>
        )}
      </span>
      <span className={s.podPeople}>
        <span className={s.podFaces}>
          {shown.map((m) => (
            <span key={m.id} className={s.podFace}>
              <PersonAvatar name={m.full_name} stage={m.stage} username={m.username} size={20} />
            </span>
          ))}
        </span>
        <span className={s.podNames}>{team.members.map((m) => firstName(m.full_name)).join(", ")}</span>
      </span>
      <span className={s.podFoot}>
        {mine ? <span className={s.podYou}>Your team</span> : <span>Sealed</span>}
        <span aria-hidden>·</span>
        <span className={s.podActivity}>{done ? "sealed until the reveal" : activity}</span>
      </span>
    </button>
  );
});
