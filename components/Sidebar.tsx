"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoMark from "@/components/LogoMark";
import CohortPanel from "@/components/CohortPanel";
import SidebarTierBadge from "@/components/SidebarTierBadge";
import { useNavDots, type NavKey } from "@/components/NotificationsProvider";

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

type NavItem = { href: string; label: string; glyph: string; dotKey?: NavKey };

const NAV_MAIN: NavItem[] = [
  { href: "/home", label: "home", glyph: "⌂" },
  { href: "/cohort", label: "cohort", glyph: "⬡", dotKey: "cohort" },
  { href: "/messages", label: "messages", glyph: "✉", dotKey: "messages" },
  { href: "/pulse", label: "pulse", glyph: "∿", dotKey: "pulse" },
  { href: "/vault", label: "vault", glyph: "◫", dotKey: "vault" },
];

const NAV_WORKSPACE: NavItem[] = [
  { href: "/collab", label: "collab_board", glyph: "⊞", dotKey: "collab" },
  { href: "/referrals", label: "referrals", glyph: "⇄", dotKey: "referrals" },
  { href: "/profile/me", label: "profile", glyph: "◉" },
  { href: "/settings", label: "settings", glyph: "⚙", dotKey: "settings" },
];

const NAV: NavItem[] = [...NAV_MAIN, ...NAV_WORKSPACE];

const EXPANDED_W = 240;
const COLLAPSED_W = 48;

export default function Sidebar({
  cohort,
  currentUserId,
}: {
  cohort: { id: string; full_name: string | null; stage: string | null; username: string | null }[];
  currentUserId: string;
}) {
  const pathname = usePathname();
  const { dots } = useNavDots();
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
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-default)",
        transition: "width 0.25s ease",
        overflow: "hidden",
      }}
    >
      {/* Warm amber gradient bleeding down from the logo */}
      <div className="sidebar-warm-top" aria-hidden />

      {/* Logo area — logo always visible; toggle lives here so it's always in
          the same predictable spot (top of the rail) in both states */}
      <div
        className="flex items-center relative"
        style={{
          flexDirection: collapsed ? "column" : "row",
          gap: 10,
          padding: collapsed ? "16px 0 12px" : "18px 12px 18px 16px",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <LogoMark size={22} />
        {!collapsed && (
          <span
            className="font-sans tracking-tight lowercase flex-1"
            style={{
              color: "var(--text-primary)",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.5px",
              whiteSpace: "nowrap",
            }}
          >
            quorum
          </span>
        )}
        <button
          type="button"
          onClick={toggle}
          className="sidebar-toggle"
          aria-label={collapsed ? "expand sidebar" : "collapse sidebar"}
          title={collapsed ? "expand" : "collapse"}
        >
          {mounted && collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Nav */}
      <nav
        className="pt-3 flex-1 overflow-y-auto scroll-thin relative"
        style={{ paddingLeft: collapsed ? 0 : 10, paddingRight: collapsed ? 0 : 10 }}
      >
        {NAV.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href));
          const isFirstWorkspaceItem = item.href === NAV_WORKSPACE[0].href;
          const hasUnseen =
            (item.href === "/home" && showHomeDot) ||
            (!!item.dotKey && dots[item.dotKey] && !active);
          return (
            <div key={item.href}>
              {isFirstWorkspaceItem && !collapsed && (
                <p className="nav-section-label font-mono">workspace</p>
              )}
              {isFirstWorkspaceItem && collapsed && (
                <div
                  aria-hidden
                  style={{
                    height: 1,
                    background: "var(--border-default)",
                    margin: "10px 12px",
                  }}
                />
              )}
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`nav-item font-mono lowercase${active ? " active" : ""}`}
                style={{
                  fontSize: collapsed ? 14 : 12,
                  justifyContent: collapsed ? "center" : "flex-start",
                  padding: collapsed ? "8px 0" : undefined,
                  margin: collapsed ? "0 6px 3px" : undefined,
                }}
              >
                {collapsed ? (
                  <span
                    className="relative inline-flex items-center justify-center"
                    style={{ lineHeight: 1 }}
                    aria-hidden
                  >
                    {item.glyph}
                    {hasUnseen && (
                      <span
                        className="nav-unseen-dot"
                        style={{ position: "absolute", top: -3, right: -9, marginLeft: 0 }}
                        aria-label={`new in ${item.label}`}
                      />
                    )}
                  </span>
                ) : (
                  <>
                    <span className="nav-dot" />
                    <span>{item.label}</span>
                    {hasUnseen && (
                      <span className="nav-unseen-dot" aria-label={`new in ${item.label}`} />
                    )}
                  </>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Partner teaser — always-on awareness of the coming tier. Full mini card
          when expanded; a single purple dot when collapsed. */}
      {collapsed ? (
        <Link
          href="/pricing#partner"
          title="partner — coming soon"
          aria-label="partner — coming soon"
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "8px 0",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#a78bfa",
            }}
          />
        </Link>
      ) : (
        <Link
          href="/pricing#partner"
          style={{
            display: "block",
            margin: "8px 12px",
            padding: "8px 12px",
            background: "rgba(167,139,250,0.04)",
            borderRadius: 4,
            border: "1px solid rgba(167,139,250,0.1)",
            textDecoration: "none",
          }}
        >
          <p
            className="font-mono"
            style={{ fontSize: 8, color: "#a78bfa", marginBottom: 2, letterSpacing: "0.05em" }}
          >
            // partner
          </p>
          <p className="font-mono" style={{ fontSize: 8, color: "#484f58" }}>
            coming soon
          </p>
        </Link>
      )}

      <SidebarTierBadge collapsed={collapsed} />
      <CohortPanel members={cohort} currentUserId={currentUserId} collapsed={collapsed} />
    </aside>
  );
}
