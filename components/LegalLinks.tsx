import Link from "next/link";

// terms · privacy · refunds — the row every public page carries. Stripe's
// reviewers, and anyone deciding whether to pay, look for these on the live site.
export default function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="Legal"
      className={`font-mono text-[0.65rem] text-text-faint lowercase flex justify-center gap-3 ${className}`}
    >
      <Link href="/terms" className="hover:text-amber">terms</Link>
      <span aria-hidden>·</span>
      <Link href="/privacy" className="hover:text-amber">privacy</Link>
      <span aria-hidden>·</span>
      <Link href="/refunds" className="hover:text-amber">refunds</Link>
    </nav>
  );
}
