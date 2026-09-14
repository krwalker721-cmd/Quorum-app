import Link from "next/link";
import ui from "@/components/ui/sleek.module.css";

export default function NoCohortEmptyState() {
  return (
    <div className={`flex items-center justify-center px-6 app-pane-min ${ui.pageGlow}`}>
      <div className="max-w-lg text-center">
        <h1
          className={`${ui.titleGradient} ${ui.balance}`}
          style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.15 }}
        >
          You&apos;re not in a cohort yet.
        </h1>
        <p className="text-text-secondary mt-4 leading-relaxed" style={{ fontSize: 16 }}>
          Every founder on Quorum has a private advisory board. Yours is being set up.
        </p>
        <Link
          href="/cohort/browse"
          className={ui.primaryBtn}
          style={{ display: "inline-block", marginTop: 32, fontSize: 14, padding: "11px 20px" }}
        >
          Join a cohort →
        </Link>
      </div>
    </div>
  );
}
