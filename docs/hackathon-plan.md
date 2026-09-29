# Hackathon ("Sprints"): plan and progress log

The single place to pick this build up from. Read it first in any new session,
then check `git log main..feat/hackathon-db` for anything newer.

- **Branch:** `feat/hackathon-db`. Everything is committed locally and **nothing is pushed**.
  The owner decides when to push.
- **Status (2026-09-28):** Phases 1–3 are built, checked on staging, and approved by the owner
  (Phase 3: "looks good for now"). Next is Prompt 4 (the join queue and the team matcher).

---

## 1. The brief (Prompt 0)

### About Quorum
Quorum (quorumhq.co) is a private, paid community for startup founders.
- **Cohorts:** members are placed in cohorts of 12 that meet weekly.
- **Other features:** a network-wide Pulse feed, a Collab Board, a Vault, DMs, handshakes,
  vouches and badges, profiles, and an admin area.
  - On the Collab Board, founders post projects and pick teammates. Each project has a private
    room with a thread, docs, links and team votes.
- **Joining:** signup is invite-only, with admin approval in batches of 12.
- **Pricing:** a monthly subscription with a 30-day free trial. Trial users count as members.
- **Services:** email goes through Resend. Hosting is Vercel. Data, auth, storage and realtime
  are Supabase. Code is on GitHub.

### What we're building
A new top-level **Hackathon** tab. Each event is a **Sprint**: a recurring 48-hour event where
members team up to build a *new* MVP or idea from scratch.
- **Network-wide:** any member from any cohort can join, and teams can mix cohorts.
- **Created by hand:** the admin creates each Sprint manually. There may be one at launch,
  another a month later, or none. **Nothing may be hard-coded to a single event.**

Core experience:
- **Join queue:** register for the upcoming Sprint and choose the random pool, or create or join
  your own team.
- **Arena home page:** a visual of all teams (name, members, activity). The work itself is
  **sealed**: nobody outside a team can see what it's building until the reveal.
- **Countdowns:** to registration and kickoff, and during the Sprint to the submission deadline.
  The countdown also shows on the public landing page.
- **Private team room:** chat thread, docs, links and votes, like a Collab project room but living
  inside the Hackathon tab, **not** the Collab Board.
- **Lobby:** a shared chat for everyone in the Sprint, before, during and after.
- **Submission form:** hard-locks at the deadline.
- **Judging:** invited judges score with a rubric. Recognition is light: awards, no losers, no
  full ranking.
- **Reveal:** all projects unseal at once, a gallery shows what everyone built, and each project
  gets a public shareable page.

### Ground rules for the whole build
1. **Explore before building.** First explore the repo and report back:
   - framework, language, styling, components, data fetching;
   - Supabase clients, migrations, RLS conventions, RPCs, realtime, storage;
   - auth and membership (trial counts as member), and how admins are identified;
   - the Collab Board in detail;
   - Resend and Vercel Cron;
   - navigation;
   - the landing page's seat counter and any existing countdown.

   Then wait before building.
2. **Match existing conventions exactly:** structure, naming, styling, the dark theme with one
   amber accent. No new libraries without asking.
3. **Security lives in the database.** Every new table gets RLS with explicit policies. "Sealed"
   must be truly sealed at the API, not merely hidden.
4. **Time:** store UTC (`timestamptz`) and display in the viewer's time zone. Countdowns use
   **server** time (a client-server clock offset), so a wrong device clock can't show a wrong
   countdown or allow a late submission.
5. **Deadlines are enforced server-side or in the database**, never only in the UI.
6. **Mobile matters:** many members use phones.
7. **Every schema change is a migration**, in the repo's existing system.
8. **Each phase:** plan (files, migrations, policies), then wait for OK, then build, then give
   exact test steps.
9. **If a prompt conflicts with how the code works, say so** instead of guessing.
10. **Never hard-code launch or Sprint dates.** Every date, and whether each countdown shows, comes
    from admin-editable settings (built in Phase 2). The admin can move dates, hide or show any
    countdown, and change its target without a code change or redeploy.

The Collab Board must keep working identically: **no hackathon data in Collab tables**, and no
Collab behaviour changes. Its UI may be refactored to be shareable, but only with approval.

---

## 2. What exploration found (still true)

- **Stack:** Next.js 16 App Router (Turbopack), React 19, TypeScript, Tailwind 3 plus CSS
  modules.
  - The "sleek finish" lives in `components/ui/sleek.module.css`, and the rules are in
    `design/REDESIGN-BUILD-GUIDE.md`.
  - The admin console keeps its own older look: mono, lower-case.
