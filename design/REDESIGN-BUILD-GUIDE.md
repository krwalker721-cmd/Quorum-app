# Quorum UI Redesign — Build Handoff

> **For a fresh building session:** read this whole doc, open `design/mockups.html` in a
> browser for the pixel-accurate reference, then build page by page in the order in §7.
> The prose design memory also lives at
> `.claude/.../memory/ui-redesign-direction.md` and loads automatically.
> Everything below was designed and approved with the user across a full mockup session.

---

## 1. Goal & principles

The app felt cluttered and disorganized. The redesign makes it feel like **a calm,
organized place to work** while keeping Quorum's terminal/OS identity **as an accent, not
as the whole skin**.

Root problems that were diagnosed:
- The home page rendered ~17 components and **duplicated** other pages (its Feed = pulse,
  its CohortNetwork = cohort, its YourProjects = collab). Every feature existed twice.
- The terminal chrome (`SYS:NOMINAL`, mono labels on everything, rainbow accent colors)
  was applied at full intensity everywhere, so nothing had hierarchy.

The five rules that fix it:
1. **Every page shares one skeleton** (sidebar + topbar + content), so the app reads as one tool.
2. **Boxed tiles give structure.** Open/divider-only layouts were explicitly rejected as
   "too much unstructured text / blurred together." Each section lives in its own surface tile.
3. **Color = meaning only.** Amber is the single primary accent; green means live/positive
   (active now, applied, joined). Everything else is neutral grayscale. Too many hues at
   once was the #1 cause of "too much going on."
4. **Gradients are the pop.** Warm amber gradients mark the hero moment on each page
   (check-in, the `+ post`/`+ new` button, "matches your need" CTAs). Used sparingly.
   This intentionally relaxes the old "amber restraint" rule from the design system.
5. **Terminal as seasoning:** mono uppercase micro-kickers on section headers, a
   `QUORUM_OS V1.0 / SYS:NOMINAL` footer, mono metadata lines. Content is the loudest thing.

Home becomes a **launchpad that routes** to the page owning each job, not a mirror of everything.

---

## 2. Design tokens (exact values, from `app/globals.css`)

Use the existing CSS variables — do NOT hardcode. These are the real values for reference:

```
--bg-base:      #0d1117   (page)
--bg-surface:   #161b22   (tiles, sidebar, topbar)
--bg-elevated:  #1c2128   (avatars, inner chips, nested)
--border-default:#21262d  (hairlines, tile borders)
--border-muted: #30363d   (chip borders, buttons)
--text-primary: #e6edf3
--text-secondary:#8b949e   (metadata)
--text-muted:   #6e7681
faint kicker:   #484f58
--accent (amber):#f59e0b   (gradient text often #f8c56a for contrast)
--green:        #22c55e   (live / positive only)
--blue:         #58a6ff   (links)
--purple:       #a78bfa   (messages dot, tier)
--teal:         #38bdf8   (matches / sparkle)
```

Radii: chips 6px, buttons/inputs 8–10px, cards 11–12px, pills 12–24px.
Fonts: `--font-sans` for content, `--font-mono` (JetBrains Mono) for kickers/metadata/labels.

### Signature gradients
- Amber hero tile bg: `linear-gradient(150deg, rgba(245,158,11,.16), rgba(245,158,11,.03) 60%)`
  with border `0.5px solid rgba(245,158,11,.3)`.
- Amber solid button: `linear-gradient(135deg, rgba(245,158,11,.92), rgba(245,158,11,.72))`,
  text `#1a1204`, weight 500.
- Amber ghost/`+ post` button: `linear-gradient(135deg, rgba(245,158,11,.2), rgba(245,158,11,.06))`,
  border `rgba(245,158,11,.32)`, text `#f8c56a`.
- Gradient icon tiles (needs-you list, home): per-meaning tint, e.g. purple
  `linear-gradient(135deg, rgba(167,139,250,.28), rgba(167,139,250,.06))` with matching light icon.

---

## 3. The shared shell (build these FIRST as reusable components)

All eight pages are the same frame. Extract these so every page stays consistent for free.

### `AppShell` (wraps every page)
- 240px fixed sidebar (collapsible to 48px — the real `Sidebar.tsx` already does this; keep
  `EXPANDED_W`/`AppOverlay`/`--sidebar-w` in sync per the design-system memory).
- Sidebar: logo (amber gradient mark + "quorum"), nav list, partner teaser, user block →
  `/profile/me`. Nav order is unchanged: home, cohort, pulse, collab_board, vault, messages,
  referrals. Active item = amber dot + `rgba(245,158,11,.08)` bg. Unseen = colored dot
  (real `useNavDots` system).
