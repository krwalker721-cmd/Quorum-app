// One-shot: in globals.css, replace hardcoded palette hex values with CSS var refs
// so the theme variables actually drive rendering. Functional accents (post-decision
// amber, status dots, semantic blue/green/red) are left as hex since their meaning
// is tied to the color, not the theme.
import { readFileSync, writeFileSync } from "node:fs";

const path = "app/globals.css";
let src = readFileSync(path, "utf8");

// Preserve the :root and [data-theme="..."] DEFINITIONS — we only want to rewrite
// the BODY of the rules below them. Split at the first occurrence of the dark/light
// var blocks ending.
const SPLIT_MARKER = "html, body, #__next, #root";
const idx = src.indexOf(SPLIT_MARKER);
if (idx === -1) { console.error("split marker not found"); process.exit(1); }

const head = src.slice(0, idx); // var definitions — DO NOT TOUCH
let tail = src.slice(idx);      // rules — rewrite hex to vars

// Map of palette hex → CSS var. Order matters: longer/more specific first.
const MAP = [
  // backgrounds
  ["#0d1117", "var(--bg-base)"],
  ["#161b22", "var(--bg-surface)"],
  ["#1c2128", "var(--bg-elevated)"],
  // borders
  ["#21262d", "var(--border-default)"],
  ["#30363d", "var(--border-muted)"],
  // text
  ["#e6edf3", "var(--text-primary)"],
  ["#8b949e", "var(--text-secondary)"],
  ["#6e7681", "var(--text-muted)"],
  ["#484f58", "var(--text-disabled)"],
];

// Apply replacements case-insensitively
for (const [hex, varRef] of MAP) {
  const re = new RegExp(hex.replace("#", "#"), "gi");
  tail = tail.replace(re, varRef);
}

writeFileSync(path, head + tail, "utf8");
console.log("globals.css rewritten — palette hex → CSS vars below line",
  src.slice(0, idx).split("\n").length);
