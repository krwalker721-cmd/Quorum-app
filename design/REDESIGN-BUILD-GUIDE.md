# Quorum UI — Design Guide

> **Current state (2026-09-13):** every in-app page and dialog is in the **sleek finish**
> described in §2, carried over from the landing page (`components/landing/`). The page
> *structure* in §4 is the approved redesign from the mockup session (`design/mockups.html`);
> the mockups show the older terminal finish, so match their layout, not their styling.
> Build new screens from §2 and §3. Pricing and the auth pages (login, signup, pending)
> have not been converted.

---

## 1. Goal & principles

The app felt cluttered and disorganized. The redesign makes it feel like **a calm,
organized place to work**, and the sleek pass makes it feel like the same product as the
landing page.

Root problems that were diagnosed:
- The home page rendered ~17 components and **duplicated** other pages (its Feed = pulse,
  its CohortNetwork = cohort, its YourProjects = collab). Every feature existed twice.
- The terminal chrome (`SYS:NOMINAL`, mono labels on everything, rainbow accent colors)
  was applied at full intensity everywhere, so nothing had hierarchy.

The rules:
1. **Every page shares one skeleton** (sidebar + glass topbar + a centred content column),
   so the app reads as one tool.
2. **Boxed tiles give structure.** Open/divider-only layouts were explicitly rejected as
   "too much unstructured text / blurred together." Each section lives in its own tile.
3. **Color = meaning only.** Amber is the single primary accent; green means live/positive
   (active now, applied, joined). Everything else is neutral grayscale.
