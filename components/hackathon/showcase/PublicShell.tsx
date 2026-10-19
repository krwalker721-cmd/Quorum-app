import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import NoGrid from "@/components/ui/NoGrid";

// The frame for the public showcase pages (Phase 10): the landing page's
// translucent header and glow, held still (the app's finish is static).
// Signed out, it carries Quorum's call to action; members get their way back
// into the app instead.

const PAGE_BG = "#0b0e13";
const SOLID_BUTTON = "linear-gradient(135deg, rgba(245,158,11,.95), rgba(245,158,11,.75))";
const BUTTON_GLOW = "0 0 0 1px rgba(245,158,11,.35), 0 8px 30px -8px rgba(245,158,11,.55)";

export function JoinCta({ label = "Join Quorum", small = false }: { label?: string; small?: boolean }) {
  return (
    <Link
      href="/"
      className={`inline-block rounded-lg font-medium transition-[filter,transform] hover:brightness-110 active:translate-y-px ${
        small ? "px-3.5 py-1.5 text-xs" : "px-5 py-3 text-sm"
      }`}
      style={{ background: SOLID_BUTTON, color: "#1a1204", boxShadow: BUTTON_GLOW, textDecoration: "none" }}
    >
      {label} →
    </Link>
  );
}

/** "Built in 48 hours at a Quorum Sprint. Want in on the next one?" */
export function SprintCta() {
  return (
    <section
      style={{
        marginTop: 48,
        borderRadius: 18,
        border: "1px solid rgba(245, 158, 11, 0.3)",
        padding: "28px 24px",
        textAlign: "center",
        background: "radial-gradient(90% 120% at 50% 0%, rgba(245,158,11,0.16), rgba(245,158,11,0) 70%), #11151c",
      }}
    >
      <p style={{ fontSize: 22, fontWeight: 650, letterSpacing: "-0.02em", color: "var(--text-primary)", textWrap: "balance" }}>
        Built in 48 hours at a Quorum Buildathon.
      </p>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 6, textWrap: "balance" }}>
        Quorum is a private network of founders. At every Buildathon, members team up across cohorts and turn a business idea into
        something real in 48 hours. Want in on the next one?
      </p>
      <div style={{ marginTop: 18 }}>
        <JoinCta label="See Quorum" />
      </div>
    </section>
  );
}

export default function PublicShell({
  signedIn,
  back,
  children,
}: {
  signedIn: boolean;
  /** Members' way back into the app, e.g. the Sprint page. */
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: PAGE_BG }}>
      <NoGrid />
      <header className="sticky top-0 z-40 border-b border-white/[0.06] backdrop-blur-md" style={{ background: "rgba(11,14,19,.72)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href={signedIn ? "/home" : "/"} className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
            <LogoMark size={24} />
            <span className="font-mono lowercase text-text-primary text-sm tracking-wide">quorum</span>
          </Link>
          <nav className="flex items-center gap-4">
            {signedIn ? (
              back && (
                <Link href={back.href} className="text-xs text-text-secondary hover:text-text-primary transition-colors" style={{ textDecoration: "none" }}>
                  {back.label}
                </Link>
              )
            ) : (
              <>
                <Link href="/login" className="font-mono lowercase text-xs text-text-secondary hover:text-text-primary transition-colors">
                  log in
                </Link>
                <JoinCta small />
              </>
            )}
          </nav>
        </div>
      </header>
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0"
          style={{
            top: -200,
            height: 700,
            background:
              "radial-gradient(520px 420px at 30% 30%, rgba(245,158,11,0.17), rgba(245,158,11,0) 70%), radial-gradient(420px 360px at 75% 45%, rgba(248,197,106,0.09), rgba(248,197,106,0) 70%)",
          }}
        />
        <main className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-16">{children}</main>
      </div>
    </div>
  );
}