- **Data pattern:** server components read with the cookie Supabase client and pass data to
  `"use client"` components.
  - Those components write straight to Supabase and subscribe to `postgres_changes`.
  - API routes handle anything needing entitlement checks or the service role.
  - There's no SWR or React Query, and no test framework.
- **Migrations:** numbered files in `supabase/migrations/`, **pasted by hand** into the Supabase
  SQL editor. There's no CLI link.
  - A migration must land **before** the deploy that needs it.
  - A fresh database is `supabase/schema.sql`, then every migration in order.
- **Access:** `lib/entitlements.ts` decides access (paid or open trial means full access; lapsed
  accounts can read only). Before this build, RLS only checked "logged in".
- **Admin, before this build:** a shared code in the `x-admin-code` header, with the service role
  behind it. `profiles.is_admin` existed separately.
- **Collab room UI:** `components/collab/ProjectRoomClient.tsx`. Its Thread, Docs and Decisions
  tabs are private functions that hard-code Collab table names. Reusing them needs a small
  "room adapter" refactor (proposed, not done yet).
- **Collab RLS gaps, reported and not fixed:**
  - `project_members_insert_self_or_owner` lets anyone add themselves to any project.
  - `notifications_insert_any` lets anyone notify anyone.
  - Decisions close client-side.
  - Join approval is several separate client writes.
- **Email and cron:** `lib/email/send.ts` (`sendEmail`, fetch to Resend with idempotency keys) and
  `lib/email/templates.ts`. Vercel Cron has two daily jobs in `vercel.json`, protected by
  `CRON_SECRET`.
- **Landing counter:** "N of 100 founding seats left", worked out on every request. There was no
  launch countdown before this build.

---

## 3. Environments and safety rules

| | Production | Staging |
|---|---|---|
| Supabase project | `ydbnyujqmhwufwqihefh` ("quorum") | `ycjqgrcapphfiageaaux` |
| Env file | `.env.local` | `.env.staging.local` (gitignored) |
| Migrations applied | up to **017** | **018–024** |

Rules the owner set:
- **Never** run migrations or tests against production.
- Before any migration, **say which project is the target and wait for an OK**. Use
  `scripts/db.sh staging:target`, then `staging:migrate`.
- **Don't read `.env.staging.local`.** The owner filled it in. Only the scripts read it, and they
  print just the project ref.
- **Don't push** until the owner says so. Vercel previews aren't set up yet, and will point at
  staging when they are.
- **Changing production data needs the owner's approval.** An attempt to set `is_admin` through
  the service role was refused by the permission classifier, and the owner ran the SQL
  themselves.

Tools, all in the repo:
- `scripts/db.sh local`: a fresh local Postgres 16 (`brew install postgresql@16`) with a Supabase
  stand-in (`supabase/tests/local/supabase_shim.sql`), `schema.sql`, every migration, then the
  tests.
- `scripts/db.sh staging:target | staging:migrate FILE… | staging:test | staging:seed-admin`:
  - All of them refuse any setting that points at production.
  - `seed-admin` writes the test admin's credentials to `.env.staging-admin.local` (gitignored).
- `node scripts/dev-staging.mjs`: the app on http://localhost:3100 against staging.
  - It refuses production and builds into `.next-staging`.
  - The Browser pane's config is `quorum-dev-staging`.
  - This is a Node launcher because the preview's shell isn't allowed to `source` env files.
- `node scripts/seed-staging.mjs`: six test members (`member-1…6@quorum.test`), a "UI test"
  Sprint, team Alpha and lobby messages. It refuses production and is safe to run again.
- `node scripts/seed-staging-sprints.mjs` (Phase 3): one test Sprint per state, #3–#11 on
  staging ("State: upcoming" … "State: cancelled", plus "State: flips every 2 min", which walks
  through every state two minutes apart). Times are set relative to now, so running it again puts
  each one back in its state.
  - The test admin is in the random pool of the registration Sprint, on team Rockets in the live,
    paused and flip Sprints, and a judge of the judging Sprint; a spectator everywhere else.
  - Needs `seed-staging.mjs` and `staging:seed-admin` first. Refuses production.

Signing in on staging:
- **The owner's real account doesn't exist there.** Staging started empty.
- **Test admin:** `admin-test@quorum.test`. The password and the staging-only admin code are in
  `.env.staging-admin.local`.
  - The owner signs in to the Browser pane themselves. Claude doesn't type the password: sign-in
    goes to Supabase, not a local server. To show it in your own terminal:
    `grep STAGING_ADMIN_PASSWORD .env.staging-admin.local`.
  - The desktop app stops the preview server after about an hour. Restart it with the
    `quorum-dev-staging` launch config; the sign-in survives.

