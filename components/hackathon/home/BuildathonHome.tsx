import Link from "next/link";
import ui from "@/components/ui/sleek.module.css";
import { REVIEW_QUESTIONS } from "@/lib/hackathons/reviewShared";
import CurrentSprintBanner, { type CurrentSprint } from "./CurrentSprintBanner";
import s from "./home.module.css";

// The Buildathon tab's home: the current Sprint (if any) with its clock and
// the way in, then what the format is, shown as a place to do serious work: an
// example of a live Sprint, the format's spec, how a Sprint runs and how
// projects are judged. Each Sprint keeps its own page (/hackathon/N).

export default function BuildathonHome({ hasPast, current }: { hasPast: boolean; current: CurrentSprint | null }) {
  return (
    <div className={s.wrap}>
      {current && <CurrentSprintBanner sprint={current} />}
      <HowItWorks hasPast={hasPast} current={current} />
    </div>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <span className={s.status}>
      <span className={s.quietDot} />
      {children}
    </span>
  );
}

// ── A: the format, shown as a place to do serious work
// Everything in the pictures is illustrative: example teams, not real data.
const MOCK_TEAMS = [
  { name: "Night Owls", emblem: "◉", color: "#a78bfa", faces: ["#a78bfa", "#38bdf8", "#f472b6"], status: "submitted" },
  { name: "Rockets", emblem: "▲", color: "#f59e0b", faces: ["#f59e0b", "#22c55e", "#fb923c", "#2dd4bf"], status: "active 4 min ago" },
  { name: "Solo Studio", emblem: "✦", color: "#2dd4bf", faces: ["#2dd4bf", "#facc15"], status: "active 22 min ago" },
];

function Badge({ emblem, color }: { emblem: string; color: string }) {
  return (
    <span className={s.badge} style={{ color, background: `${color}1a`, border: `1px solid ${color}4d` }}>
      {emblem}
    </span>
  );
}

function Faces({ colors }: { colors: string[] }) {
  return (
    <span className={s.faces}>
      {colors.map((c, i) => (
        <span key={i} className={s.face} style={{ background: c, marginLeft: i === 0 ? 0 : undefined }} />
      ))}
    </span>
  );
}

function LiveSprintMock() {
  return (
    <div aria-hidden>
      <div className={s.mock}>
        <div className={s.mockBar}>
          <span>Example Sprint · Arena</span>
          <span className={s.liveChip}>
            <span className={s.liveDot} />
            Live
          </span>
        </div>
        <div className={s.mockClock}>
          <span className={s.mockClockLabel}>Submissions close in</span>
          <span className={s.mockDigits}>31:42:08</span>
        </div>
        <div className={s.mockTeams}>
          {MOCK_TEAMS.map((t) => (
            <div key={t.name} className={s.mockTeam}>
              <Badge emblem={t.emblem} color={t.color} />
              <span>{t.name}</span>
              <Faces colors={t.faces} />
              {t.status === "submitted" ? <span className={s.submitted}>Submitted ✓</span> : <span className={s.activity}>{t.status}</span>}
            </div>
          ))}
        </div>
        <div className={s.mockFoot}>
          <span>Every project sealed until the reveal</span>
          <span>1 of 3 submitted</span>
        </div>
        <div className={s.bar}>
          <div className={s.barFill} style={{ width: "33%" }} />
        </div>
      </div>
      <p className={s.mockCaption}>Example: the arena during a live Sprint</p>
    </div>
  );
}

const SPEC = [
  { key: "Duration", val: "48 hours", note: "kickoff to deadline" },
  { key: "Teams", val: "2 to 4 founders", note: "your own, or matched" },
  { key: "Visibility", val: "Sealed", note: "until the reveal" },
  { key: "Outcome", val: "Awards and a public page", note: "no rankings" },
];

