"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LogoMark from "@/components/LogoMark";
import Avatar from "@/components/Avatar";
import SidebarTierBadge from "@/components/SidebarTierBadge";
import { useNavDots, type NavKey } from "@/components/NotificationsProvider";
import { useTier } from "@/contexts/TierContext";

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

// Strict nav order. Profile and settings are intentionally absent — profile is
// reached via the avatar block at the bottom, settings from the profile page.
const NAV: NavItem[] = [
  { href: "/home", label: "home", glyph: "⌂" },
  { href: "/cohort", label: "cohort", glyph: "⬡", dotKey: "cohort" },
  { href: "/pulse", label: "pulse", glyph: "∿", dotKey: "pulse" },
  { href: "/collab", label: "collab_board", glyph: "⊞", dotKey: "collab" },
  { href: "/vault", label: "vault", glyph: "◫", dotKey: "vault" },
  { href: "/messages", label: "messages", glyph: "✉", dotKey: "messages" },
  { href: "/referrals", label: "referrals", glyph: "⇄", dotKey: "referrals" },
];

const EXPANDED_W = 240;
const COLLAPSED_W = 48;

// Below this the rail stops being a rail: it becomes an off-canvas drawer and
// the content reclaims the full width. Keep in sync with the --bp-rail
// breakpoint in globals.css.
const RAIL_MIN_W = 1024;

export default function Sidebar({
  currentUser,
}: {
  currentUser?: { full_name: string | null; stage: string | null; username: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { dots } = useNavDots();
  const { tier } = useTier();
  const [showHomeDot, setShowHomeDot] = useState(false);
  const [collapsedPref, setCollapsedPref] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Drawer mode (narrow viewports) and whether the drawer is currently open.
  const [drawer, setDrawer] = useState(false);
  const [open, setOpen] = useState(false);

  // Hydrate collapsed state from localStorage.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored === "1") setCollapsedPref(true);
    } catch {}
    setMounted(true);
  }, []);

  // Track drawer mode. Server always renders the desktop rail, so this settles
  // on mount like the collapsed preference does.
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${RAIL_MIN_W - 1}px)`);
    const sync = () => {
      setDrawer(mq.matches);
      if (!mq.matches) setOpen(false); // never strand the overlay on resize
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // TopBar's menu button lives in a different subtree, so it talks to the rail
  // over the window-event bus rather than through a provider.
  useEffect(() => {
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener("quorum:nav-toggle", onToggle);
    return () => window.removeEventListener("quorum:nav-toggle", onToggle);
  }, []);

  // A tap that navigates should also dismiss the drawer.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes the drawer, and an open drawer locks the page behind it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // In drawer mode the rail is always full-width — an icon-only drawer would be
  // a 48px panel floating over the page, which is nobody's idea of a menu.
  const collapsed = drawer ? false : collapsedPref;

  // Sync width into a CSS variable so the main content reflows. Drawer mode
  // overlays instead of displacing, so it contributes no width.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
      "--sidebar-w",
      drawer ? "0px" : `${collapsed ? COLLAPSED_W : EXPANDED_W}px`
    );
  }, [collapsed, drawer]);

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
    setCollapsedPref((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  const width = collapsed ? COLLAPSED_W : EXPANDED_W;

  return (
    <>
    {/* Scrim — only ever rendered in drawer mode */}
    <div
      className={`sidebar-scrim${open ? " open" : ""}`}
      onClick={() => setOpen(false)}
      aria-hidden
    />
    <aside
      className={`app-sidebar flex flex-col fixed left-0 top-0 h-screen${open ? " open" : ""}`}
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
        {drawer ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="sidebar-toggle"
            aria-label="close menu"
            title="close"
          >
            ✕
          </button>
        ) : (
          <button
            type="button"
            onClick={toggle}
            className="sidebar-toggle"
            aria-label={collapsed ? "expand sidebar" : "collapse sidebar"}
            title={collapsed ? "expand" : "collapse"}
          >
            {mounted && collapsed ? "›" : "‹"}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav
        className="pt-3 flex-1 overflow-y-auto scroll-thin relative"
        style={{ paddingLeft: collapsed ? 0 : 10, paddingRight: collapsed ? 0 : 10 }}
      >
        {NAV.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href));
          const hasUnseen =
            (item.href === "/home" && showHomeDot) ||
            (!!item.dotKey && dots[item.dotKey] && !active);
          return (
            <div key={item.href}>
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

      {/* Partner teaser — awareness of the coming tier. Hidden for users
          already on partner (nothing to tease). Full mini card when expanded;
          a single purple dot when collapsed. */}
      {tier === "partner" ? null : collapsed ? (
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

      {/* Current-user block — the only way into your own profile now that the
          nav item is gone. Whole block routes to /profile/me. Kept as the
          bottom-most element; the cohort roster was removed as clutter (the
          cohort page owns that job). */}
      <div
        onClick={() => router.push("/profile/me")}
        title="View your profile"
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") router.push("/profile/me");
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: collapsed ? 0 : 10,
          padding: collapsed ? "10px 0" : "10px 14px",
          borderTop: "1px solid var(--border-default)",
          cursor: "pointer",
        }}
      >
        <Avatar
          name={currentUser?.full_name ?? null}
          stage={currentUser?.stage ?? null}
          size={26}
        />
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <p
              className="font-mono lowercase truncate"
              style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.2 }}
            >
              {currentUser?.full_name?.toLowerCase() ?? "your profile"}
            </p>
            <p
              className="font-mono lowercase"
              style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.04em" }}
            >
              view profile →
            </p>
          </div>
        )}
      </div>

    </aside>
    </>
  );
}
