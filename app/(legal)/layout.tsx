import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import LegalLinks from "@/components/LegalLinks";
import { LEGAL } from "@/lib/legal";
import s from "./legal.module.css";

// Shared frame for /terms, /privacy and /refunds. Deliberately public: nothing
// here reads a session, so logged-out visitors — and Stripe's reviewers — can
// read every page.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-6 py-16" style={{ background: "var(--bg-base)" }}>
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <Link href="/" className="flex items-center gap-3 mb-12 w-fit">
          <LogoMark size={28} />
          <span className="font-mono lowercase text-text-primary text-sm tracking-wide">quorum</span>
        </Link>

        <article className={s.prose}>{children}</article>

        <div className="mt-16 pt-6" style={{ borderTop: "0.5px solid var(--border-default)" }}>
          <p className="font-mono text-[0.65rem] text-text-faint lowercase text-center mb-3">
            questions:{" "}
            <a href={`mailto:${LEGAL.contactEmail}`} className="hover:text-amber">
              {LEGAL.contactEmail}
            </a>
          </p>
          <LegalLinks />
        </div>
      </div>
    </main>
  );
}
