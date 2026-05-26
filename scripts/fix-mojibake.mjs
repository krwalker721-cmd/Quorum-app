// Mojibake cleanup: UTF-8 mistakenly decoded as Windows-1252.
// Punctuation (em/en dash, ellipsis, quotes, dots, accents) → restored.
// Decorative symbols (arrows, checks, diamonds, triangles, cdots) → REMOVED.
//
// Critical ordering: 3-char patterns (â€X) run BEFORE 2-char (â€) so prefix
// matching doesn't strip the leading two bytes of a 3-byte mojibake.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".claude", ".git", "dist", "build", "out", "scripts",
]);
const EXT = new Set([".tsx", ".ts", ".jsx", ".js", ".css", ".md"]);

// PUNCTUATION — restore to proper Unicode. 3-char patterns first.
const REPLACE = [
  ["â€”", "—"],    // em dash
  ["â€“", "–"],    // en dash
  ["â€¢", "•"],    // bullet
  ["â€¦", "…"],    // ellipsis
  ["â€™", "'"],    // right single quote → apostrophe
  ["â€˜", "'"],    // left single quote → apostrophe
  ["â€œ", '"'],    // left double quote
  ["â€", '"'],     // bare right double quote — LAST so it doesn't gobble 3-char prefixes
  ["Â·", "·"],     // middle dot
  ["Â°", "°"],
  ["Â®", "®"],
  ["Â©", "©"],
  ["Ã—", "×"],
  ["Ã·", "÷"],
  ["Ã©", "é"],
  ["Ã¨", "è"],
  ["Ã ", "à"],
  ["Ã¢", "â"],
];

// DECORATIVE — strip "â<x><y>" runs by regex class. Matches all variants of
// arrows / checks / crosses / diamonds / triangles / operators that came
// from bytes 0xE2 0x86–0x97 followed by a 3rd byte.
const REMOVE_REGEX = [
  /â†./g,    // arrows: → ← ↑ ↓ ↳ etc
  /âœ./g,    // check, cross
  /â—./g,    // diamonds: ◈ ◇
  /â–./g,    // triangles & blocks: ▲ ▼ ▸ ▾ ▤
  /â‹./g,    // operators: ⋯
];

const TRAIL_FIX = [/[ \t]+$/gm];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP_DIRS.has(name)) continue;
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (EXT.has(extname(name))) out.push(p);
  }
  return out;
}

let changed = 0, scanned = 0;
for (const f of walk(ROOT)) {
  scanned++;
  const before = readFileSync(f, "utf8");
  let after = before;
  for (const [a, b] of REPLACE) after = after.split(a).join(b);
  for (const re of REMOVE_REGEX) after = after.replace(re, "");
  for (const re of TRAIL_FIX) after = after.replace(re, "");
  if (after !== before) {
    writeFileSync(f, after, "utf8");
    changed++;
    console.log("fixed:", f.replace(ROOT, "").replace(/\\/g, "/"));
  }
}
console.log(`\nscanned ${scanned} files, fixed ${changed}`);
