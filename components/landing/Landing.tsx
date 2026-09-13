import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import LegalLinks from "@/components/LegalLinks";
import { FAQ_ITEMS, PRODUCT_BLOCKS } from "@/lib/marketing-copy";
import { FOUNDING_SEATS, PRICING, TRIAL_DAYS } from "@/lib/pricing";
import { foundingSeatsRemaining } from "@/lib/plans";
import { WAITLIST_ENABLED } from "@/lib/flags";

// The public front door: what signed-out visitors see at "/". Signed-in
// members never see it; app/page.tsx routes them on as before.
//
// Server-rendered with no client JavaScript of its own (the FAQ uses native
// <details>), so the whole page reads even before, or without, hydration.

const HERO_BG = "linear-gradient(150deg, rgba(245,158,11,.16), rgba(245,158,11,.03) 60%)";
const SOLID_BUTTON = "linear-gradient(135deg, rgba(245,158,11,.92), rgba(245,158,11,.72))";

const CTA_LABEL = WAITLIST_ENABLED ? "Request an invite" : "Start your free trial";

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
  "Can I cancel anytime?",
]);

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono uppercase text-[0.65rem] tracking-[0.14em] text-amber mb-4">{children}</p>
  );
}

function PrimaryCta() {
  return (
    <Link
      href="/signup"
      className="inline-block rounded-lg px-5 py-3 text-sm font-medium transition-opacity hover:opacity-90"
      style={{ background: SOLID_BUTTON, color: "#1a1204" }}
    >
      {CTA_LABEL} →
    </Link>
  );
}

function SeatLine({ remaining }: { remaining: number }) {
  if (remaining <= 0) {
    return (
      <p className="mt-6 font-mono text-xs text-text-secondary">
        founding seats are gone. membership is ${PRICING.member.monthly}/month.
      </p>
    );
  }
  return (
    <p className="mt-6 font-mono text-xs text-text-secondary flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-green" aria-hidden />
      {remaining} of {FOUNDING_SEATS} founding seats left at ${PRICING.founding.monthly}/month, locked
      for life
    </p>
  );
}

export default async function Landing() {
  const remaining = await foundingSeatsRemaining();
  const faq = FAQ_ITEMS.filter((f) => LANDING_FAQ.has(f.q));

  return (
    <div className="min-h-screen">
      <header className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark size={26} />
          <span className="font-mono lowercase text-text-primary text-sm tracking-wide">quorum</span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link href="/pricing" className="font-mono lowercase text-xs text-text-secondary hover:text-amber">
            pricing
          </Link>
          <Link href="/login" className="font-mono lowercase text-xs text-text-secondary hover:text-amber">
            log in
          </Link>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-16 space-y-20">
        {/* Hero */}
        <section
          className="rounded-xl p-8 sm:p-12 mt-4"
          style={{ background: HERO_BG, border: "0.5px solid rgba(245,158,11,.3)" }}
        >
          <Kicker>{"// a private network for founders"}</Kicker>
          <h1 className="font-sans text-4xl sm:text-6xl font-semibold leading-[1.05] tracking-tight text-text-primary max-w-3xl">
            The <span style={{ color: "#f8c56a" }}>honest</span> version of LinkedIn.
          </h1>
          <p className="mt-6 text-lg text-text-secondary max-w-2xl leading-relaxed">
            A private network of founders sharing real decisions, wins, and blockers, anchored by a
            cohort of twelve you meet every week.
          </p>
          <p className="mt-3 text-sm text-text-muted max-w-2xl leading-relaxed">
            For founders at any stage, built especially for the early years, when the right room
            matters most.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <PrimaryCta />
            <Link
              href="/pricing"
              className="inline-block rounded-lg px-5 py-3 text-sm border border-border-muted text-text-primary hover:border-amber/50"
            >
              See pricing
            </Link>
          </div>
          <SeatLine remaining={remaining} />
        </section>

        {/* How it works */}
        <section>
          <Kicker>{"// how it works"}</Kicker>
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-xl bg-card border border-border p-6">
                <p className="font-mono text-xs text-amber mb-3">{String(i + 1).padStart(2, "0")}</p>
                <h2 className="text-text-primary font-medium mb-2">{s.title}</h2>
                <p className="text-sm text-text-secondary leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Inside Quorum */}
        <section>
          <Kicker>{"// inside quorum"}</Kicker>
          <div className="grid gap-4 sm:grid-cols-2">
            {PRODUCT_BLOCKS.map((b) => (
              <div key={b.title} className="rounded-xl bg-card border border-border p-6">
                <h2 className="text-text-primary font-medium mb-2">{b.title}</h2>
                <p className="text-sm text-text-secondary leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section>
          <Kicker>{"// pricing"}</Kicker>
          <div className={`grid gap-4 ${remaining > 0 ? "sm:grid-cols-2" : ""}`}>
            {remaining > 0 && (
              <div
                className="rounded-xl bg-card p-6"
                style={{ border: "1px solid rgba(245,158,11,.32)" }}
              >
                <p className="font-mono lowercase text-xs text-amber mb-3">founding rate</p>
                <p className="text-text-primary">
                  <span className="text-4xl font-semibold">${PRICING.founding.monthly}</span>
                  <span className="text-text-secondary">/month</span>
                </p>
                <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                  Locked for life for the first {FOUNDING_SEATS} members.{" "}
                  <span className="text-text-primary">{remaining} left.</span>
                </p>
              </div>
            )}
            <div className="rounded-xl bg-card border border-border p-6">
              <p className="font-mono lowercase text-xs text-text-secondary mb-3">membership</p>
              <p className="text-text-primary">
                <span className="text-4xl font-semibold">${PRICING.member.monthly}</span>
                <span className="text-text-secondary">/month</span>
              </p>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                Or ${PRICING.member.annual}/year, two months free.
              </p>
            </div>
          </div>
          <p className="mt-5 text-sm text-text-secondary leading-relaxed">
            Every membership starts with a {TRIAL_DAYS.standard}-day free trial ({TRIAL_DAYS.referred}{" "}
            days if a member refers you). No card needed to start.{" "}
            <Link href="/pricing" className="text-amber hover:underline">
              Full pricing →
            </Link>
          </p>
        </section>

        {/* FAQ */}
        <section>
          <Kicker>{"// questions"}</Kicker>
          <div className="space-y-3">
            {faq.map((f) => (
              <details key={f.q} className="group rounded-xl bg-card border border-border p-5">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-text-primary font-medium">
                  {f.q}
                  <span className="font-mono text-text-muted transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-text-secondary leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="rounded-xl bg-card border border-border p-8 sm:p-12 text-center">
          <Kicker>{"// the next cohort"}</Kicker>
          <h2 className="font-sans text-2xl sm:text-3xl font-semibold text-text-primary">
            Every cohort is twelve seats. Take one.
          </h2>
          <div className="mt-8">
            <PrimaryCta />
          </div>
          <p className="mt-5 font-mono lowercase text-xs text-text-muted">
            already a member?{" "}
            <Link href="/login" className="text-amber hover:underline">
              log in
            </Link>
          </p>
        </section>
      </main>

      <footer className="pb-10">
        <LegalLinks />
        <p className="font-mono lowercase text-[0.65rem] text-text-faint text-center mt-3">
          quorum · a private network for founders
        </p>
      </footer>
    </div>
  );
}