---

## 4. Phase 1: database foundation (migrations 018–021)

### Files
- `supabase/migrations/018_hackathon_core.sql`
  - Helpers, Sprints, the state machine, registrations, teams, members, join requests, judges.
  - The team functions, and `hackathon_resume`.
- `supabase/migrations/019_hackathon_rooms.sql`: team rooms (thread, docs, links, votes,
  ballots), the lobby, and pause/resume/cancel notices.
- `supabase/migrations/020_hackathon_submissions.sql`: submissions, the storage bucket, scores,
  awards, `get_team_activity`.
- `supabase/migrations/021_hackathon_admin_audit.sql`: the log of admin edits made after a
  deadline.
- `supabase/tests/hackathons_test.sql`: the RLS and state tests (the whole suite, including
  Phase 2's).

### Tables
All have RLS on, and all times are `timestamptz`.

| Table | What it holds |
|---|---|
| `hackathons` | One row per Sprint: number (max + 1, never a sequence), slug, title, tagline, `theme_hidden`, rules, six timestamps, `lobby_closes_at`, team sizes, `status_override` (paused / cancelled) + `status_override_at`, `is_published`. Phase 2 added the countdown columns. |
| `hackathon_registrations` | One per person per Sprint; mode random / team; `team_id` kept in step by trigger; `checked_in_at`, `withdrawn_at`. |
| `hackathon_teams` | Name (unique per Sprint, ignoring case), auto slug, emblem, colour, `is_random_matched`, `is_open_to_requests`. Phase 2 added `max_size_override`. |
| `hackathon_team_members` | Owner / member; a copied `hackathon_id` makes "one team per Sprint" a unique constraint; one owner per team. |
| `hackathon_team_join_requests` | pending / accepted / declined / cancelled, with an optional message. |
| `hackathon_judges` | `accepted_at` required for judge access. Phase 2: `user_id` optional plus `invite_email`. |
| `hackathon_team_messages`, `hackathon_team_docs`, `hackathon_team_links` | The team room. Same shape as Collab's but separate tables. Messages are soft-deleted (text blanked); `is_system` lines are written by triggers. |
| `hackathon_team_votes`, `hackathon_team_ballots` | Collab's decision model (options as a jsonb array). The database closes a vote once every member has voted; ties go to the option listed first. |
| `hackathon_lobby_messages` | The Sprint-wide chat; `is_pinned` (admins only), system notices. |
| `hackathon_submissions` | One per team; screenshots are storage paths inside the team's folder; `built_with` is tidied. |
| `hackathon_scores` | Four 1–5 scores plus private notes; one per judge per submission. |
| `hackathon_awards` | judges_pick / most_shipped / best_collaboration / most_likely_to_become_real / custom. |
| `hackathon_admin_audit` (021) | Append-only log of admin edits to submissions or scores after their deadline. |

Storage: a private bucket, **`hackathon-submissions`** (5 MB, images only), with paths
`{hackathon_id}/{team_id}/{file}`.

### State machine
State is derived, never stored, so no cron job is needed.
- **Pure logic:** `private.hackathon_phase_at(...)`.
- **What people see:** `public.hackathon_state(id)` and `hackathon_state_at(id, at)`. To fake a
  time: `select hackathon_state_at('<id>', '2026-10-10 12:00Z')`.
- **States:** draft → upcoming → registration → teams_locked → live → judging → revealed, plus
  paused and cancelled.
- **Frozen clock:** pausing or cancelling stops the Sprint's clock at `status_override_at`, and the
  access rules use that frozen clock (`private.hackathon_phase(id)`).
- **What the app reads:** the **`hackathon_overview`** view (security invoker). It adds `state`,
  `phase` (where the frozen clock stands) and `theme`.
- **`server_now()`:** the database clock, used by the countdowns.

### Access helpers
These live in the **`private`** schema. The API can't reach them, so nobody can use
`is_active_member(someone_else)` to learn whether another member pays. They include:
- `is_admin`, `is_active_member` (mirrors `computeEntitlement`), `is_participant`,
  `is_team_member`, `is_team_owner`
- `is_judge` (accepted only), `is_invited_judge`, `can_view_arena`
- `can_read_team_room` / `can_write_team_room`, `can_read_lobby` / `can_write_lobby`
- `can_read_submission` / `can_write_submission`, `scoring_open`

Guard triggers tell a member's own request apart from a server one using `current_user`:
anon and authenticated are members; the service role, the SQL editor and SECURITY DEFINER
functions aren't.

### Who can do what
| | Read | Write |
|---|---|---|
| Sprints (via the view) | Anyone for published ones (signed out too); drafts admin-only. **`theme_hidden` is revoked at column level**; `theme` stays NULL until kickoff on the Sprint's clock. | Service role (admin console) only. |
| Registrations | Participants in that Sprint, plus your own row. | Your own row: register (active member, not a judge) and switch mode only while registration is open; withdraw until kickoff. |
| Teams, members, requests | Active members, participants, judges, admins (the arena). | Only through the team functions: `hackathon_create_team`, `_update_team`, `_request_to_join`, `_cancel_join_request`, `_respond_to_join_request`, `_leave_team`, `_remove_member`, `_accept_judge_invite`. |
| Team room | That team's members and admins; **never judges**; sealed forever. | Members, until the reveal, while not frozen. |
| Lobby | Participants, accepted judges, admins. | Same people, until `lobby_closes_at`; open during a pause; read-only on cancel; after the reveal a participant must be an active member. |
| Submissions and screenshots | Team and admins; accepted judges from the deadline; **everyone** from the reveal (not if frozen first). | Team members, only while live and not frozen, enforced by a trigger that raises. |
| Scores | The judge who wrote them, and admins. Never public. | The judge, between `ends_at` and `judging_ends_at`. |
| Awards | Everyone from the reveal. | Service role. |
| Activity pulse `get_team_activity(id)` | Arena audience; counts and timestamps only. | — |

### Tests
- `scripts/db.sh local` or `staging:test`. The suite ends by raising an error on purpose so every
  change rolls back, even in the SQL editor. **Success reads "ALL n TESTS PASSED".**
- A deliberate-break check was done for each rule: break it on purpose, then confirm the right
  tests fail.
- **Tests must not assume an empty database.** Staging keeps test data from manual checks, so the
  tests create their own Sprints, users and countdown keys (`test-launch`, `test-teaser`) and
  count only their own rows. Written 2026-09-26, when a real `launch` countdown on staging broke
  three tests that counted every row.
- **Last run (2026-09-28, Phase 3):** all 330 tests pass locally and on staging.
- The local cluster lives in `$TMPDIR/quorum-pg16`. macOS's temp cleaner can strip its top-level
  files, and then `pg_ctl` says it "is not a database cluster directory". Move the folder aside
  and run `scripts/db.sh local` again: it makes a fresh one.

---

## 5. Phase 2: admin controls and countdowns (migrations 022–023)

### Database
**`022_hackathon_admin_controls.sql`:**
- Draft Sprints may leave dates empty; `hackathons_published_has_dates` blocks publishing without
  all six. The slug defaults to `sprint-<number>`.
- On `hackathons`: `show_countdown_in_app`, `show_countdown_on_landing` (both default true),
  `countdown_headline_override`.
- On `hackathon_teams`: `max_size_override`.
- On `hackathon_judges`: `user_id` optional, plus `invite_email` (lower-cased, unique per Sprint).
- **`site_countdowns`**, the standalone countdowns: key, label, subtext, `target_at`, is_enabled,
  show_on_landing, show_in_app, zero_behavior (hide / show_message), zero_message, cta_label,
  cta_url, `is_launch`, updated_by.
  - Anyone can read enabled rows, minus `updated_by`.
  - Only admins write.
- **`admin_change_log`:** every admin change to Sprints, countdowns, teams, members,
  registrations, judges and lobby messages, with who, why (summary), old → new, and when.
  - Written by triggers, so the SQL editor is caught too.
  - Members' own actions aren't logged.
  - Append-only.
- **Admin-only functions** (service role only):
  - `hackathon_admin_shift(id, from_milestone, minutes)`: moves that milestone and every later one
    (extending the deadline, pushing a countdown back). Refused after the reveal.
  - `hackathon_admin_move_member`, `hackathon_admin_merge_teams`, `hackathon_admin_create_team`
    (each with an optional raise-the-limit flag).
  - `hackathon_admin_duplicate`: next number, no dates, no theme, a draft.

**`023_admin_actor_headers.sql`:**
- **How logs name the admin:** server routes send `x-quorum-actor-id`, `x-quorum-via` and
  `x-quorum-action-b64` (see `lib/admin/db.ts`). Both logs then name the admin from their account,
  e.g. "Keaton Walker (admin console, 1.2.3.4)", and carry the note.
- Log entries skip fields empty on both sides.
- Resuming gives back whole minutes, rounded up.

### Admin console
- **The whole admin board needs two locks:** a signed-in Quorum account with `is_admin` **and**
  the admin code.
  - The logic is `requireAdmin()` in `lib/admin/auth.ts`. Every route goes through
    `verifyAdminRequest()`.
  - The sign-in screen says which lock is missing.
  - The menu becomes a scrolling row on phones.
- **`sprints` section** (`app/admin/sections/Sprints.tsx`, plus `sprints/*`):
  - List with state and counts.
  - Create/edit form. Times are in **America/New_York** (shown with the offset), stored in UTC,
    with a DST-safe conversion (`lib/time/newYork.ts`).
  - Ordering errors in words, and a quick-schedule helper (`lib/hackathons/timeline.ts`).
  - Second confirmation for times under an hour away.
  - Controls: publish, unpublish, pause, resume (optionally giving the time back), cancel (type
    CANCEL) and undo, extend the deadline, duplicate. "Run team matcher" is disabled until
    Prompt 4.
  - Tabs: participants (withdraw), teams (create, move, remove, merge, rename, size override),
    judges (member or email; offers to withdraw a registered participant first), lobby (pin,
    unpin, delete), log (grouped per action).
- **`countdowns` section** (`app/admin/sections/Countdowns.tsx`):
  - Every standalone and Sprint countdown, with target, time left, on/off, landing/app switches,
    a live preview, change target, push back by hours or days, create, edit, delete, and recent
    changes.
  - Warns when a launch countdown has passed while `platform_status` is still waitlist.
- **`sprint_audit` section:** the after-deadline audit (021).
- **API routes:**
  - `/api/admin/hackathons` (+ `[id]`, `[id]/actions`, `[id]/teams`, `[id]/people`)
  - `/api/admin/members` (person search)
  - `/api/admin/countdowns`, `/api/admin/hackathon-audit`
  - Shared helpers: `lib/admin/hackathons.ts`, `lib/admin/db.ts`, `app/admin/ui.tsx`.

### Countdowns on the site
- **Shared pieces:**
  - `lib/countdowns.ts`: what's public, for the landing page or the app.
  - `components/countdown/CountdownView.tsx`: one countdown; also the admin preview.
  - `components/countdown/CountdownStrip.tsx`: a list that re-checks every minute.
- **Where they show:** a strip above the landing hero (`components/landing/Landing.tsx`) and a
  slim bar under the trial banner in `app/(app)/layout.tsx`.
- **`/api/countdowns?where=landing|app`:** cached at the edge for 30 s, never in the browser, so a
  change reaches visitors within about a minute without a redeploy.
- **`/api/time`:** the database clock, never cached. `lib/useServerNow.ts` works out the device's
  offset, so countdowns never tick on the device's clock.
- **Sprint countdowns count to the Sprint's real next milestone:** registration opens → kickoff →
  deadline → reveal. Paused shows "Paused". They disappear once revealed or cancelled.

---

## 5b. Phase 3: the Hackathon tab and its structure (migration 024)

No team logic yet. Every section a later prompt fills in is its own file, marked PLACEHOLDER.

### Database
**`024_hackathon_registrants.sql`:** `hackathon_registrants(id)` returns who's registered (id,
name, username, stage, registered_at) to the arena's audience (`private.can_view_arena`).
- Withdrawn people are left out, and it never returns mode, team or email.
- The registrations table itself stays participants-only.
- Signed-out callers can't run it; lapsed non-participants get nothing.
- Six new tests; **330 tests** pass locally and on staging (2026-09-28).

