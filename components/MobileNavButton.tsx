"use client";

// The hamburger that opens the nav drawer on narrow viewports. TopBar is a
// server component and the rail lives in a sibling subtree, so the two talk
// over the window-event bus (same idiom as lib/tour-bus.ts).
export default function MobileNavButton() {
  return (
    <button
      type="button"
      className="mobile-nav-btn"
      aria-label="open menu"
      onClick={() => window.dispatchEvent(new Event("quorum:nav-toggle"))}
    >
      <span aria-hidden />
      <span aria-hidden />
      <span aria-hidden />
    </button>
  );
}
