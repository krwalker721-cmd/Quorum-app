"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoMark from "@/components/LogoMark";
import CohortPanel from "@/components/CohortPanel";

const NAV = [
  { href: "/home", label: "home" },
  { href: "/cohort", label: "cohort" },
  { href: "/messages", label: "messages" },
  { href: "/pulse", label: "pulse" },
  { href: "/vault", label: "vault" },
  { href: "/collab_board", label: "collab_board" },
  { href: "/referrals", label: "referrals" },
];

export default function Sidebar({
  cohort,
  currentUserId,
}: {
  cohort: { id: string; full_name: string | null; stage: string | null; username: string | null }[];
  currentUserId: string;
}) {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col fixed left-0 top-0 h-screen border-r"
      style={{ width: 192, background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2 px-4 py-5">
        <LogoMark size={22} />
        <span className="font-sans tracking-tight text-text-primary text-base lowercase">quorum</span>
      </div>

      <nav className="px-2 pt-2 flex-1 overflow-y-auto scroll-thin">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="block font-mono lowercase text-xs px-3 py-2 mb-0.5 transition-colors"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-faint)",
                background: active ? "rgba(245,158,11,0.06)" : "transparent",
                borderRight: active ? "2px solid #f59e0b" : "2px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <CohortPanel members={cohort} currentUserId={currentUserId} />
    </aside>
  );
}