### Routes
| Route | What |
|---|---|
| `/hackathon` | Redirects to the current Sprint (`pickCurrentSprint`): live > judging > teams_locked > registration > upcoming > most recently revealed. Paused ranks where its clock stopped; cancelled and drafts never count. None: "No Sprint is scheduled right now". |
| `/hackathon/[number]` | The one Sprint page. The layout follows `state` (and `phase` while paused). Drafts: admins only, with a banner. |
| `/hackathon/archive` | Revealed and cancelled Sprints, newest first. |
| `/hackathon/[number]/team`, `/lobby` | PLACEHOLDERS. The server lets in only team members (team) or participants, accepted judges and admins (lobby); everyone else goes back to the Sprint page. |
| `GET /api/hackathons/[number]/timing` | Stored times, pause/cancel and the countdown switches, for published Sprints only (read signed out). Edge-cached 30 s. |

### The page, by state
Files: `app/(app)/hackathon/[number]/page.tsx`; `components/hackathon/*`.

| State | Shows |
|---|---|
| upcoming | Hero, "Registration opens in…", theme (sealed note), rules |
| registration | "Kicks off in…", join queue (`JoinQueue.tsx`, PLACEHOLDER for Prompt 4, anchor `#join`), who's registered, teams so far |
| teams_locked | "Kicks off in…", final teams |
| live | Large countdown to the deadline, the theme, the arena (`Arena.tsx`, a plain card grid; Prompt 5 replaces it), "My team room" and "Lobby" |
| judging | "Results revealed in…", arena with Submitted / No submission badges (from `get_team_activity`) |
| revealed | Awards on top (real, from `hackathon_awards`), gallery (`RevealGallery.tsx`, PLACEHOLDER for Prompt 10), teams |
| paused / cancelled | `StatusBanner` explaining it; no countdown. Paused keeps the layout of where its clock stopped. |

