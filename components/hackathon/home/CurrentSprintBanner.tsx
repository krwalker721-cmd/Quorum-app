import Link from "next/link";
import ui from "@/components/ui/sleek.module.css";
import Countdown from "@/components/countdown/Countdown";
import LocalTime from "@/components/hackathon/LocalTime";
import { STATE_LABEL, type SprintState } from "@/lib/hackathons/sprint";
import s from "./home.module.css";
import { buildathonName } from "@/lib/hackathons/defaults";

/** What the Buildathon home says about the Sprint that's on (or next). */
export type CurrentSprint = {
  number: number;
  title: string;
  tagline: string | null;
  state: SprintState;
  /** The next moment that matters, and what it is ("Sign-ups close in"). */
  countdown: { label: string; at: string } | null;
  /** Show ticking digits (the Sprint's in-app countdown switch), or just the time. */
  ticking: boolean;
  cta: { label: string; href: string };
  /** "8 signed up · 3 teams", while sign-ups are open. */
  meta: string | null;
};

/** The one amber block on the home page: the current Sprint, its clock, and the way in. */
export default function CurrentSprintBanner({ sprint }: { sprint: CurrentSprint }) {
  const live = sprint.state === "live";
  return (
    <section className={`${ui.tileHero} ${s.banner}`} aria-label={`Buildathon #${sprint.number}`}>
      <div className={s.bannerMain}>
        <p className={s.bannerKicker}>
          {live || sprint.state === "judging" || sprint.state === "paused"
            ? "Happening now"
            : sprint.state === "revealed" || sprint.state === "cancelled"
              ? "The latest Buildathon"
              : "Coming up"}
          <span className={s.bannerState}>
            {live && <span className={ui.liveDot} aria-hidden style={{ width: 6, height: 6 }} />}
            {STATE_LABEL[sprint.state]}
          </span>
        </p>
        <h2 className={s.bannerTitle}>{buildathonName(sprint.number)}</h2>
        {sprint.tagline && <p className={s.bannerTagline}>{sprint.tagline}</p>}
        {sprint.meta && <p className={s.bannerMeta}>{sprint.meta}</p>}
      </div>
      <div className={s.bannerSide}>
        {sprint.countdown && (
          <div>
            <p className={s.bannerClockLabel}>{sprint.countdown.label}</p>
            {sprint.ticking ? (
              <Countdown target={sprint.countdown.at} />
            ) : (
              <p style={{ fontSize: 16, color: "var(--text-primary)" }}>
                <LocalTime iso={sprint.countdown.at} />
              </p>
            )}
          </div>
        )}
        <Link href={sprint.cta.href} className={ui.primaryBtn} style={{ textDecoration: "none" }}>
          {sprint.cta.label} →
        </Link>
      </div>
    </section>
  );
}
