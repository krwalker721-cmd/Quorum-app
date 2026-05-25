"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoMark from "@/components/LogoMark";
import CohortPanel from "@/components/CohortPanel";

const VIEWED_KEY = "last_summary_viewed_week";
const DISMISS_KEY_PREFIX = "dismissed_weekly_summary:";
const COLLAPSED_KEY = "quorum-sidebar-collapsed";

function currentWeekKey() {
  const now = new Date();
  const day = now.getDay();
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  return monday.toISOString().slice(0, 10);
}

function computeHomeDot(): boolean {
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

const EXPANDED_W = 188;
const COLLAPSED_W = 48;

export default function Sidebar({
  cohort,
  currentUserId,
}: {
  cohort: { id: string; full_name: string | null; stage: string | null; username: string | null }[];
  currentUserId: string;
}) {
  const pathname = usePathname();
  const [showHomeDot, setShowHomeDot] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydrate collapsed state from localStorage.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {}
    setMounted(true);
  }, []);

  // Sync width into a CSS variable so the main content reflows.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
      "--sidebar-w",
      `${collapsed ? COLLAPSED_W : EXPANDED_W}px`
    );
  }, [collapsed]);

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

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  const width = collapsed ? COLLAPSED_W : EXPANDED_W;

  return (
    <aside
      className="flex flex-col fixed left-0 top-0 h-screen"
      style={{
        width,
        background: "rgba(3, 2, 1, 0.97)",
        borderRight: "0.5px solid rgba(232, 112, 42, 0.1)",
        transition: "width 0.25s ease",
        overflow: "hidden",
      }}
    >
      {/* Logo area */}
      <div
        className="flex items-center px-3 py-5"
        style={{
          gap: 8,
          justifyContent: collapsed ? "center" : "flex-start",
          borderBottom: "0.5px solid rgba(232,112,42,0.08)",
        }}
      >
        <LogoMark size={22} />
        <span
          className="font-sans tracking-tight lowercase sidebar-fade"
          style={{
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.5px",
            opacity: collapsed ? 0 : 1,
            pointerEvents: collapsed ? "none" : "auto",
            whiteSpace: "nowrap",
          }}
        >
          quorum
        </span>
      </div>

      {/* Nav */}
      <nav
        className="pt-2 flex-1 overflow-y-auto scroll-thin"
        style={{ paddingLeft: collapsed ? 0 : 8, paddingRight: collapsed ? 0 : 8 }}
      >
        {NAV.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href));
          const firstLetter = item.label.charAt(0);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className="block font-mono lowercase transition-colors"
              style={{
                fontSize: collapsed ? 11 : 10,
                letterSpacing: "0.03em",
                color: active ? "#ffffff" : "#555555",
                background: active ? "rgba(232,112,42,0.05)" : "transparent",
                borderRight: active ? "2px solid #e8702a" : "2px solid transparent",
                padding: collapsed ? "10px 0" : "8px 12px",
                marginBottom: 2,
                textAlign: collapsed ? "center" : "left",
              }}
            >
              {collapsed ? (
                firstLetter
              ) : (
                <>
                  {item.label}
                  {item.href === "/home" && showHomeDot && (
                    <span className="nav-unseen-dot" aria-label="weekly summary available" />
                  )}
                </>
              )}
            </Link>
          );
        })}

        {/* Collapse toggle */}
        <div className="flex justify-center mt-3 mb-2" style={{ paddingInline: collapsed ? 0 : 8 }}>
          <button
            type="button"
            onClick={toggle}
            className="sidebar-toggle"
            aria-label={collapsed ? "expand sidebar" : "collapse sidebar"}
            title={collapsed ? "expand" : "collapse"}
          >
            {mounted ? (collapsed ? "→" : "←") : "←"}
          </button>
        </div>
      </nav>

      <CohortPanel members={cohort} currentUserId={currentUserId} collapsed={collapsed} />
    </aside>
  );
}