- **Every state** has a schedule rail (all milestones in the viewer's time zone, the next one in
  amber) and a viewer callout:
  - **Participant:** their status, plus the team room and lobby.
  - **Judge:** the lobby. **Invited judge:** a note.
  - **Spectator:** "Register" (jumps to `#join`) while registration is open; otherwise a link to
    the next announced Sprint.
  - **Lapsed non-participant:** "Renew" → /pricing.
  - **Admins** also get "Manage in admin".
- **Theme, admin view:** admins get the theme before kickoff (as in 018), so the page labels it
  "sealed · only admins see this".
- **Data:** read with the member's own client (`lib/hackathons/page.ts`), so RLS decides; no
  service role. Standing (admin, active) comes from `lib/hackathons/viewer.ts`.

### Countdown
- **`components/countdown/Countdown.tsx`:** `<Countdown target size>`, plus `CountdownDigits` for
  a parent that already holds the clock.
  - Sizes: `inline`, `standard` (digit blocks), `hero` (the live Sprint: large glowing digits,
    hotter in the final hour).
  - Under 640 px it becomes one compact line, `1d 03:54:48`.
  - Dashes until the server clock is measured.
- **One component everywhere:** the Phase 2 bar and strip (`CountdownView`) now use it too, so
  standalone countdowns look the same everywhere.
  - The in-app bar leaves out the Sprint whose page you're on.
  - The bar's Sprint rows link to their page ("Open →"); the landing page's don't, because
    visitors are signed out.
