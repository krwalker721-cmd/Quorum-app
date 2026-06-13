"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePresence } from "@/components/PresenceProvider";

const COLLAPSED_KEY = "quorum-sidebar-collapsed";
const COORD_COUNT = 40;
const COORD_SPACING = 28;
const COORD_START_TOP = 120;

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function AppOverlay({ nodeCount }: { nodeCount: number }) {
  const pathname = usePathname();
  const online = usePresence();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    function read() {
      try {
        setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
      } catch {}
    }
    read();
    function onStorage(e: StorageEvent) {
      if (e.key === COLLAPSED_KEY) read();
    }
    window.addEventListener("storage", onStorage);
    // Poll a few times right after toggle to catch same-tab changes (storage
    // event only fires cross-tab). Cheap and reliable.
    const t = setInterval(read, 400);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, []);

  const sidebarW = collapsed ? 48 : 240;
  // Left coordinate strip sits flush against the right edge of the sidebar so
  // it only ever paints inside the main content area, never over the sidebar.
  const coordLeftX = sidebarW;

  // Friendly page name from the route.
  const seg = (pathname || "/").split("/").filter(Boolean)[0] || "home";
  const pageName = seg.replace(/_/g, " ").toLowerCase();

  const activeCount = online.size;

  const coordNumbers = Array.from({ length: COORD_COUNT }, (_, i) => i + 1);

  // Hide the left coord strip on routes whose main column hugs the sidebar
  // with a nested left panel (conversation list / room roster). The strip
  // would sit on top of that nested panel instead of in true negative space.
  const hideLeftStrip =
    pathname?.startsWith("/messages") || pathname?.startsWith("/cohort");

  return (
    <>
      {/* Left coordinate strip */}
      {!hideLeftStrip && (
      <div
        className="app-coord-strip"
        style={{
          position: "fixed",
          left: coordLeftX,
          top: 0,
          width: 18,
          height: "100vh",
          pointerEvents: "none",
          zIndex: 0,
          transition: "left 0.25s ease",
        }}
        aria-hidden="true"
      >
        {coordNumbers.map((n, i) => (
          <span
            key={n}
            style={{
              position: "absolute",
              top: COORD_START_TOP + i * COORD_SPACING,
              left: 0,
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
              fontSize: 7,
              color: "rgba(245, 158, 11, 0.2)",
              letterSpacing: "0.05em",
              lineHeight: 1,
            }}
          >
            {pad2(n)}
          </span>
        ))}
      </div>
      )}

      {/* Right coordinate strip */}
      <div
        className="app-coord-strip"
        style={{
          position: "fixed",
          left: "calc(100vw - 18px)",
          top: 0,
          width: 18,
          height: "100vh",
          pointerEvents: "none",
          zIndex: 0,
        }}
        aria-hidden="true"
      >
        {coordNumbers.map((n, i) => (
          <span
            key={n}
            style={{
              position: "absolute",
              top: COORD_START_TOP + i * COORD_SPACING,
              left: 0,
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
              fontSize: 7,
              color: "rgba(245, 158, 11, 0.12)",
              letterSpacing: "0.05em",
              lineHeight: 1,
            }}
          >
            {pad2(n)}
          </span>
        ))}
      </div>

      {/* Crosshair marker (vertical + horizontal half-pixel lines) */}
      <div
        className="app-crosshair"
        style={{
          position: "fixed",
          top: 64,
          left: sidebarW,
          width: 20,
          height: 20,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 10,
          transition: "left 0.25s ease",
        }}
        aria-hidden="true"
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: "0.5px",
            background: "rgba(245, 158, 11, 0.45)",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: "0.5px",
            background: "rgba(245, 158, 11, 0.45)",
          }}
        />
      </div>
      <div
        className="app-crosshair"
        style={{
          position: "fixed",
          top: 64,
          left: sidebarW,
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: "rgba(245, 158, 11, 0.5)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 11,
          transition: "left 0.25s ease",
        }}
        aria-hidden="true"
      />

      {/* Status bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 20,
          background: "rgba(13, 17, 23, 0.95)",
          borderTop: "1px solid #21262d",
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 18,
          zIndex: 50,
          pointerEvents: "none",
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
        }}
        aria-hidden="true"
      >
        <span
          style={{
            fontSize: 7,
            color: "rgba(245, 158, 11, 0.35)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          QUORUM_OS v1.0
        </span>
        <span
          style={{
            width: "0.5px",
            height: 10,
            background: "rgba(245, 158, 11, 0.15)",
          }}
        />
        <span
          style={{
            fontSize: 7,
            color: "rgba(245, 158, 11, 0.25)",
            letterSpacing: "0.08em",
          }}
        >
          {pageName}
        </span>
        <span
          style={{
            width: "0.5px",
            height: 10,
            background: "rgba(245, 158, 11, 0.15)",
          }}
        />
        <span style={{ fontSize: 7, color: "rgba(245, 158, 11, 0.2)" }}>
          {nodeCount} nodes
        </span>

        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="status-bar-active-dot" />
            <span style={{ fontSize: 7, color: "rgba(34, 197, 94, 0.5)" }}>
              {activeCount} active
            </span>
          </span>
          <span
            style={{
              width: "0.5px",
              height: 10,
              background: "rgba(245, 158, 11, 0.15)",
            }}
          />
          <span
            style={{
              fontSize: 7,
              color: "rgba(245, 158, 11, 0.25)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            SYS:NOMINAL
          </span>
        </span>
      </div>
    </>
  );
}
