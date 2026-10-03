"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TeamBadge } from "@/components/hackathon/TeamStyle";
import s from "./showcase.module.css";

// The reveal moment (Phase 10). Whoever had the Sprint page open while it was
// sealed (judging) sees it once when the page turns to revealed at reveal_at:
// the sealed team cards, their wax seals cracking one by one, each card
// turning over into its project, then the awards and gallery. About three
// seconds, skippable, and none of it under prefers-reduced-motion (a plain
// line instead). `?reveal=replay` plays it again on any revealed Sprint;
// everything on the stage is already public.

const sealedKey = (n: number) => `quorum-sprint-sealed-${n}`;
const PLAY_WITHIN_MS = 10 * 60_000;
const MAX_CARDS = 12;

/** On the sealed (judging) page: remember that this viewer was here. */
export function SealWatcher({ sprintNumber }: { sprintNumber: number }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(sealedKey(sprintNumber), String(Date.now()));
    } catch {
      // Private mode without storage: they just won't get the animation.
    }
  }, [sprintNumber]);
  return null;
}

export type StageTeam = {
  id: string;
  name: string;
  emblem: string | null;
  color: string | null;
  project: { name: string; image: string | null } | null;
};

type Step = "idle" | "stage" | "leaving" | "done" | "quiet";

export default function RevealMoment({
  sprintNumber,
  revealAt,
  teams,
  children,
}: {
  sprintNumber: number;
  revealAt: string;
  teams: StageTeam[];
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("idle");
  const [cracked, setCracked] = useState(0);
  const [turned, setTurned] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shown = teams.slice(0, MAX_CARDS);

  // Decide before the first paint, so the gallery doesn't flash first when
  // the page turns over in place.
  useLayoutEffect(() => {
    let sawSealed = false;
    try {
      const at = sessionStorage.getItem(sealedKey(sprintNumber));
      sawSealed = Boolean(at) && Date.now() - Date.parse(revealAt) < PLAY_WITHIN_MS;
      sessionStorage.removeItem(sealedKey(sprintNumber));
    } catch {
      // no storage: no animation
    }
    if (!sawSealed && params.get("reveal") !== "replay") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep("quiet");
      return;
    }
    setStep("stage");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timers are cleared only when the page goes away: clearing them on each
  // step change would cancel the hand-over to the gallery mid-way.
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  useEffect(() => {
    if (step !== "stage" || timers.current.length > 0) return;
    const n = shown.length;
    const gap = n > 0 ? Math.min(220, 1500 / n) : 0;
    const t = (ms: number, f: () => void) => timers.current.push(setTimeout(f, ms));
    for (let i = 0; i < n; i++) {
      t(700 + i * gap, () => setCracked((c) => Math.max(c, i + 1)));
      t(950 + i * gap, () => setTurned((c) => Math.max(c, i + 1)));
    }
    const end = 950 + n * gap + 1300;
    t(end, () => setStep("leaving"));
    t(end + 600, () => setStep("done"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (step === "idle") return <>{children}</>;
  if (step === "quiet" || step === "done") {
    return (
      <div className={step === "done" ? s.arrive : undefined}>
        {step === "quiet" && (
          <p role="status" style={{ fontSize: 15, fontWeight: 600, color: "#f8c56a", marginBottom: 12 }}>
            The results are in. Every project is unsealed.
          </p>
        )}
        {children}
      </div>
    );
  }

  const allTurned = turned >= shown.length;
  return (
    <section className={`${s.stage} ${step === "leaving" ? s.stageLeaving : ""}`} aria-live="polite">
      <button
        type="button"
        className={s.skip}
        onClick={() => {
          timers.current.forEach(clearTimeout);
          setStep("done");
        }}
      >
        Skip
      </button>
      <p className={s.stageTitle}>{allTurned ? "Here's what everyone built" : `Unsealing Sprint #${sprintNumber}…`}</p>
      <div className={s.stageGrid}>
        {shown.map((team, i) => {
          const isCracked = i < cracked;
          const isTurned = i < turned;
          const c = team.color ?? "#f59e0b";
          return (
            <div
              key={team.id}
              className={`${s.flip} ${isCracked ? s.cracked : ""} ${isTurned && team.project ? s.flipped : ""} ${
                isTurned && !team.project ? s.quietCard : ""
              }`}
            >
              <div className={s.flipInner}>
                <div className={s.face}>
                  <TeamBadge name={team.name} emblem={team.emblem} color={team.color} size={44} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{team.name}</span>
                  <span className={s.waxSeal} aria-hidden>
                    ◆
                  </span>
                </div>
                {team.project && (
                  <div className={`${s.face} ${s.back}`} style={{ background: `radial-gradient(90% 90% at 30% 20%, ${c}40, #0d1117)` }}>
                    {team.project.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={team.project.image} alt="" />
                    )}
                    <span className={s.backLabel}>{team.project.name}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