- Content column: `TopBar` on top, page content below, terminal footer at the bottom.

### `TopBar`
- Left: mono breadcrumb `QUORUM / <PAGE>` (faint) + page title.
- Right: PARTNER tier pill, theme toggle circle, `+ post`/action (gradient ghost), sign out.
  (Existing `components/TopBar.tsx` — restyle, don't rebuild from scratch.)

### `Tile` — the workhorse
`background:#161b22; border:0.5px solid #21262d; border-radius:12px; padding:14–18px`.
Optional `MonoKicker` header (see below) + optional right-aligned link (`all →`, `board →`).

### `MonoKicker`
`font-mono; font-size:9–10px; letter-spacing:.12–.14em; color:#484f58 (on bg) / #6e7681 (in tile); text-transform:uppercase`.

### `GradientButton` (primary) / `GhostButton` / `TabPill`
- TabPill row: active = amber ghost fill; inactive = `border:0.5px solid #21262d; color:#8b949e`.

### `TerminalFooter`
`display:flex; justify-content:space-between; font-mono; font-size:9px; color:#30363d;
border-top:0.5px solid #161b22`. Left `QUORUM_OS V1.0`, right `SYS:NOMINAL`.

### `PersonAvatar`
Circle `#1c2128`, initials, `font-mono`. Optional **stage-colored ring** (identity, not noise):
idea=blue, pre-seed=amber, seed=green, series_a=purple. Optional green "active" dot bottom-right.

### `NetworkGraph` (small SVG)
Founder-graph constellation: you centered (amber ring), members around (neutral rings, or
stage-colored on profile), connecting lines `#21262d`, one green active dot. Reuse the idea
from the existing `CohortNetwork` viz.

---

## 4. Page specs

Each page = AppShell + TopBar + a header (title + mono context line + optional gradient
action) + tab pills (where the page has tabs) + a content grid. Standard content grid is
`grid-template-columns: minmax(0,1.6–1.7fr) minmax(0,1fr)` (main + rail), `gap:12–16px`.
See `design/mockups.html` for the exact, approved layout of each.

### HOME  (`app/(app)/home/page.tsx`)  — the big declutter
Kill the 17-component dump. Home is a launchpad of ~6 tiles:
- Header: `Good to see you, <name>` + mono context `TUE · 4 members · 1 active now · trust 31`.
- **NEEDS YOU** tile (wide): rows with gradient icon tiles — unread messages (purple),
  applicants (green), a matching need (teal) — each links to where the work happens.
- **WEEKLY CHECK-IN** — amber gradient hero tile with `answer →`.
- **YOUR COHORT** — NetworkGraph constellation + `1 active · 4/12`.
- **MATCHES YOUR NEEDS** — slim strip: small avatars of people whose skills match a need
  you posted → `browse skills →`. (Networking payoff on home.)
- **RECENT IN PULSE** — 2 posts preview → `all posts →`.
- **YOUR WORK** — your projects → `board →`.
Layout is bento (varied tile sizes). Move the old StatStrip/charts/usage/partner/feedback
widgets OFF home (to profile/pulse or delete).

### PULSE  (`app/(app)/pulse/page.tsx`)  — social feed
- Composer pill at top (`Share what you're working through…` + gradient `post`).
- Filter pills: `all · decisions · blockers · unanswered` (surfaces the real smart-order).
- **Feed = social posts, each in its own box** (tweet anatomy: avatar, name·stage·time,
  room-type pill [decision=amber, blocker=neutral], body, action bar reply/share/bookmark).
  The active decision floats to top with an amber-gradient tile + an **inline nested reply
  thread** (thread line, repliers, `view all N replies →`) for group-chat feel. `● 1 active now`.
- Rail tiles: IN THE ROOM (faces), MOST HELPFUL THIS WEEK, TRENDING TAGS.
- Preserve the real priority sort (active decision/blocker → peers → recent).

### COLLAB BOARD  (`app/(app)/collab/page.tsx`, Partner-gated)
Header + `+ new`; a `● LIVE` **PulseBar** activity ticker; tab pills `projects · needs · skills`.
- **projects tab:** project cards (category chip, `N interested`, title, author+stage, desc,
  `looking for:`, `request to join`). Rail = YOUR WORKSPACE (member avatars, `● vote due`
  amber when needs_vote, new-messages) + gradient "post a need" nudge.
- **needs tab:** need cards; the one matching your skills is highlighted (blue "matches your
  skills" tag + amber `I can help` DM CTA), others get neutral `message`. Rail = YOUR NEEDS
  (review applicants) + "get found / edit your skills" nudge.
- **skills tab — BUILD AS A DRILL-DOWN (user's explicit note):** a flat list of everyone gets
  cluttered. Show skill **categories** first (clean grid: skill name + count), pick one →
  then the people good at it (cards: avatar, name, stage, what they're building, skill tags
  with the matched skill amber, `dm` button). Search + category filter chips on top.
  (The mockup shows the flat version — build the drill-down instead.)

### PROJECT ROOM  (`app/(app)/collab/[id]/page.tsx`, member-only)
Breadcrumb `COLLAB_BOARD / <project>`. Header: title + category chip + `● active` + member
avatars. Tabs `thread · docs · decisions` (open-decision count amber on the tab).
- **thread** = team group-chat: messages (avatar/name/time), `is_system` events as centered
  muted lines, gradient `send` composer pinned at bottom.
- Rail: amber "DECISION NEEDS YOU" vote tile (real open-decision + `cast your vote`),
  MEMBERS list (owner/you tags), SHARED DOCS (file/link icons).

### MESSAGES  (`app/(app)/messages/page.tsx`)  — DM messenger
Two-pane: convo list (avatar, name, last-msg preview, time, green unread dot, active convo =
amber left-edge) + thread (partner header w/ `view profile →`, chat bubbles — **mine right
w/ amber gradient**, theirs left neutral `#1c2128`, a system line "you replied to X's need",
gradient `send` composer). This is where every DM button in the app lands.

### VAULT  (`app/(app)/vault/page.tsx`)
Tabs `library · notes · community wisdom`. Header context `12 saved · 4 notes · 3 wisdom`.
- **library:** saved item cards w/ source-kind chip (pulse post=teal, project=purple, cohort
  post=green) + tag chip + content + author + **your personal note** pinned below with an
  amber left-edge. Rail = COLLECTIONS folder list (counts) + gradient community-wisdom teaser.

### REFERRALS  (`app/(app)/referrals/page.tsx`)
Gradient hero: referral link + `copy link` + `3 invited · 2 joined · $40 earned`.
Main = invited-founders list (avatar, name/email, joined/pending status pill, `+$20` credit).
Rail = big `$40` CREDIT EARNED tile + NEXT REWARD progress bar tile.

### PROFILE  (`app/(app)/profile/[username]/page.tsx`)
Header card: avatar w/ stage ring, name, `@user`, stage + tier pills, `◈` handshake count,
vouched-by. Non-owner actions: `vouch` / `◈ handshake` / gradient `message`. Owner: settings link.
Tabs `about · posts · handshakes`.
- **about:** main col = BUILDING tile, 3 stat tiles (trust / handshakes / joined), amber
  SKILLS pills, CONTRIBUTIONS (project + status). Rail = COHORT FINGERPRINT (abstract SVG
  shape + 5-type legend question=blue/update=gray/decision=amber/win=green/blocker=purple),
  COHORTS `#` tags, gradient "skills match your need → message" nudge. Owner adds private
  MIRROR metrics + billing.

---

## 5. Global do / don't
- DO reuse existing components (TopBar, Sidebar, Avatar, StagePill, PulseBar, YourWorkspace,
  widgets) — restyle them, don't rebuild logic. All data-fetching in the page servers already
  exists; the redesign is presentational.
- DO keep one accent (amber) + green-for-live. DON'T reintroduce the rainbow.
- DO box each section. DON'T ship open divider-only lists (rejected).
- DON'T put >~6 sections on home. DON'T duplicate a page's job on home — link to it.
- Gradients only on: hero tile per page, primary buttons, matching CTAs. Not everywhere.

---

## 6. Build order (recommended)
1. **Shared shell** (§3) — AppShell/TopBar/Tile/MonoKicker/GradientButton/TabPill/Footer/
   PersonAvatar/NetworkGraph. Get one page (home) rendering on it.
2. **home** — highest impact, proves the shell + declutter.
3. **pulse** — social boxed-post feed + rail.
4. **collab board** projects → needs → **skills (drill-down)**.
5. **project room**.
6. **messages**.
7. **vault**, **referrals**, **profile**.
8. Carry the shell to **cohort / settings / pricing** (not separately mocked — same skeleton).
Verify each page in the browser (preview tools) before moving on.

---

## 7. Not yet designed
`cohort`, `settings`, `pricing`, and the collab `LockedCollabBoard` gate were not mocked.
Apply the same shell + tile + palette rules; ask the user for any page-specific intent.

---

## 8. Reference files in this folder
- `mockups.html` — all approved screens, stacked and labeled. Open in a browser; this is the
  pixel-accurate source of truth. Build to match it (except skills tab → drill-down).
