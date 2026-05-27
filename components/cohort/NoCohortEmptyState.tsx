import Link from "next/link";

export default function NoCohortEmptyState() {
  return (
    <div
      className="flex items-center justify-center px-6"
      style={{ minHeight: "calc(100vh - 56px)" }}
    >
      <div className="max-w-lg text-center">
        <h1
          className="font-sans lowercase text-text-primary"
          style={{ fontSize: "2.25rem", lineHeight: 1.15 }}
        >
          you&apos;re not in a cohort yet.
        </h1>
        <p className="text-text-muted text-base mt-4 leading-relaxed">
          every founder on quorum has a private advisory board. yours is being
          set up.
        </p>
        <Link
          href="/cohort/browse"
          className="inline-flex items-center gap-2 font-mono lowercase mt-8 px-5 py-2.5"
          style={{
            background: "rgba(245, 158, 11, 0.22)",
            color: "#f59e0b",
            border: "1px solid rgba(245, 158, 11, 0.65)",
            borderRadius: 6,
            boxShadow:
              "0 0 14px rgba(245, 158, 11, 0.25), inset 0 0 10px rgba(245, 158, 11, 0.08)",
            fontWeight: 700,
            letterSpacing: "0.02em",
            fontSize: "0.85rem",
          }}
        >
          join a cohort →
        </Link>
      </div>
    </div>
  );
}
