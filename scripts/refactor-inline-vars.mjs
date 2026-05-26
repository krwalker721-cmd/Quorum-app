// Rewrite hardcoded palette hex in component inline styles to CSS var refs,
// so they respect the theme toggle. Only touches the 5 dark-palette greys
// and only inside obvious style contexts (single/double-quoted strings).
import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "components/Sidebar.tsx",
  "components/TopBar.tsx",
  "components/CohortPanel.tsx",
  "components/cohort/CohortRoomClient.tsx",
  "components/messages/MessagesClient.tsx",
  "components/AppOverlay.tsx",
  "app/admin/sections/Overview.tsx",
  "app/admin/sections/PlatformHealth.tsx",
];

const MAP = [
  ["#0d1117", "var(--bg-base)"],
  ["#161b22", "var(--bg-surface)"],
  ["#1c2128", "var(--bg-elevated)"],
  ["#21262d", "var(--border-default)"],
  ["#30363d", "var(--border-muted)"],
];

let totalChanged = 0;
for (const f of FILES) {
  let src;
  try { src = readFileSync(f, "utf8"); }
  catch { console.log("skip (missing):", f); continue; }
  let after = src;
  for (const [hex, varRef] of MAP) {
    // Match the hex when it appears inside a string literal (single or double quoted)
    const re = new RegExp(`(["'])${hex}\\1`, "gi");
    after = after.replace(re, `"${varRef}"`);
  }
  if (after !== src) {
    writeFileSync(f, after, "utf8");
    totalChanged++;
    console.log("rewrote:", f);
  }
}
console.log(`\n${totalChanged} files updated`);
