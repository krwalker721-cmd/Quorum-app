"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/cohort", label: "dms" },
  { href: "/cohort/browse", label: "browse" },
  { href: "/cohort/create", label: "create" },
  { href: "/cohort/invite", label: "invite" },
];

export default function CohortNav() {
  const pathname = usePathname();
  return (
    <div
      className="flex items-center gap-1 px-6 py-2 border-b"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      {ITEMS.map((i) => {
        const active = pathname === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            className="font-mono lowercase text-[0.7rem] px-3 py-1.5 transition-colors"
            style={{
              color: active ? "#f59e0b" : "var(--text-muted)",
              borderBottom: active ? "2px solid #f59e0b" : "2px solid transparent",
            }}
          >
            {i.label}
          </Link>
        );
      })}
    </div>
  );
}