- **Admin switches:** `show_countdown_in_app` off hides the ticking numbers and shows the time as
  plain text; the page still moves on at zero. `countdown_headline_override` replaces the headline.
- **`lib/useServerNow.ts` (changed):** between measurements, time now moves on
  `performance.now()`, not `Date.now()`, so changing the device clock mid-page doesn't move a
  countdown at all.
  - It re-measures every 5 minutes and when the tab becomes visible again.
  - `approxServerNow()` gives a one-off, non-ticking reading (for the nav).
- **`components/hackathon/SprintAutoRefresh.tsx`:**
  - At each phase boundary (on the server clock, plus 0.5 s) it calls `router.refresh()`, and
    retries after 2, 5, 10, 20 and 30 s until the database agrees the state changed.
  - Every 30 s, and on focus or visibility, it compares `/api/hackathons/[n]/timing` with what the
    page has, and refreshes on any difference.

### Nav
- **Hackathon tab** after Collab board (`components/Sidebar.tsx`, glyph ◈).
  - Shown to active members, and to anyone registered or judging in any Sprint, even if lapsed
    (`lib/hackathons/nav.ts`, computed in the app layout).
  - Anyone else who opens a Sprint page gets the "Renew" callout.
- **LIVE:** a green `LIVE` pill (a dot when the rail is collapsed) while any published, unfrozen
  Sprint is between kickoff and deadline.
  - Worked out in the browser from the windows, rechecked every 30 s.
  - The phone menu button gets the same dot (`html[data-sprint-live]` in `globals.css`).
- **TopBar context line:** "48-hour Sprints, network-wide".

### Checked on staging (2026-09-28)
- **Every state** rendered with the right sections for #3–#11, as participant, judge and
  spectator.
- **Automatic state changes:** the flip Sprint went Announced → Registration open 5 s after its
  boundary, and Teams locked → Live 2 s after, both without a page reload. The theme unsealed and
  the hero countdown appeared.
- **Device clock:** moving it 3 hours ahead mid-page moved the countdown by 3 s (real time).
- **Admin changes:** `hackathon_admin_shift` +10 min on the open page's deadline appeared within
  seconds, without a reload.
- **Access:** a team room you're not on redirects to the Sprint page; the lobby lets a judge in;
  an unknown number is a 404; `/hackathon` opens the live Sprint.
