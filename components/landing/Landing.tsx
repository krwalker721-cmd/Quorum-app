import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import LegalLinks from "@/components/LegalLinks";
import GrowthStat from "@/components/landing/GrowthStat";
import CohortRing from "@/components/landing/CohortRing";
import Reveal from "@/components/landing/Reveal";
import { FAQ_ITEMS, PRODUCT_BLOCKS } from "@/lib/marketing-copy";
import { FOUNDING_SEATS, PRICING, TRIAL_DAYS } from "@/lib/pricing";
import { foundingSeatsRemaining } from "@/lib/plans";
import s from "./landing.module.css";

// The public front door: what signed-out visitors see at "/". Signed-in
// members never see it; app/page.tsx routes them on as before.
//
// Server-rendered. The only client pieces are the scroll reveals and the
// growth-stat animation, both of which render finished without JavaScript;
// the FAQ uses native <details>. Motion lives in landing.module.css and stops
// under prefers-reduced-motion.

const PAGE_BG = "#0b0e13";
const SOLID_BUTTON = "linear-gradient(135deg, rgba(245,158,11,.95), rgba(245,158,11,.75))";
const BUTTON_GLOW =
  "0 0 0 1px rgba(245,158,11,.45), 0 10px 30px -10px rgba(245,158,11,.6), inset 0 1px 0 rgba(255,255,255,.25)";

// The three-part promise from the retired onboarding's manifesto chapter.
const PROMISE = ["Find your people", "Get real advice", "Build together"];

// What founders bring to a cohort. Topics only: no invented people or results.
const TOPICS = [
  "pricing",
  "your first hire",
  "fundraising",
  "churn",
  "co-founder conflict",
  "go-to-market",
  "burnout",
  "your first ten customers",
  "raise or bootstrap",
  "product-market fit",
  "runway",
  "saying no",
];

const STEPS = [
  {
    title: "Apply",
    desc: "Tell us what you're building. Quorum admits founders in groups of twelve, so every cohort starts together.",
  },
  {
    title: "Join your cohort",
    desc: "Twelve founders, one private room. The same people every week, so trust has time to build.",
  },
  {
    title: "Show up weekly",
    desc: "Check in on what you shipped, what's stuck, and what's next. Your cohort holds you to it.",
  },
];

const LANDING_FAQ = new Set([
  "Why isn't there a free plan?",
  "What happens when my trial ends?",
  "How do referrals work?",
  "Can I cancel anytime?",
]);

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono uppercase text-[0.65rem] tracking-[0.16em] text-amber mb-5">{children}</p>
  );
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="text-center">
      <Kicker>{kicker}</Kicker>
      <h2
        className={`font-sans text-3xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.1] max-w-3xl mx-auto ${s.gradientText}`}
      >
        {title}
      </h2>
    </div>
  );
}

function PrimaryCta({ label, small = false }: { label: string; small?: boolean }) {
  return (
    <Link
      href="/signup"
      className={`inline-block rounded-lg font-medium transition-[filter,transform] hover:brightness-110 active:translate-y-px ${
        small ? "px-3.5 py-1.5 text-xs" : "px-5 py-3 text-sm"
      }`}
      style={{ background: SOLID_BUTTON, color: "#1a1204", boxShadow: BUTTON_GLOW }}
    >
      {label} →
    </Link>
  );
}

function SeatBadge({ remaining }: { remaining: number }) {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[0.7rem] text-text-secondary backdrop-blur">
      <span className={`relative inline-block h-1.5 w-1.5 rounded-full bg-green ${s.pulseDot}`} aria-hidden />
      {remaining > 0
        ? `${remaining} of ${FOUNDING_SEATS} founding seats left · $${PRICING.founding.monthly}/mo for life`
        : `founding seats are gone · membership is $${PRICING.member.monthly}/mo`}
    </div>
  );
}

