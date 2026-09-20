import Link from "next/link";
import type { ReactNode } from "react";
import LogoMark from "@/components/LogoMark";
import s from "@/components/landing/landing.module.css";

// The shared frame for the 404 and error pages, in the landing page's finish:
// the dark ground, the amber glow, and the fading grid behind a centred card.
export default function StatusPage({
  code,
  title,
  body,
  actions,
}: {
  code: string;
  title: string;
  body: string;
  actions: ReactNode;
}) {
  return (
    <main
      className="relative min-h-screen overflow-hidden flex items-center justify-center px-6"
      style={{ background: "#0b0e13" }}
    >
      <div aria-hidden className={s.aurora} />
      <div aria-hidden className={s.gridFade} />
      <div className="relative max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <LogoMark size={24} />
          <span className="font-mono lowercase text-text-primary text-sm tracking-wide">quorum</span>
        </Link>
        <p className="mt-10 font-mono text-xs tracking-[0.16em] text-amber">{code}</p>
        <h1 className={`mt-3 font-sans text-4xl font-semibold tracking-[-0.03em] ${s.gradientText}`}>
          {title}
        </h1>
        <p className="mt-4 text-base text-text-secondary leading-relaxed">{body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      </div>
    </main>
  );
}

export const STATUS_PRIMARY =
  "inline-block rounded-lg px-5 py-3 text-sm font-medium text-[#1a1204] cursor-pointer";
export const STATUS_PRIMARY_STYLE = {
  background: "var(--btn-primary-bg)",
  boxShadow: "var(--btn-primary-shadow)",
  border: "none",
};
export const STATUS_SECONDARY =
  "inline-block rounded-lg px-5 py-3 text-sm text-text-primary border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] transition-colors";