- **Phone width (375):** no sideways scroll, compact countdown, dot on the menu button.

---

## 6. Decisions log

| # | Decision | Why |
|---|---|---|
| 1 | Access helpers live in a `private` schema, not `public`. | So nobody can learn whether another member pays or is on a team. |
| 2 | The theme is protected with a column revoke, and read through the view and a function. | RLS can't hide columns. |
| 3 | `hackathon_state(id uuid)`, not a function taking the whole row. | A whole-row reference would need the revoked theme column. |
| 4 | Sprint numbers are max + 1 under a lock, not a sequence. | Rolled-back inserts would leave gaps (Sprint #1 must be #1). |
| 5 | Text columns with checks, not Postgres enums. | Repo convention. |
| 6 | Votes use Collab's shape (options jsonb on the vote), with closing done in the database. | Reusable UI; no client-side closing. |
| 7 | Team membership changes only through SECURITY DEFINER functions, with no insert policy. | Avoids Collab's self-join hole. |
| 8 | Published Sprints are readable signed out, and also by lapsed members. | The landing countdown needs it; hiding from lapsed members would protect nothing. |
| 9 | **Pause** freezes rooms, submissions, scoring and the reveal; the **lobby stays writable**; notices post automatically. **Cancel** makes the lobby read-only. | Owner. |
| 10 | The theme stays hidden only if frozen **before** kickoff. | Owner. |
| 11 | Pausing records the freeze time; resuming can extend every timestamp not yet passed by the pause length. | Owner. The extension is rounded up to whole minutes (023). |
| 12 | Registering requires an active member (trial counts). Once registered, room and lobby access continue through the reveal even if the trial or subscription ends. After the reveal, rooms become read-only for everyone; lapsed participants keep reading but can't post in the lobby. | Owner. |
| 13 | Judges need an account but don't pay, and can't compete in the same Sprint. **Both directions** are enforced; making a registered participant a judge means removing their registration first. | Owner. |
| 14 | Judge-only accounts must never count toward founding seats or the seat counter, and must never be placed in a cohort. | Owner. **Not built yet:** it belongs to the external-judge flow (Prompt 9). Sprint #1's judges are the owner and an existing member. |
| 15 | Admins may fix submissions or scores after a deadline, but every such edit is logged and shown in the admin console. | Owner (021). |
| 16 | The whole admin board requires a signed-in `is_admin` account as well as the code. | Owner. Keaton Walker is admin on production, set by the owner via SQL. |
| 17 | Countdowns: a landing strip above the hero, and a slim in-app bar under the trial banner. | Owner. |
| 18 | Local checks run against staging with a staging-only admin code and test account. | Owner. |
| 19 | Extending the deadline is allowed until the reveal; if the deadline has passed, the confirmation says it reopens submissions. | Owner. |
| 20 | Draft Sprints may have no dates; publishing needs all six. | "Duplicate Sprint, dates cleared". |
| 21 | Going over a team's size limit is an explicit, logged per-team override. | "Respect max_team_size unless I explicitly override". |
| 22 | A merge is refused if the team being merged away has a submission (merge the other way). | Its screenshots live in that team's storage folder. |
| 23 | Countdown zero is display only; the panel warns when the launch has passed and signups are still waitlist-only. | Opening the doors stays a deliberate action. |
| 24 | Sprint countdowns have no separate target; pushing one back moves the Sprint itself. | The screen must never disagree with when submissions lock. |
| 25 | Staging instead of production for migrations and tests. | Owner; they briefly considered production (no members yet), then kept staging. |
| 26 | Commits stay local until the owner says otherwise; Vercel previews come later and will point at staging. | Owner. |
| 27 | Spectators see **names** of who's registered, through `hackathon_registrants` (024); the registrations table stays participants-only. | Owner chose names over a count only. |
| 28 | The Hackathon tab shows for active members, plus anyone registered or judging in a Sprint (even if lapsed). | Brief ("active members") reconciled with decision 12. |
| 29 | `/hackathon` redirects to the current Sprint's own page (live > judging > teams_locked > registration > upcoming > latest revealed; paused by its frozen phase; never cancelled or draft). | One shareable address per Sprint; the brief's order didn't cover judging or paused. |
| 30 | Until Prompt 4, the spectator's "Register" jumps to the join-queue slot, which says it opens soon. Nothing registers yet. | Keeps Prompt 4's scope intact. Owner: "whatever you think is best". |
| 31 | Countdowns tick on `performance.now()` from one server measurement, never the device's clock. | "Countdown ticks correctly even if I change my device clock", including mid-page. |
| 32 | The page follows admin changes by polling a 30 s edge-cached timing route (every 30 s, and on focus), not realtime. | `hackathons` isn't in realtime (column grants); the brief asks for ~1 minute. |
| 33 | Admins see the theme before kickoff, labelled "sealed · only admins see this". | The database already gives admins the theme (018); the label stops it looking like a leak. |

---

## 7. Open items and later prompts

**To do before deploying anything:**
- [ ] Paste migrations **018 → 024** into the production SQL editor, in order, before the deploy
      that needs them. The landing page and in-app bar tolerate their absence; the admin sections
      and the Hackathon tab don't (the "who's registered" list is just empty without 024).
- [ ] Push the branch when the owner says, and set up Vercel Preview env vars for staging when the
      owner is ready.

**Later prompts (from the brief):**
- **Prompt 4:** the join queue (replace `components/hackathon/JoinQueue.tsx`; keep the `#join`
  anchor) and the team matcher. Wire it to "Run team matcher now".
- **Prompt 5:** the arena (replace `components/hackathon/Arena.tsx`).
- Team room and lobby: replace the placeholders at `/hackathon/[n]/team` and `/lobby` (keep their
  access checks). Submission form, judging, public project pages.
- **Prompt 10:** the reveal gallery (replace `GallerySlot` in `components/hackathon/RevealGallery.tsx`).
- **Prompt 9:** external judge accounts. Link `invite_email` judges to accounts, and build decision
  14 (judge-only accounts never counted as founding seats and never placed in a cohort).

**Known gaps and ideas, not yet built:**
- The Collab room tabs need the "room adapter" refactor (with approval) before the Hackathon room
  can reuse them.
- The in-app countdown bar lists every enabled countdown. With many at once (staging has nine test
  Sprints) it pushes the page down, especially on phones. Consider capping it (e.g. the soonest two
  plus "+N more"); not needed while there are only one or two Sprints.
- Invited judges see a note on the Sprint page but can't accept yet (`hackathon_accept_judge_invite`
  exists; the button comes with the judging tools).