4. **Amber marks the one thing to do.** One amber hero tile per page (the check-in on home,
   the invite link on referrals, a vote that's waiting), the primary button, and the amber
   edge that lights on hover. Page titles use a white-to-grey gradient.
   *(This replaces the old "gradients sparingly" rule — confirmed with the owner as each
   page was approved.)*
5. **Readable, plain, and honest.** Body text is 14px; labels are sentence case; no
   mono uppercase kickers, breadcrumb, or terminal footer. **No invented numbers, people,
   or controls**: a stat must come from real data, and a switch must do something.
6. **Static, not animated.** Members use the app daily, so the landing page's constant
   motion (drifting glow, scrolling strips, reveal-on-scroll) stays out. The one allowed
   exception is the pulsing green **live dot**, shown only while something is actually live.

Home is a **launchpad that routes** to the page owning each job, not a mirror of everything.

---

## 2. The sleek finish

Source: `components/ui/sleek.module.css` (import as `ui`). Dialogs get the same finish from
the `modal-shell` classes in `app/globals.css` (see §3).

### Surfaces
- **`ui.tile`** — hairline border `rgba(255,255,255,.07)`, radius 12, faintly top-lit
  (`linear-gradient(180deg, rgba(255,255,255,.03), transparent 45%)` over `--bg-surface`).
  On hover: an amber border and a thin amber line along the top edge. Use for anything
  you *pick* (cards, rows, list items).
- **`ui.tileHero`** — the one amber tile per page:
  `linear-gradient(150deg, rgba(245,158,11,.16), rgba(245,158,11,.03) 60%)`, amber border,
  soft amber glow.
- **Panels you work inside** (a chat thread, a form, the notes editor) use the hairline
  without the hover edge: `border: 1px solid rgba(255,255,255,.07); border-radius: 12px`.
- **`<Tile kicker right>`** (`components/ui/Tile.tsx`) — a tile with a sentence-case label
  (`ui.label`, 13px) and an optional quiet link on the right.

### Page frame
- `<NoGrid />` — removes the background grid (it's painted on `body` and `.root-layout`).
- `<TopBar sleek title="…">` — glass topbar (translucent + blur), one sentence-case title,
  no breadcrumb. The topbar's `+ post` and `sign out` restyle only inside `.glass`.
- Content column: `className={\`page-pad ${ui.pageGlow}\`}`, `padding: 28px 32px 40px`,
  `maxWidth: 1280` (1080 for profile and settings), centred. `ui.pageGlow` is a faint,
  static amber glow at the top.
- Page header: `h1` with `ui.titleGradient`, 30px / 600 / `-0.025em`, then a 14px
  secondary line saying what the page is for. Main + rail grid:
  `grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4`.

### Type and color
- Font: Space Grotesk for everything you read. JetBrains Mono survives only in small
  identity details (avatar initials, the topbar's tier badge), not for labels or copy.
- Sizes: titles 30 (page) / 17–18 (card) / 15 (section); body 14; meta 12–13; chips 11.
- Colors: `--text-primary` for content, `--text-secondary` for supporting text,
  `--text-muted` for meta. Amber text on dark is `#f8c56a`. Green `#4ade80` / `#22c55e`
  for live/positive only. Error text `#f87171`.

### Controls
| Class | Use |
|---|---|
| `ui.primaryBtn` | The main action on a page or form (amber gradient + glow). |
| `ui.softBtn` | A card's main action (open project, message) — amber, quieter. |
| `ui.ghostBtn` | Secondary actions (cancel, load more, request to join). |
| `ui.textBtn` | Inline actions on a card (reply, share). |
| `ui.pill` / `<TabPill sleek>` | Tabs and filters, fully rounded, amber when active. |
| `ui.chip`, `ui.chipAmber` | Small labels (category, status, "In the vault"). |
| `ui.search` | Text inputs and textareas outside dialogs. |
| `ui.menu` / `ui.menuItem` | Dropdown menus (note actions, slash commands, tag picker). |
| `ui.liveDot` / `ui.quietDot` | Live indicator (green, pulsing) / idle (grey, still). |
| `ui.barTrack` / `ui.barFill` | Thin meters. |
| `ui.panel` / `ui.panelHead` | Slide-in side panels. |
| `ui.empty`, `ui.emptyTitle`, `ui.emptySub` | Empty states: plain sentences, no dashed box. |

Switches are real buttons (`role="switch"`, `aria-checked`). High contrast gets brighter
borders from the `[data-theme="high-contrast"]` rules in the module.

### Opt-in props on shared components
Shared components keep their classic look unless asked, so pages could convert one at a
time: `PostCard sleek`, `ReplyThread sleek`, `TabPill sleek`, `StagePill sleek`,
`TierPill sleek`, `HandshakeButton sleek`, `GradientButton glow`. Every in-app page now
passes them; components used by a single page were restyled directly.

---

## 3. Dialogs

Build every dialog from the `modal-shell` classes in `app/globals.css`:

```
<div className="modal-overlay fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
  <div role="dialog" aria-label="…" className="modal-shell w-full max-w-lg">
    <div className="modal-shell-head">
      <div><p className="modal-kicker">Section</p><h2 className="modal-title">Title</h2>
        <p className="modal-subtitle">One line of context.</p></div>
      <button className="modal-close-btn">Esc</button>
    </div>
    <div className="modal-shell-body">…</div>
    <div className="modal-shell-foot">
      <button className="btn-ghost">Cancel</button><button className="btn-primary">Do it</button>
    </div>
  </div>
</div>
```

Inside `.modal-shell`, `label`, inputs, `.btn-primary`, `.btn-ghost`, `.option-chip`, and
`.option-card` take the sleek finish automatically; outside it they're unchanged. Write the
copy in sentence case and show error messages as the server wrote them.

---

## 4. Page specs (structure)

Each page = sleek frame + a header (gradient title + a line of context + an optional
primary action) + tab pills where the page has tabs + a main/rail grid.

### HOME — the launchpad (~6 tiles)
Header `Good to see you, <name>` + context (day · members · trust score). **Needs you**
(rows linking to where the work happens), **Weekly check-in** (the amber hero, `Answer →`),
**Your cohort** (network constellation), **Recent in Pulse**, **Your work**. Nothing that
duplicates another page's job.

### PULSE — social feed
Composer pill at top; filter pills `All · Decisions · Blockers · Unanswered`; boxed posts
(avatar, name · stage · time, type chip, body, reply/share/bookmark). The real smart order
(active decision/blocker → peers → recent). Rail: In the room, Most helpful this week,
Trending tags. The header's "N active conversations" counts posts with a reply in the last
two hours.

### COHORT
Selection screen (multiple cohorts), room (roster, this week's check-ins, the discussion
floor with message bubbles, stats rail), browse/create/invite. Bubbles: yours amber-tinted
(`16px 16px 6px 16px`), theirs top-lit neutral.

### COLLAB BOARD
Tabs `Projects · Needs · Skills`, a quiet live line under the title (green dot only when
something happened in the last ten minutes). Project and need cards as tiles; the rail is
**Your projects** (first on phones). Skills: search + sort, skill tiles → a slide-in panel
of the founders who listed it. *(The mockup's "drill-down by category" is approximated by
grouping tiles under category labels.)*

### PROJECT ROOM
Back link, gradient title, status/category/started/looking-for line. Tabs
`Thread · Docs · Decisions`; bubbles match the cohort room. Rail: a vote waiting on you
(the amber hero), members, handshake, join requests (owner), recent activity, progress.

### MESSAGES
Two panes (inbox + thread), full height; on phones the inbox and thread swap with a back
button (global `msg-*` classes). Active conversation gets an amber bar.

### VAULT
Tabs `Library · Notes · Community wisdom`. Saved items with your "why I saved this" note;
a notes list + Tiptap editor (stacks on phones; toolbar and menus restyled inside
`ui.editor`); vaulted posts with an "In the vault" chip.

### REFERRALS
The invite link and copy button are the hero tile, with the unlock checklist inside it.
Then How it works, Your referrals, Milestones, and the monthly bonus.

### PROFILE
Header tile (avatar with stage ring, gradient name, stage/tier/handshake/vouched chips;
owner gets Settings, others get Vouch / Log handshake / Message). Tabs
`About · Posts · Handshakes`. About: Building / Trust score / Joined, then fingerprint
(legend rendered from the chart's own colours: decision amber, win green, blocker red,
question blue, update grey), skills, contributions; rail: mirror (owner only), cohorts,
billing (owner).

### SETTINGS
Sidebar-style section nav (a scrolling strip on phones), hairline form panels. Only
controls that do something: the notification list is the trial-reminder email alone
until other preferences are read somewhere.

---

## 5. Global do / don't
- DO reuse existing components and restyle them; the data-fetching already exists.
- DO keep one accent (amber) + green-for-live. DON'T reintroduce the rainbow.
- DO box each section. DON'T ship open divider-only lists.
- DON'T put more than ~6 sections on home, or duplicate a page's job there.
- DON'T add constant motion, mono uppercase kickers, or a terminal footer.
- DON'T show a number, person, or control that isn't real (no seeded activity, sample
  founders, or switches nothing reads).
- DO check every page at desktop width and at 375px, and read zoneless database
  timestamps with `parseDbTime()` (`lib/stage.ts`).

---

## 6. Reference files
- `mockups.html` — the approved layouts (older finish; match structure, not styling).
- `components/ui/sleek.module.css` — the finish.
- `components/landing/landing.module.css` — where the finish came from.
