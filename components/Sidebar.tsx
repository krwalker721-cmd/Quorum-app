"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoMark from "@/components/LogoMark";
import CohortPanel from "@/components/CohortPanel";

const VIEWED_KEY = "last_summary_viewed_week";
const DISMISS_KEY_PREFIX = "dismissed_weekly_summary:";

function currentWeekKey() {
  const now = new Date();
  const day = now.getDay();
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  return monday.toISOString().slice(0, 10);
}

function computeHomeDot(): boolean {
  // Show after Sunday 8pm local through Tuesday end-of-day, as long as the
  // current week's summary hasn't been viewed or dismissed.
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const inWindow = (day === 0 && hour >= 20) || day === 1 || day === 2;
  if (!inWindow) return false;
  try {
    const weekKey = currentWeekKey();
    if (localStorage.getItem(VIEWED_KEY) === weekKey) return false;
    if (localStorage.getItem(DISMISS_KEY_PREFIX + weekKey) === "1") return false;
  } catch {
    return false;
  }
  return true;
}

const NAV = [
  { href: "/home", label: "home" },
  { href: "/cohort", label: "cohort" },
  { href: "/messages", label: "messages" },
  { href: "/pulse", label: "pulse" },
  { href: "/vault", label: "vault" },
  { href: "/collab", label: "collab_board" },
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
  const [showHomeDot, setShowHomeDot] = useState(false);

  useEffect(() => {
    const refresh = () => setShowHomeDot(computeHomeDot());
    refresh();
    const onView = () => setShowHomeDot(false);
    window.addEventListener("weekly-summary-viewed", onView);
    window.addEventListener("storage", refresh);
    const t = setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("weekly-summary-viewed", onView);
      window.removeEventListener("storage", refresh);
      clearInterval(t);
    };
  }, [pathname]);

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
              {item.href === "/home" && showHomeDot && (
                <span className="nav-unseen-dot" aria-label="weekly summary available" />
              )}
            </Link>
          );
        })}
      </nav>

      <CohortPanel members={cohort} currentUserId={currentUserId} />
    </aside>
  );
}