- Resuming a paused Sprint doesn't bring the nav's LIVE label back until the next page load
  (the open Sprint page itself updates within 30 s).
- Emails: nothing sends Sprint emails yet ("scheduled emails follow the Sprint's times" is a
  design promise to keep).
- Notifications for join requests and answers aren't built.
- Check-in (`checked_in_at`) has a column but no function to set it.
- `min_team_size` is stored but not enforced.
- Public project pages must show screenshots through **signed URLs** (the bucket is private).
- The `hackathons` table is deliberately **not** in realtime (column grants). Pause and resume
  reach people through lobby system messages.
- The Collab RLS gaps above: reported, not fixed; the owner hasn't decided.
- The admin console uses native `confirm()` / `prompt()`; the browser pane auto-dismisses them,
  so testing there needs them stubbed.
- New accounts get the existing guided tour overlay, which intercepts clicks until skipped. This
  predates the Hackathon work.
- The `NEXT_PUBLIC_SUPABASE_URL` line in `.env.staging.local` may carry a stray path; the scripts
  build the URL from the project ref instead.
- The `sprint_audit` screen has been opened on staging but not yet tested with a real
  after-deadline edit.

---

## 8. How to check it

```bash
scripts/db.sh local            # fresh local database + the whole test suite
scripts/db.sh staging:target   # which staging project (never production)
scripts/db.sh staging:test     # the same tests on staging; they roll back
node scripts/dev-staging.mjs   # the app on http://localhost:3100 against staging
```

Admin: http://localhost:3100/login?next=/admin, signed in as the test admin (see section 3).

## 9. Commits on `feat/hackathon-db`

| Commit | What |
|---|---|
| `153bb18` | Database foundation for Sprints, sealed by RLS (018–020, tests, `db.sh`) |
| `ed82d48` | Log admin edits made after a deadline (021, `sprint_audit`) |
| `df8132d` | Signed-out test logins carry no user id, as in Supabase |
| `8777124` | Database side of the admin controls and countdowns (022) |
| `1c59dcd` | Sprint admin screens; the admin board needs an admin account (023) |
| `b5bc168` | Readable change log, no stale Sprint page, staging seed script |
| `9ba69de` | Countdown control panel, and countdowns on the site |
| `e856fa1` | dev-staging says plainly when port 3100 is already in use |
| `c0d271e` | Plan and progress log; tests that don't assume an empty database |
| `2feb8bd` | The Hackathon tab: Sprint page by state, shared countdown, LIVE in the nav (024) |