const PHASES: { when: string; title: string; text: string; pic: React.ReactNode }[] = [
  {
    when: "Up to 7 days before",
    title: "Registration",
    text: "Sign up with your own team, or join the random pool.",
    pic: (
      <>
        <span className={`${s.miniPill} ${s.miniPillOn}`}>Random pool</span>
        <span className={s.miniPill}>Own team</span>
      </>
    ),
  },
  {
    when: "1 hour before kickoff",
    title: "Teams lock",
    text: "Anyone still in the pool is matched into a team of 2 to 4.",
    pic: (
      <>
        <Badge emblem="◉" color="#a78bfa" />
        <Faces colors={["#a78bfa", "#38bdf8", "#f472b6"]} />
        <span className={s.miniMuted}>3 of 4</span>
      </>
    ),
  },
  {
    when: "Kickoff → 48 hours",
    title: "Build",
    text: "The theme drops. Each team works in a private room and submits before the deadline.",
    pic: (
      <>
        <span className={s.miniDigits}>47:59:59</span>
        <span className={s.miniMuted}>sealed</span>
      </>
    ),
  },
  {
    when: "After the deadline",
    title: "Review, then the reveal",
    text: "Everyone who built reviews a few other projects. Then every project unseals at once, with the awards that came out of it.",
    pic: (
      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <span className={s.miniAward}>★ Community pick</span>
        <span className={s.miniProject}>Afterhours</span>
      </span>
    ),
  },
];

function HowItWorks({ hasPast, current }: { hasPast: boolean; current: CurrentSprint | null }) {
  return (
    <>
      <section className={s.stage}>
        <div aria-hidden className={s.glow} />
        <div className={s.heroGrid}>
          <div>
            {!current && <Status>No Sprint scheduled yet</Status>}
            <h1 className={`${s.pageTitle} ${ui.titleGradient}`}>Buildathon</h1>
            <p className={s.heroLede}>
              48-hour Sprints where founders from across the network form teams and build something new from scratch.
              There are no judges: after the deadline everyone who built reviews a few other projects, and the awards work
              themselves out from those reviews.
            </p>
            <div className={s.quietLinks}>
              <a href="#runs" className={s.quietLink}>
                How a Sprint runs ↓
              </a>
              {hasPast && (
                <Link href="/hackathon/archive" className={s.quietLink}>
                  Past Sprints →
                </Link>
              )}
            </div>
          </div>
          <LiveSprintMock />
        </div>
      </section>

      <div className={s.spec}>
        {SPEC.map((x) => (
          <div key={x.key} className={s.specCell}>
            <p className={s.specKey}>{x.key}</p>
            <p className={s.specVal}>{x.val}</p>
            <p className={s.specNote}>{x.note}</p>
          </div>
        ))}
      </div>

      <div id="runs" className={s.secHead}>
        <h2 className={s.secTitle}>How a Sprint runs</h2>
        <span className={s.secNote}>Every time is set per Sprint and shown in your time zone</span>
      </div>
      <div className={s.timeline}>
        {PHASES.map((p) => (
          <div key={p.title} className={s.phase}>
            <p className={s.phaseWhen}>{p.when}</p>
            <p className={s.phaseTitle}>{p.title}</p>
            <p className={s.phaseText}>{p.text}</p>
            <div className={s.phasePic} aria-hidden>
              {p.pic}
            </div>
          </div>
        ))}
      </div>

      <div className={s.secHead}>
        <h2 className={s.secTitle}>How projects are judged</h2>
        <span className={s.secNote}>By the builders themselves, 1 to 5, in a few minutes after the deadline</span>
      </div>
      <div className={s.rubric}>
        {REVIEW_QUESTIONS.map((r) => (
          <div key={r.key} className={s.criterion}>
            <div className={s.critTop}>
              <span className={s.critName}>{r.label}</span>
              <span className={s.critScale}>1–5</span>
            </div>
            <p className={s.critQ}>{r.q}</p>
            <div className={s.pips} aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={s.pip} style={{ background: `rgba(245, 158, 11, ${0.12 + n * 0.12})` }} />
              ))}
            </div>
            <p className={s.critRange}>
              {r.low} → {r.high}
            </p>
          </div>
        ))}
        <div className={s.criterion}>
          <div className={s.critTop}>
            <span className={s.critName}>Favourite</span>
            <span className={s.critScale}>one pick</span>
          </div>
          <p className={s.critQ}>Which of the projects you reviewed did you like most?</p>
          <p className={s.critRange}>Picks decide the Crowd favourite</p>
        </div>
      </div>

      {!current && (
        <p className={s.closingLine}>The next Sprint will be announced here, with its dates, a countdown and a way to sign up.</p>
      )}
    </>
  );
}