export default async function Landing({ waitlistOn }: { waitlistOn: boolean }) {
  const remaining = await foundingSeatsRemaining();
  const ctaLabel = waitlistOn ? "Request an invite" : "Start your free trial";
  const faq = FAQ_ITEMS.filter((f) => LANDING_FAQ.has(f.q));

  return (
    <div className="min-h-screen" style={{ background: PAGE_BG }}>
      {/* Pinned, see-through header. */}
      <header
        className="sticky top-0 z-40 border-b border-white/[0.06] backdrop-blur-md"
        style={{ background: "rgba(11,14,19,.72)" }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={24} />
            <span className="font-mono lowercase text-text-primary text-sm tracking-wide">quorum</span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link href="/pricing" className="font-mono lowercase text-xs text-text-secondary hover:text-text-primary transition-colors">
              pricing
            </Link>
            <Link href="/login" className="font-mono lowercase text-xs text-text-secondary hover:text-text-primary transition-colors">
              log in
            </Link>
            <span className="hidden sm:inline-block">
              <PrimaryCta label={ctaLabel} small />
            </span>
          </nav>
        </div>
      </header>

      {/* Hero: full-width, glow and fading grid behind it. */}
      <section className="relative overflow-hidden">
        <div aria-hidden className={s.aurora} />
        <div aria-hidden className={s.gridFade} />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 grid gap-14 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <SeatBadge remaining={remaining} />
            <h1 className="mt-7 font-sans text-5xl sm:text-7xl font-semibold leading-[1.02] tracking-[-0.035em]">
              <span className={s.gradientText}>The </span>
              <span className={s.amberText}>honest</span>
              <span className={s.gradientText}> version of LinkedIn.</span>
            </h1>
            <p className="mt-7 text-lg sm:text-xl text-text-secondary max-w-xl leading-relaxed">
              A private network of founders sharing real decisions, wins, and blockers, anchored by a
              cohort of twelve you meet every week.
            </p>
            <p className="mt-3 text-sm text-text-muted max-w-xl leading-relaxed">
              For founders at any stage, built especially for the early years, when the right room
              matters most.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <PrimaryCta label={ctaLabel} />
              <Link
                href="/pricing"
                className="inline-block rounded-lg px-5 py-3 text-sm text-text-primary border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] transition-colors"
              >
                See pricing
              </Link>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <CohortRing />
          </div>
        </div>
      </section>

      {/* The topic strip. */}
      <section aria-label="Topics founders bring to a cohort" className="border-y border-white/[0.06] py-7">
        <p className="text-center font-mono uppercase text-[0.65rem] tracking-[0.16em] text-text-muted mb-5">
          {"// bring the hard questions"}
        </p>
        <div className={s.marquee}>
          <div className={s.marqueeTrack}>
            {[...TOPICS, ...TOPICS].map((t, i) => (
              <span
                key={i}
                aria-hidden={i >= TOPICS.length || undefined}
                className="mr-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 font-mono text-xs text-text-secondary whitespace-nowrap"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-6 py-24 sm:py-32 space-y-28 sm:space-y-36">
        {/* Why Quorum: the case that used to open onboarding, in its order:
            the question, the proof, then the difference. */}
        <Reveal>
          <section className="text-center max-w-4xl mx-auto">
            <Kicker>{"// why quorum"}</Kicker>
            <p
              className={`font-sans text-3xl sm:text-5xl font-semibold leading-[1.15] tracking-[-0.025em] ${s.gradientText}`}
            >
              Have you ever wanted a room full of founders who have the same mindset as you — and
              have already solved the problems you&rsquo;re about to face?
            </p>
          </section>
        </Reveal>

        {/* Attributed to Vistage because it's their claim, about their CEO peer
            groups: no independent study behind a founder-wide number was found
            (LAUNCH.md, Phase 4). */}
        <Reveal>
          <GrowthStat />
        </Reveal>

        <Reveal>
          <section className="text-center">
            <Kicker>{"// the difference"}</Kicker>
            <h2
              className={`font-sans text-3xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.1] max-w-3xl mx-auto ${s.gradientText}`}
            >
              This is what happens when founders stop figuring it out alone.
            </h2>
            <ul className="mt-9 flex flex-wrap justify-center gap-3">
              {PROMISE.map((p) => (
                <li
                  key={p}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-2 text-sm text-text-primary"
                >
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-text-secondary">
              You&rsquo;ll get there faster — with the right people around you.
            </p>
          </section>
        </Reveal>

        {/* How it works */}
        <section>
          <Reveal>
            <SectionHeading kicker="// how it works" title="Twelve founders. One room. Every week." />
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {STEPS.map((st, i) => (
              <Reveal key={st.title} delay={i * 120} className="h-full">
                <div className={`${s.card} p-7 h-full`}>
                  <p className="font-mono text-xs text-amber mb-5">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="text-text-primary font-medium text-lg mb-2">{st.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{st.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Inside Quorum */}
        <section>
          <Reveal>
            <SectionHeading kicker="// inside quorum" title="Everything happens in one place." />
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {PRODUCT_BLOCKS.map((b, i) => (
              <Reveal key={b.title} delay={(i % 2) * 120} className="h-full">
                <div className={`${s.card} p-7 h-full`}>
                  <h3 className="text-text-primary font-medium text-lg mb-2">{b.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section>
          <Reveal>
            <SectionHeading kicker="// pricing" title="Simple, honest pricing." />
          </Reveal>
          <div className={`mt-14 grid gap-4 max-w-4xl mx-auto ${remaining > 0 ? "sm:grid-cols-2" : ""}`}>
            {remaining > 0 && (
              <Reveal className="h-full">
                <div className={`${s.card} ${s.cardFeatured} p-8 h-full`}>
                  <p className="font-mono lowercase text-xs text-amber mb-4">founding rate</p>
                  <p className="text-text-primary">
                    <span className="text-5xl font-semibold tracking-tight">${PRICING.founding.monthly}</span>
                    <span className="text-text-secondary">/month</span>
                  </p>
                  <p className="mt-4 text-sm text-text-secondary leading-relaxed">
                    Locked for life for the first {FOUNDING_SEATS} members.{" "}
                    <span className="text-text-primary">{remaining} left.</span>
                  </p>
                </div>
              </Reveal>
            )}
            <Reveal delay={120} className="h-full">
              <div className={`${s.card} p-8 h-full`}>
                <p className="font-mono lowercase text-xs text-text-secondary mb-4">membership</p>
                <p className="text-text-primary">
                  <span className="text-5xl font-semibold tracking-tight">${PRICING.member.monthly}</span>
                  <span className="text-text-secondary">/month</span>
                </p>
                <p className="mt-4 text-sm text-text-secondary leading-relaxed">
                  Or ${PRICING.member.annual}/year, two months free.
                </p>
              </div>
            </Reveal>
          </div>
          <p className="mt-7 text-center text-sm text-text-secondary leading-relaxed">
            Every membership starts with a {TRIAL_DAYS.standard}-day free trial ({TRIAL_DAYS.referred}{" "}
            days if a member refers you). No card needed to start.{" "}
            <Link href="/pricing" className="text-amber hover:underline">
              Full pricing →
            </Link>
          </p>
        </section>

        {/* FAQ */}
        <section>
          <Reveal>
            <SectionHeading kicker="// questions" title="Questions, answered." />
          </Reveal>
          <div className="mt-14 space-y-3 max-w-3xl mx-auto">
            {faq.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-white/[0.07] bg-white/[0.02] px-6 py-5 transition-colors open:border-white/[0.12] hover:border-white/[0.12]"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-text-primary font-medium">
                  {f.q}
                  <span
                    className="font-mono text-text-muted transition-transform duration-200 group-open:rotate-45"
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-text-secondary leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <Reveal>
          <section
            className="relative overflow-hidden rounded-2xl border border-white/[0.07] px-8 py-20 sm:py-24 text-center"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,0))" }}
          >
            <div aria-hidden className={s.aurora} style={{ opacity: 0.75 }} />
            <div className="relative">
              <Kicker>{"// the next cohort"}</Kicker>
              <h2
                className={`font-sans text-3xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.1] ${s.gradientText}`}
              >
                Every cohort is twelve seats. Take one.
              </h2>
              <p className="mt-4 text-text-secondary">
                A room of founders who&rsquo;ve already been where you&rsquo;re going.
              </p>
              <div className="mt-9">
                <PrimaryCta label={ctaLabel} />
              </div>
              <p className="mt-6 font-mono lowercase text-xs text-text-muted">
                already a member?{" "}
                <Link href="/login" className="text-amber hover:underline">
                  log in
                </Link>
              </p>
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="border-t border-white/[0.06] py-10">
        <LegalLinks />
        <p className="font-mono lowercase text-[0.65rem] text-text-faint text-center mt-3">
          quorum · a private network for founders
        </p>
      </footer>
    </div>
  );
}
