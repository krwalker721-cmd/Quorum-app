# Hackathon ("Sprints"): plan and progress log

The single place to pick this build up from. Read it first in any new session,
then check `git log main..feat/hackathon-db` for anything newer.

- **Branch:** `feat/hackathon-db`. Everything is committed locally and **nothing is pushed**.
  The owner decides when to push.
- **Status (2026-10-03):** Phases 1–8 are built, checked on staging, approved and committed
  locally. Next is the owner's Phase 9 prompt.

### Start here (handoff, 2026-10-03)
**Where things stand**
- **Migrations:** 018–030 are on staging. Production has none of them (it's at 017).
- **Tests:** 560 database tests pass locally and on staging (`scripts/db.sh local`,
  `scripts/db.sh staging:test`).
- **Branch:** `feat/hackathon-db`, with every commit local only. Don't push until the owner says so.

**The working loop:** for each prompt, plan (files, migrations, policies) → wait for the owner's
OK → build → test on staging → give exact test steps. Ask before every staging migration, saying
which project is the target.
- **Migrations go to staging by the owner's hand.** Since Phase 6 the permission check has
  refused `scripts/db.sh staging:target` and `staging:migrate` from Claude. Give the owner the
  three commands (`staging:target`, `staging:migrate supabase/migrations/0NN_….sql`,
  `staging:test`) and read the result from their `!` input or the Terminal panel.
  `staging:test` itself has sometimes been allowed.
- Each phase so far ended with: the owner's OK → commit locally → a "record the commit" docs
  commit. Never push.

**How to resume**
1. Start the app against staging with the Browser pane's `quorum-dev-staging` config
   (http://localhost:3100). The desktop app stops it after about an hour, sometimes between turns.
   Check `preview_list` before assuming a sign-in failed.
2. The owner signs in themselves; never type a password.
   - Test admin: `admin-test@quorum.test`.
   - Spectator: `spectator-test@quorum.test`.
   - Both passwords are in `.env.staging-admin.local`.
3. Test data:
   - `node scripts/seed-staging-sprints.mjs` puts Sprints #3–#11 back in one state each; #11 is
     also the team matcher demo. It also moves times, which withdraws lobby milestones whose
     moment is in the future again (029), so re-run it after any check that moves #6's times.
   - `node scripts/simulate-sprint-activity.mjs` makes the arena's pulses move.
   - **Playing the other teammates** (Phases 6–8): small staging-only scripts in the session's
     scratchpad, not in the repo, wrote as Maya, Leo, Priya or Sam with the service role (setting
     `user_id` / `last_edited_by` themselves) and moved #6's deadline or reveal. Rebuild them the
     same way if needed: read `.env.staging.local` only through the same parsing the repo's
     scripts use, refuse the production ref, never print keys.
4. **The browser pane holds a production session cookie** (`sb-ydbnyujqmhwufwqihefh-auth-token`)
   next to staging's (`sb-ycjqgrcapphfiageaaux-auth-token`), left from a time localhost served the
   production-pointed app. Anything that reads the session in the pane must pick the cookie by the
   staging ref and refuse the other. The owner may want to sign that session out.

**What Phases 3–8 added, at a glance** (details in sections 5b–5g)

| Phase | Database | Main files |
|---|---|---|
| 3 · Hackathon tab | 024 `hackathon_registrants()` | `app/(app)/hackathon/` (index, `[number]`, `archive`, `[number]/team`, `[number]/lobby`); `components/hackathon/SprintSections.tsx`, `SprintCountdown.tsx`, `SprintAutoRefresh.tsx`, `LocalTime.tsx`, `RevealGallery.tsx`, `RoomPlaceholder.tsx`; `components/countdown/Countdown.tsx`; `lib/hackathons/sprint.ts`, `page.ts`, `nav.ts`, `viewer.ts`; `app/api/hackathons/[number]/timing`; `lib/useServerNow.ts` (monotonic clock) |
| 4 · Registration and teams | 025 `hackathon_team_invite_codes`, `hackathon_team_invitations`, `private.join_team`, counts, check-in, renaming; 026 `hackathons.matched_at` / `match_report`, `hackathon_run_matcher()` | `components/hackathon/JoinQueue.tsx`, `JoinQueueClient.tsx`, `TeamPanel.tsx`, `MemberSearch.tsx`, `TeamStyle.tsx`, `CheckIn.tsx`, `QueueLive.tsx`, `JoinByLink.tsx`; `app/(app)/hackathon/[number]/join/[code]`; `lib/hackathons/actions.ts`, `matcher.ts`, `skills.ts`; `app/api/cron/hackathon-matcher` (not scheduled: Hobby); admin `SprintControls.tsx` (matcher), `Participants.tsx` (check-in) |
| 5 · Arena | 027 `hackathon_team_pulse` (+ triggers, realtime), `hackathon_arena_cohorts()` | `components/hackathon/Arena.tsx`, `arena.module.css`; `realtimeDb()` in `lib/hackathons/actions.ts`; `CountdownStrip.tsx` (row cap); `scripts/simulate-sprint-activity.mjs`; `db.sh staging:seed-spectator` |
| 6 · Team room | 028 `hackathon_team_member_activity` (team-only), `hackathon_room_seen()`, `hackathon_room_sleep()` | `app/(app)/hackathon/[number]/team/[slug]/page.tsx` (and `/team` redirects there); `components/hackathon/room/*` (`TeamRoomClient`, `RoomHeader`, `TeamDocs`, `TeamLinks`, `roomError`); shared `components/rooms/*` (`RoomThread`, `RoomVotes`, `RoomItemCard`, `kit.ts`, moved from the Collab room) and `components/editor/RichTextEditor.tsx` (moved from the Vault's `NoteEditor`); `lib/hackathons/room.ts`, `quiet.ts`; admin teams tab "open room ↗" |
| 7 · Lobby | 029 `hackathons.lobby_welcome`, `hackathon_lobby_messages.system_key`, `hackathon_post_lobby_milestones()`, `hackathon_lobby_welcome()`, `hackathon_lobby_people()`, length/rate limits, moved-milestone withdrawal, moderation logging | `app/(app)/hackathon/[number]/lobby/page.tsx`; `components/hackathon/lobby/LobbyClient.tsx`; `RoomThread` opt-in avatars, tags, milestone banners, actions; `lib/hackathons/lobby.ts`, `lobbyMilestones.ts`; milestones posted from the Sprint page, the lobby page and the timing route; admin Sprint form "welcome note" |
| 8 · Submission | 030 drafts: `project_name` optional; `is_complete`, `completed_at`, `last_edited_by` set by the guard; drafts sealed for good; pulse and `get_team_activity` count complete only; submissions in realtime | `app/(app)/hackathon/[number]/team/[slug]/submission/page.tsx`; `components/hackathon/submission/*` (`SubmissionForm`, `Screenshots`, `TagInput`, `DeadlineWarning`); `components/hackathon/showcase/ProjectShowcase.tsx` (for Prompt 10); `lib/hackathons/submission.ts`; `components/Markdown.tsx` (links, numbered lists) |

**Refactors outside the Hackathon tab (owner-approved, Phase 6):** the Collab room
(`components/collab/ProjectRoomClient.tsx`) and the Vault editor (`components/vault/NoteEditor.tsx`)
now render the shared pieces above; both were proven byte-identical with a temporary fixture page.
The one deliberate Collab change: decision cards say "Unanimous" only when everyone agreed
(`e2e386b`, decision 53).

**Waiting on the owner**
- The Phase 9 prompt. By the plan it's judging, with accounts for judges from outside Quorum
  (decision 14); then the reveal gallery and public pages (Prompt 10/11) and notifications
  (Prompt 12).
- Paste 018–030 into production before any deploy that needs them (section 7).
- The flagged task about realtime in 10 non-Hackathon features. The Collab ones need approval.
- Whether to push, and when.
- Optionally: sign the production session out of the browser pane.

**Staging test data, as left on 2026-10-03**
- The seed was re-run last, so #3–#11 are each in their state (#6 live) as of 2026-10-02 22:30 EDT;
  times drift, so re-run it.
- Sprint #4 (registration): the test admin is on Rockets; Test Crew has Sam plus a pending invite
  to Priya.
- Sprint #6, Rockets: a complete submission "NightDesk" (one WebP screenshot, a Markdown
  description), a "Pitch plan" doc, a decided vote "Which demo goes first?", Leo's "Live demo"
  link, "Phase 6 check" messages.
- Sprint #6 lobby: Priya's message pinned, Sam's deleted, the test admin's reply, and milestone
  messages ("Teams are locked", "Sprint is LIVE"; the later ones were withdrawn by the last reseed).
- Sprint #6, Comets: an older "simulated activity" submission (now a draft if incomplete).
  Several Sprints have "simulated activity" room messages.
- Sprint #11 has been matched.
- Re-running the seed resets times and the flip Sprint's teams; it doesn't remove extra teams,
  messages, docs or submissions.
- Outside the Hackathon: a Collab project "Staging check: Collab room" (the test admin's, with a
  message, a link and a decided vote) and an untitled Vault note, from the refactor checks.
- The pane was last signed in as the test admin (and holds the production cookie noted above).

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
| Migrations applied | up to **017** | **018–030** |

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
- `scripts/db.sh staging:target | staging:migrate FILE… | staging:test | staging:seed-admin | staging:seed-spectator`:
  - All of them refuse any setting that points at production.
  - `seed-admin` writes the test admin's credentials to `.env.staging-admin.local` (gitignored).
  - `seed-spectator` (Phase 5) adds `spectator-test@quorum.test`, an ordinary active member in no
    Sprint, for checking what spectators see. Its credentials go to the same file.
- `node scripts/simulate-sprint-activity.mjs [minutes] [seconds] [--submit]` (Phase 5): test members
  post in the live test Sprint's team rooms (#6), so the arena's pulse moves. Every message starts
  with "simulated activity" so a network check can search for it. Refuses production.
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
  - The test admin is in the random pool of the registration Sprint, on team Rockets in the live
    and paused Sprints, and a judge of the judging Sprint; a spectator everywhere else.
  - **Matcher demo (Phase 4):** each run clears the flip Sprint's teams and matcher record, and
    puts the test admin and members 1–5 in its random pool, with member 6 on "Open Door" (open to
    requests). Teams lock four minutes after the run; open `/hackathon/11` then to watch it match.
  - Needs `seed-staging.mjs` and `staging:seed-admin` first. Refuses production.

Signing in on staging:
- **The owner's real account doesn't exist there.** Staging started empty.
- **Test admin:** `admin-test@quorum.test`. The password and the staging-only admin code are in
  `.env.staging-admin.local`.
  - The owner signs in to the Browser pane themselves. Claude doesn't type the password: sign-in
    goes to Supabase, not a local server. To show it in your own terminal:
    `grep STAGING_ADMIN_PASSWORD .env.staging-admin.local`.
  - The desktop app stops the preview server after about an hour (and sometimes between turns).
    Restart it with the `quorum-dev-staging` launch config; the sign-in survives. A sign-in
    attempted while the server is down doesn't take.
  - **Spectator:** `spectator-test@quorum.test`, password via
    `grep STAGING_SPECTATOR_PASSWORD .env.staging-admin.local`. A new account gets the guided tour,
    which keeps navigating away. Press "Skip tour" first.

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
- **Tests must not depend on how Postgres breaks ties.** `set_phase` can give two milestones the
  same moment; `tests.milestones` orders ties by milestone order (fixed 2026-10-03, when staging
  ordered them differently from local).
- **Tests must not assume an empty database.** Staging keeps test data from manual checks, so the
  tests create their own Sprints, users and countdown keys (`test-launch`, `test-teaser`) and
  count only their own rows. Written 2026-09-26, when a real `launch` countdown on staging broke
  three tests that counted every row.
- **Last run (2026-10-02, Phase 8):** all 560 tests pass locally and on staging.
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
| `/hackathon/[number]/team`, `/lobby` | PLACEHOLDERS at the time; built in Phase 6 (the team room, now at `/team/[slug]`) and Phase 7 (the lobby). The access checks are unchanged: team members (team), or participants, accepted judges and admins (lobby); everyone else goes back to the Sprint page. |
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

## 5c. Phase 4: registration, teams, the matcher, check-in (migrations 025–026)

### Database
**`025_hackathon_join_queue.sql`**
- **`private.join_team(team, user)`:** the one path every way of joining shares.
  - Registration must be open and the Sprint not frozen, and the person can't be a judge or
    already on a team.
  - It registers them if needed (active members only; someone already registered keeps access,
    per decision 12), sets mode `team`, then adds them. The size trigger and one-team key apply
    as always.
- **Invite links:** `hackathon_team_invite_codes`, one code per team (8 characters, no 0/O/1/I/L).
  - Only the team's members can read it.
  - `hackathon_team_invite_code(team)` makes or returns it; `hackathon_reset_invite_code(team)`
    replaces it (both owner only).
  - `hackathon_team_by_code(code)` previews the team; `hackathon_join_with_code(code)` joins.
  - The code *is* the invitation, so the team needn't be open to requests.
- **Personal invites:** `hackathon_team_invitations` (pending / accepted / declined / cancelled).
  - `hackathon_invite_member` is owner only, while registration is open, and not for someone
    already on a team or when the team is full. Re-inviting after a no is allowed.
  - `hackathon_respond_to_invitation`: the invitee answers; accepting joins. `hackathon_cancel_invitation`: the owner takes it back.
  - Readable by the invitee, the team and admins.
  - Anyone approved can be invited. Whether they can take part is checked when they accept, so
    inviting reveals nothing about who pays.
- **`hackathon_registration_counts(id)`:** registered, random pool, looking (team mode with no
  team), on teams, teams. Numbers only, for the arena's audience.
- **`hackathon_check_in(id)`:** participants only, while live and not paused. Pressing it again
  keeps the first time.
- **`hackathon_update_team`, redone:** name, emblem and colour until the submission deadline, by
  the owner or any member of a matched team. "Open to requests" only while registration is open.
- **`hackathon_respond_to_join_request`, redone:** accepting also sets the joiner's mode to `team`.
- **Joining a team** (any way in) now also cancels the joiner's other pending invitations.
- **Realtime:** `hackathon_team_invitations` added.

**`026_hackathon_matcher.sql`**
- **`hackathons.matched_at`, `hackathons.match_report`:** not granted to members; the report names
  people.
- **`hackathon_run_matcher(id)`**, service role only.
  - **Once only.** It locks the Sprint row; a later run returns the stored report plus
    `already_matched: true` and changes nothing.
  - **When it runs:** after team lock, and not while unpublished, paused or cancelled. Past the
    deadline it records "skipped" and matches nobody.
  - **Who:** everyone registered without a team, meaning the random pool plus anyone in team mode
    who never found one.
  - **Seats:** s = min(max size, 3).
    - floor(n / s) new teams.
    - Leftovers go, one at a time, into teams marked open to requests (smallest first), then
      across the new teams up to the size limit.
    - If 2 or more are still left, they form a new team. If exactly 1 is left, they're
      **flagged** and stay unassigned for an admin (never a team of one, never added to a closed
      team).
  - **Placing people:** biggest cohort first, each where their cohort is thinnest, then the kind
    of skill (`private.skill_bucket`: technical / design / business from `profiles.skills`),
    then the headcount. The order is a hash of Sprint and person, so the same pool always gives
    the same teams.
  - **New teams:** `private.create_matched_team` names them from a word list ("Electric Falcons"),
    with an emblem and colour. Matched teams are closed to requests, and the first person placed
    owns the team.
  - **The report:** pool size, new teams and members, who joined open teams, flagged people, and
    `same_cohort_pairs` (0 is a perfect mix).

### When the matcher runs
- **The Sprint page:** when it loads in teams_locked or live, it calls `runMatcherIfDue`
  (`lib/hackathons/matcher.ts`, service role, logged as "team matcher (page load)") and then
  reads the Sprint again. The page already reloads itself at team lock, so participants see their
  matched team within seconds.
- **The admin console:** "run team matcher" is enabled after team lock (and not while frozen). It
  shows the report under the controls, including anyone flagged.
- **Cron:** `/api/cron/hackathon-matcher` is built but **not scheduled**. The owner is on Vercel
  Hobby, where a cron running more than once a day fails the deploy. On Pro, add
  `{ "path": "/api/cron/hackathon-matcher", "schedule": "* * * * *" }` to `vercel.json`.

### App
- **Join queue** (`components/hackathon/JoinQueueClient.tsx`, inside the `#join` tile):
  - Counts, and invitations waiting for you (Join / Decline).
  - Then, by where you stand:
    - **Not registered or withdrawn:** "Join Sprint #N" (or "Rejoin"), then three choices:
      - **Random pool.**
      - **Create a team:** name, emblem, colour, open to requests.
      - **Join a team:** an invite code field, plus teams open to requests with room, where "Ask
        to join" takes an optional message.
    - **In the pool:** "Switch to a team" or "Withdraw".
    - **Looking for a team:** your pending requests (cancel), the create/join choices, "Put me in
      the random pool", "Withdraw".
    - **On a team:** a pointer to the team panel, and "Withdraw".
  - Writes go straight to Supabase as the member (`lib/hackathons/actions.ts`); the database's
    messages are shown as they come.
- **Your team** (`TeamPanel.tsx`), from registration through live:
  - Members; the owner can remove people while registration is open.
  - Requests with Accept / Decline, and pending invitations with "Take back".
  - The invite link (make, copy, make a new one).
  - "Find people to invite" (`MemberSearch.tsx`).
  - "Edit team" and "Leave team".
- **Member search:** all approved members, found by name or skill text, with Technical / Design /
  Business filters (`lib/hackathons/skills.ts` mirrors the SQL buckets). It marks who's on a team.
  It reads `profiles.skills` itself, so the Collab Board is untouched.
- **Invite link page:** `/hackathon/[n]/join/[code]`. It previews the team, then either a "Join
  {team}" button or a plain reason it can't: invalid, already on this team, on another team,
  teams locked, needs membership, or full.
- **Live updates** (`QueueLive.tsx`, while registration is open): a realtime subscription to this
  Sprint's teams, members, registrations, requests and invitations refreshes the page a second
  after the last change. A 45 s refresh catches spectators up on counts.
- **Check-in** (`CheckIn.tsx`): the "I'm in — let's build" button for participants while live;
  afterwards, "✓ Checked in <time>".
- **Admin console, participants tab:** two hours after kickoff it counts and highlights who hasn't
  checked in, with an "only not checked in" filter.

### Checked on staging (2026-09-29)
- **Tests:** 025 and 026 applied; **419 tests** pass locally and on staging. Four deliberate
  breaks were each caught: the matcher ignoring cohorts, forgetting it ran, anyone reading a code,
  and joining ignoring team lock.
- **In the browser, as the test admin on #4:**
  - Random pool → "Switch to a team" → created Test Crew → made an invite link → invited Priya
    via search.
  - A request sent from Sam appeared on the open page **within about a second** (realtime).
    Accepted Sam, declined Jonah.
  - Left the team; the link page gave the right message in every case.
  - Joined Rockets by its invite link.
- **Matcher on #11:** teams locked at 3:24:32; by 3:24:40 the page had moved on by itself and
  showed the matched teams (Electric Falcons, Clever Builders; 6 people into 2 teams of 3).
  Running it twice more changed nothing.
- **Check-in on #6:** the button worked and shows the time.
- **Not checked in the browser:** the admin console's matcher summary and check-in highlight
  (they need the admin code). Mixing cohorts is proven by the SQL tests; the staging test members
  aren't in cohorts.

---

## 5d. Phase 5: the arena (migration 027)

### Database: `027_hackathon_arena_pulse.sql`
- **`hackathon_team_pulse`:** one row per team: `team_id, hackathon_id, activity_count,
  last_active_at, has_submitted, submitted_at, updated_at`. **Nothing else, by design:** a test
  pins the exact column list.
  - Readable by the arena's audience (`can_view_arena`); nobody writes it directly.
  - It's in realtime, so this is what spectators' live updates are made of.
  - A new team gets a quiet row (trigger on `hackathon_teams`); existing teams were filled in from
    their rooms.
  - Triggers keep it current:
    - Team messages (inserts, not system lines; edits and deletions don't count), docs (created
      or edited), links, votes and ballots each add 1 and set last active.
    - Submissions set "submitted" (and when).
- **`hackathon_arena_cohorts(id)`:** each team member → cohort name, for the arena's audience
  only. Cohort rosters stay private; cohort names were already readable by members.
- **Tests:** 17 new, and 3 deliberate breaks caught (the pulse readable by anyone, cohorts for
  anyone, system lines counting). The pulse table's place in realtime is a test too.

### Realtime: why the pulse table, and a bug found on the way
- **Why a table:** realtime sends whole rows, so subscribing to the room tables would put message
  text on a spectator's connection the moment a rule slipped. The pulse table has no text to leak.
- **Rejected:** polling `get_team_activity` every 30 s, because the pulse would lag up to 30 s.
- **The bug:** the browser's realtime socket joined **before the session loaded and stayed
  anonymous**, so RLS silently dropped every event. The channel still reported SUBSCRIBED.
  - **Fix:** `realtimeDb()` in `lib/hackathons/actions.ts` calls `realtime.setAuth(access_token)`
    before subscribing. The arena and the join queue's `QueueLive` use it.
  - Phase 4's "a request appeared within a second" was probably the 45 s refresh landing by
    coincidence.
  - The same pattern is used by 10 non-Hackathon components (messages, cohort chat,
    notifications, Collab room…). Flagged as a separate task; not changed here (Collab must stay
    identical without approval).

### App
- **`components/hackathon/Arena.tsx`** (client) and `arena.module.css`:
  - **Summary strip:** teams · builders · cohorts represented · "N of M teams submitted" (from
    kickoff; before that, open spots).
  - **Team cards:**
    - A large emblem in the team colour, the name, builder count and "matched".
    - Overlapping avatars (name and cohort on hover), first names underneath, cohort chips.
    - A wax-seal "Sealed" badge until the reveal.
    - Heat bars (hot < 5 min, warm < 30, quiet < 2 h, idle), "active X min ago", "Submitted ✓".
  - **Never on a card:** project name or anything from a room.
  - **Your team:** first, amber-edged, "Your team" + "Go to my team room →".
  - **Order:** the rest sorted by most recently active.
- **Motion:** a ripple when a team's pulse arrives, and a slow breathing ring while it's hot.
  Quiet teams are still; `prefers-reduced-motion` turns it all off.
- **Live data:** the arena subscribes to its Sprint's pulse rows while teams_locked, live or
  judging. There's a 60 s re-read as a backup, "X min ago" re-labels every 30 s on the server
  clock, and a team it hasn't drawn yet triggers a page refresh.
- **Layout:** stacks to one column under 640 px, and the stats go 2×2.
- **Mobile fixes along the way:**
  - The in-app countdown bar now shows the soonest one on phones and three elsewhere, with "+N
    more". The app's header rows are fixed and only the page scrolls, so every bar row was
    taking room from the arena.
  - The live countdown stays on one line on phones.

### Checked on staging (2026-09-30), signed in as the spectator
- **Pulses:** while the simulator posted every 5 s, the arena rippled 7 times in 35 s, without a
  reload.
- **Pages:** `/hackathon/5`, `/6`, `/7` (HTML and the app's data format) contain none of the
  sealed strings (room text, the live Sprint's submission, the judging Sprint's projects). The team
  room and lobby send the spectator back to the Sprint page.
- **Direct reads with the spectator's own client:** 0 rows from team messages, docs, links, votes,
  ballots, scores, invite codes, invitations and join requests. Submissions returned only the 2
  from the **revealed** Sprint #8, which are public by design.
- **Realtime:** while messages and a live submission were being written, the spectator's
  connection received **5 pulse events** (only the 7 pulse fields) and **0 message or submission
  events**.
- Checked as the admin too: none of the sealed strings are in the pages, even though admins may
  read the rooms. The arena simply never asks for them.

---

## 5e. Phase 6: the team room (migration 028)

### What the owner decided at the plan
- **Docs use the Vault's full editor**, shared rather than copied. The Collab room's "docs" are only
  a title and plain notes, so the brief's "docs with the full editor" meant the Vault's Tiptap
  editor.
- **Rooms stay writable until the reveal** (decision 12 kept). The brief said read-only from
  `ends_at`; the owner chose the reveal, so `can_write_team_room` is unchanged.
- **Quiet teammates:** flagged after **3 waking hours**, where night (11 pm – 7 am in their own time
  zone) doesn't count, and neither does time they marked "Sleeping until…".
- **Both refactors approved:** the Collab room's pieces and the Vault's editor, each proven
  identical.

### Database: `028_hackathon_team_room.sql`
- **`hackathon_team_member_activity`**, one row per person on a team: `last_active_at` (last
  contribution), `last_seen_at` (last time the room was open), `time_zone`, `sleeping_until`.
  - Readable by that team and admins (`can_read_team_room`); never spectators, judges or other
    teams. Nobody writes it directly. In realtime.
  - Rows follow membership (trigger on `hackathon_team_members`: join, leave, move). Backfilled.
  - Triggers credit the actor: messages (not system lines, edits or deletions), docs created or
    edited, links, votes, ballots. Any contribution ends a sleep still running.
- **`hackathon_room_seen(team, time_zone)`:** members only; at most once a minute; a zone the
  database doesn't know (`pg_timezone_names`) is ignored.
- **`hackathon_room_sleep(team, until)`:** members, while the room is writable; up to 12 hours ahead;
  `null` wakes them (and keeps the moment they woke, so quiet time counts from it).
- **Tests:** 45 new (**481** total), locally and on staging. Deliberate breaks caught: the table
  readable by anyone, system lines counting, "seen" without a membership check.

### Refactors (no Collab or Vault behaviour change)
- **`components/rooms/`**, moved unchanged out of `components/collab/ProjectRoomClient.tsx`:
  `RoomThread` (thread + composer), `RoomVotes` (decision cards + form), `RoomItemCard` /
  `DocIcon` (doc and link cards), `kit.ts` (styles and helpers). They take data and actions as
  props. Collab keeps its own queries, realtime, client-side closing and notes-plus-links docs.
- **`components/editor/RichTextEditor.tsx`:** `useRichEditor` (Tiptap setup, slash menu, Cmd/Ctrl+K,
  word count, read-only) and `EditorToolbar`, from the Vault's `NoteEditor`, which keeps its frame,
  title, tags and save.
- **Proof:** a temporary fixed-data page rendered the Collab room's three tabs and the Vault editor
  before and after; the HTML was **byte-identical** (checked again after the last change). Live on
  staging: a Collab project's message, link and decision (open → vote → closed); a Vault note
  (slash menu, checklist, autosave PATCH 200).
- **Found and fixed (owner approved, 2026-10-02):** the decision card said "Unanimous" whenever
  everyone had voted, even after a 2–1 split. Now, in both Collab and Sprint rooms, it says
  "Unanimous" only when everyone chose the winner, otherwise "2 of 3 votes".

### Routes
| Route | What |
|---|---|
| `/hackathon/[n]/team` | Redirects to your team's room; no team → the Sprint page with "You're not on a team in this Sprint". |
| `/hackathon/[n]/team/[slug]` | The room. Team members and admins; anyone else → the Sprint page with "That team room is private to its team". Slugs never change on rename, so links last. |
| `/hackathon/[n]/team/[slug]/submission` | A placeholder in Phase 6; the submission form since Phase 8 (section 5g). Same door as the room. |

The arena's "Go to my team room" now links straight to the slug. The admin console's teams tab has
"open room ↗" (admins read rooms; read-only).

### The room (`components/hackathon/room/`)
- **Header (`RoomHeader.tsx`):** emblem and name; the countdown for the state (respecting the
  admin's in-app countdown switch and headline); the theme from kickoff; the submission button
  ("Submit project" / "Edit submission" while live, "Opens at kickoff" before, "View submission ·
  Submissions closed" after) with its status, live from the team's pulse.
- **Members:** the app's online dot (`usePresence`), "Active 12 min ago" / "Seen …" / "Sleeping until
  7:00 AM", and while live a soft amber "Hasn't been active in 5 hours · seen 5 h ago" for a quiet
  teammate (never shown to anyone outside the team; never about yourself). Your own card has
  "Sleeping…" (2/4/6/8 hours, or until 7 am) and "I'm up". On phones the members are one swipeable
  row, yours first, so the room starts on the first screen.
- **Quiet logic:** `lib/hackathons/quiet.ts`, worked out in the browser on the server clock; nothing
  stored.
- **Tabs:** Thread · Docs · Links · Votes.
  - **Thread:** the Collab thread; your message shows as soon as it's saved.
  - **Docs (`TeamDocs.tsx`):** list, then the shared editor. Autosave a second after typing stops;
    saves are conditional on the version you started from (`updated_at`). A teammate's save
    reloads the doc if you have nothing unsaved; otherwise "Maya saved a newer version" → Keep
    mine / Load theirs. Stored as the editor's JSON in `content` (100,000-character limit, checked
    before saving). No live co-editing (would need a new library).
  - **Links (`TeamLinks.tsx`):** Collab's link cards; whoever added a link can remove it.
  - **Votes:** Collab's cards; the database closes them (decision 6), and the closing arrives live.
- **Live:** one realtime channel per room table filtered to the team (via `realtimeDb()`), plus
  unfiltered DELETE channels for docs and links (ids only), the activity table, the pulse (for the
  submission status) and team membership (refresh). Returning to the tab after 30 s re-reads it all;
  `SprintAutoRefresh` moves the page on at each phase boundary.
- **Read-only:** after the reveal, while paused or cancelled, and for admins: the composer, editor
  (no toolbar, `contenteditable=false`), New doc, Add link, Start a vote and Sleeping… disappear,
  with a note saying why. The database refuses regardless.
- **"Seen" heartbeat:** members only, on open and every 5 minutes while the tab is visible, with the
  browser's time zone.

### Checked on staging (2026-09-30)
- **As the spectator:** `/hackathon/6/team` and `/hackathon/6/team/rockets` go back to the Sprint
  page with the right note; no room text in what the browser received.
- **As the test admin on Rockets (#6, live), with Maya and Leo played by a staging-only script:**
  - Sent a message; Maya's reply appeared without a reload; both "Active just now" lines updated
    live.
  - Leo set 5 hours back → the amber quiet note appeared live; his next link cleared it.
  - Sleeping until 7:00 AM, then "I'm up".
  - Doc: created, typed, saved. Maya's edit reloaded it; Maya saving mid-typing raised the
    conflict; "Keep mine" saved mine (confirmed in the database).
  - Links: a bad URL refused in words; added one; Leo's arrived live; removed mine.
  - Vote: opened; Maya and Leo's ballots arrived live (2 of 3); mine closed it in the database →
    "✓ Alerts · 2 of 3 votes".
  - Moved the reveal a minute ahead: the open room switched to "Results are out" and locked itself
    within seconds, no reload.
  - Comets as admin: read-only, "Viewing as admin", its submission shown as Submitted ✓.
  - Phone width (375): no sideways scroll; members row; sleep menu not clipped; editor fits.
- **Not checked in the browser:** two real people in one doc at once (the conflict path was
  driven by a script); the admin console's "open room ↗" link (needs the admin code).

---

## 5f. Phase 7: the lobby (migration 029)

### What the owner decided at the plan
- **The lobby stays writable while paused** (decision 9 kept). The brief said no posting while
  paused; cancelled is read-only, as before.
- **The welcome note is a Sprint setting**, pre-filled for every Sprint and edited in the admin
  console, not a real message.
- **Messages are at most 1,000 characters.**
- **Milestones are posted without a cron** (Vercel Hobby): from page loads and the 30-second timing
  check, dated at the milestone, and "1 hour left" is skipped if it's already too late.

### Database: `029_hackathon_lobby.sql`
- **`hackathons.lobby_welcome`:** defaults to the brief's text (1,000 characters at most); copied
  by Duplicate. Read through `hackathon_lobby_welcome(id)`, which only answers the lobby's
  audience. It isn't on the public view.
- **Milestones:** `hackathon_lobby_messages.system_key`, unique per Sprint.
  `hackathon_post_lobby_milestones(id)` (service role only) posts whichever of `teams_locked`,
  `live` ("Sprint is LIVE — the theme is: …"), `one_hour_left`, `submissions_locked` and `results`
  are due, once each, on the Sprint's own clock (nothing while paused, nothing once cancelled),
  dated at the milestone.
- **Moved times:** a trigger on `hackathons` withdraws an announced milestone whose time is in the
  future again (an extended deadline), so it posts again at the new time and never says something
  that isn't true yet. Found on staging: a reseed (like an extension) left "Submissions are locked"
  showing during a live Sprint.
- **`hackathon_lobby_people(id)`:** name, avatar details, team and role (participant, judge,
  admin) for everyone the lobby shows. Lobby audience only.
- **Members' posts:** at most 1,000 characters; at most 5 in 15 seconds and 30 in 5 minutes;
  can't set `system_key`. Admins are exempt. (Security invoker, like the 019 guard, so it can
  tell a member's request apart from the server's.)
- **Moderation log:** an admin pinning, unpinning or deleting someone else's message from the lobby
  page (their own sign-in, not the console) is written to `admin_change_log` as "Test Admin (in the
  lobby)". Withdrawn milestones are logged as "Sprint times moved". Both put back any
  `hackathon.actor` an admin set in the SQL editor.
- **Tests:** 50 new (**531**). Deliberate breaks caught: milestones ignoring the clock, no rate
  limit, deletions not logged.

### App
- **`/hackathon/[n]/lobby`:** participants, accepted judges and admins. Anyone else goes back to
  the Sprint page with "The lobby is for the people in this Sprint".
  - **Pinned box:** the welcome note, then any pinned messages.
  - **Thread:** `RoomThread` with new opt-in props: each message shows the author's avatar, name
    and a tag (team with its badge, "Judge" or "Admin"), the time ("4m ago", the full time on
    hover). System messages are amber banners. Admins get Pin/Unpin and Delete under each
    message.
  - **Composer:** 1,000-character cap; the database's own messages (posting too fast) are shown.
  - **Read-only:** after `lobby_closes_at`, when cancelled, and for a lapsed participant after the
    reveal (decision 12), with a note saying why.
- **Live:** realtime on the Sprint's lobby messages (new, pinned, deleted), plus an ids-only DELETE
  channel for withdrawn milestones. The page refreshes itself an hour before the deadline and when
  the lobby closes; `SprintAutoRefresh` covers the phase boundaries.
- **Who posts milestones:** the Sprint page and lobby page on every load, and
  `/api/hackathons/[n]/timing` (every open Sprint page asks it every 30 s; edge-cached 30 s).
- **Admin console:** the Sprint form has a "lobby → welcome note" field (blank hides it). The
  existing Lobby tab still pins, unpins and deletes.
- **Collab unchanged:** the fixture check gives byte-identical HTML again (with "N days ago"
  normalised, since the fixture's dates aged two days).

### Checked on staging (2026-10-02), signed in as the test admin (on Rockets, #6)
- The welcome note pinned on top; Priya and Sam (Comets, played by a staging-only script) appeared
  live with avatars and a "Comets" tag; my reply sent from the composer.
- Pinned Priya's message (it moved into the pinned box) and deleted Sam's ("Message deleted"); both
  are in the change log as "Test Admin (in the lobby)".
- Milestones, live, without reloads: moved the deadline to 61 minutes out → "1 hour left" a minute
  later (3 s after its moment); deadline to 1 minute → "Submissions are locked" 3 s after it;
  reveal to 1 minute → "Results are in!" 4 s after it. Staging holds exactly one of each.
- A reseed that moved the times back withdrew the stale "Submissions are locked" from the open page.
- Phone width (375): no sideways scroll; the composer is in view; the banners read well.
- **Not checked in the browser:** the spectator being kept out (the pane is signed in as the test
  admin; the database tests cover it, and the page check is the one the placeholder already had);
  the rate limit from the UI (the test admin is exempt; the database tests cover it); the admin
  console's welcome-note field (needs the admin code).

---

## 5g. Phase 8: the submission form (migration 030)

### What the owner decided at the plan
- **Drafts stay with the team.** Judges (from the deadline) and the public (from the reveal) only
  ever see complete submissions; a draft and its screenshots stay sealed for good.
- **Co-editing merges by field:** each autosave sends only the fields you changed; teammates'
  changes appear live in fields you haven't touched; same field at once, last save wins.
- **Markdown:** the app's own renderer, extended with links and numbered lists (no library).
- **Preview:** an overlay over the form, including unsaved changes.

### Database: `030_hackathon_submission_drafts.sql`
- `project_name` is optional. New: `is_complete` (set by the guard on every write: name, tagline,
  problem, plus a demo URL, a video URL or a screenshot), `completed_at` (when it last became
  complete), `last_edited_by` (beside `updated_at`). The guard also trims text and turns emptied
  fields into missing ones. Nobody can set `is_complete` directly.
- **The deadline is 020's trigger, unchanged:** members' inserts and updates are refused outside
  live (and while paused); storage writes follow `can_write_submission`.
- `can_read_submission`: team and admins always; judges and the public only for complete
  submissions (and so only those screenshots, through the storage policy).
- **"Submitted" means complete:** the arena's pulse (`has_submitted`, `submitted_at` =
  `completed_at`) and `get_team_activity`. Emptying a required field takes it back to a draft.
- `hackathon_submissions` is in realtime (the read policy applies).
- **Backfill** of existing rows runs with the guard, audit (021) and pulse triggers switched off,
  so it moves no `updated_at`, bumps no pulse and writes no audit entries.
- **Tests:** 29 new (**560**); older fixtures that saved only a name were made complete.
  Deliberate breaks caught: drafts readable by judges and the public, every save counting as
  complete, the pulse marking drafts submitted.

### App
- **`/hackathon/[n]/team/[slug]/submission`** (team members and admins; others go back to the
  Sprint page). Members edit while live; otherwise read-only with a note (opens at kickoff,
  paused, locked after the deadline, admin view).
  - **Status card:** Draft / Submitted ✓, "Last edited by Maya · <time>", the save state, the
    four-point checklist, and "Preview the reveal".
  - **Fields:** name (80), tagline (140), problem, description (Markdown), demo, video and repo
    URLs (checked; an invalid one isn't sent), screenshots, built-with tags (20).
  - **Screenshots:** up to 6; shrunk in the browser (`prepareScreenshot`: ≤ 1920 px, WebP or
    JPEG, under 5 MB; GIFs kept if they fit), uploaded to the team's folder, shown through signed
    URLs; drag or arrows to reorder; removing deletes the file.
  - **Labels:** a global `label` style (mono, lower case) is undone with `LABEL_RESET`.
- **Autosave:** 1.5 s after typing stops (at once for screenshots and tags, and on leaving a
  field); only changed fields; an insert that loses a race to a teammate becomes an update.
- **The deadline:** pending changes are saved 5 s before; the form locks at the deadline on the
  server clock; a save the database refuses shows "The deadline passed before your last changes
  saved. Not saved: Description", with "Copy my unsaved text".
- **Warnings:** `DeadlineWarning` from an hour out ("Less than an hour left") and urgent from 10
  minutes ("9 minutes left"), while not complete, on the form and in the team room (with "Finish
  it").
- **Showcase:** `components/hackathon/showcase/ProjectShowcase.tsx`, the project page Prompt 10
  will reuse: name, tagline, links, the video embedded (YouTube via youtube-nocookie, Loom,
  Vimeo) or the first screenshot, the problem, the description, screenshots, built with, the team.
- **Elsewhere:** the team room says "Finish submission · Draft in progress"; the admin console
  shows "draft: …" vs "submitted: …" and counts complete submissions only.

### Checked on staging (2026-10-02), as the test admin on Rockets (#6)
- Autosave ("Saving…" → "All changes saved"); "Last edited by Test Admin"; values back after a
  reload.
- Maya's edit (by script) of the problem appeared live; the description I'd typed was kept.
- A 3000×2000 PNG (2.7 MB) uploaded as a 257 KB WebP; the submission turned Submitted ✓ and the
  arena's pulse followed.
- **Sealed:** signed out, the screenshot's download and signed URL were refused, its public URL
  gave 400, and the submission row read returned 0 rows.
- Preview: the showcase over the form, Markdown heading, numbered list and link rendered.
- Maya emptied the tagline with the deadline 9 minutes out: back to Draft, and "9 minutes left"
  on the form and in the team room, live.
- **The deadline:** an edit 1.2 s before it was refused; the form locked and named the unsaved
  field. Then, from the browser with the member's own session, a direct PATCH to the API was
  refused (400, "The submission deadline has passed.") and so was a direct storage upload
  (row-level security).
- Phone width (375): no sideways scroll.
- **Found on the way:** the pane holds a production Supabase session cookie as well as staging's
  (localhost once ran the production-pointed app). Nothing used it; the direct-API check
  only reads the cookie of the project the page was built for, and refuses anything but staging.
- **Not checked in the browser:** "Copy my unsaved text" (the pane can't use the clipboard), a
  judge's and the public's view after the reveal (the database tests cover both; Prompt 10 builds
  the pages).

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
| 34 | No per-minute cron while on Vercel Hobby. The matcher runs when the Sprint page loads after team lock, and from the admin button; the cron route is ready for Pro. | Owner is on Hobby, where a cron running more than once a day fails the deploy. |
| 35 | Switching between random pool and a team ends at team lock; withdrawing stays open until kickoff. | Owner OK'd; a no-show can still drop out, and their team just gets smaller. |
| 36 | Name, emblem and colour can change until the submission deadline, by the owner or any member of a matched team; who's on a team locks at team lock. | The brief wanted owner renames until lock and matched teams renaming while live. Owner OK'd. |
| 37 | Inviting uses its own member search over `profiles.skills`; the Collab skills index is untouched. | It's private inside the Collab Board; reusing it needs a refactor. Owner OK'd. |
| 38 | The matcher also places people who chose "team" but never found one. | Otherwise they'd be stranded at team lock. |
| 39 | Anyone approved can be invited; whether they can take part is checked when they accept. | Inviting must not reveal who pays (decision 1). |
| 40 | An invite code is itself the invitation: it works even if the team is closed to requests. | The owner chose to share it. |
| 41 | A single leftover with nowhere to go is flagged for an admin, not added to a closed team. | Respects teams that chose to be invite-only. |
| 42 | Past the deadline, the matcher records "skipped" and matches nobody. | Matching then is pointless, and it stops the matcher running again and again for that Sprint. |
| 43 | Arena live updates come over realtime from a pulse table of counts and times, not the room tables, and not polling. | Sealed by construction, and the pulse reacts at once. Owner OK'd. |
| 44 | Arena cards show each member's cohort name, from a function limited to the arena's audience and to people on teams. | The brief asks for cohorts; rosters stay private. Owner chose names over anonymous labels. |
| 45 | Motion only on activity (a ripple, a glow while hot), none when quiet or with reduced motion. | Reconciles "static finish" with the brief's animated pulse. Owner OK'd. |
| 46 | Realtime subscriptions set the member's token explicitly first (`realtimeDb`). | Without it the socket stayed anonymous and RLS dropped every event. |
| 47 | The in-app countdown bar shows 1 row on phones and 3 elsewhere, with "+N more". | The app's header rows are fixed, so every row shrank the page; it hurt the arena on phones. |
| 48 | Team rooms stay writable until the reveal, not until `ends_at` as the Phase 6 brief said. | Owner, at the Phase 6 plan (decision 12 kept). |
| 49 | Team docs use the Vault's full editor, shared through `components/editor/`; the Collab room's pieces are shared through `components/rooms/`. Both refactors are proven byte-identical. | The Collab room has no rich editor. Owner approved both refactors. |
| 50 | A quiet teammate is flagged after 3 waking hours: their own 11 pm – 7 am doesn't count, nor does time marked "Sleeping until…" (up to 12 h). | Owner: "unless sleeping"; chose both night hours and the button. |
| 51 | Room docs: last save wins, with a conditional save and a Keep mine / Load theirs choice; no live co-editing. | Co-editing needs a new library (e.g. Yjs); not asked for. |
| 52 | Per-member activity is its own table, readable by the team only, not columns on `hackathon_team_members`. | Team rosters are readable by the arena's audience; when teammates are active or asleep is the team's business. |
| 53 | "Unanimous" only when everyone chose the winner, in Collab and Sprint rooms alike. | It said so whenever everyone had voted, even after a split; the owner approved changing Collab too. |
| 54 | The lobby stays writable while paused, not read-only as the Phase 7 brief said. | Owner, at the Phase 7 plan (decision 9 kept). |
| 55 | The lobby's welcome note is a per-Sprint setting with the brief's text as its default, read only by the lobby's audience. | Owner chose a setting over a real message; copied by Duplicate. |
| 56 | Lobby messages: 1,000 characters; 5 per 15 s and 30 per 5 min per person; admins exempt. | Owner chose the length; the rate is "simple" per the brief. |
| 57 | Milestone messages are posted by an idempotent database function called from page loads and the 30 s timing check, dated at the milestone; "1 hour left" is skipped if late. | No per-minute cron on Hobby. Owner OK'd. |
| 58 | An announced milestone whose time moves back into the future is withdrawn, and posts again at the new time. | Extending the deadline (decision 19) must not leave "Submissions are locked" up while they're open. |
| 59 | Admin moderation from the lobby page itself is written to the admin change log. | 022's log skips members' own sign-ins; moderation should be logged wherever it happens. |
| 60 | A submission is a draft until complete (name, tagline, problem, and a demo, video or screenshot); the database decides. | The brief's "required to count as submitted", with autosave. |
| 61 | Drafts never leave the team: judges and the public see complete submissions only, screenshots included. | Owner, at the Phase 8 plan. |
| 62 | Teammates' edits merge by field; same field at once, last save wins. | Owner, at the Phase 8 plan. |
| 63 | The description is Markdown through the app's own renderer, extended with links (http/https only) and numbered lists. | Owner: no new library. |
| 64 | Screenshots are shrunk in the browser with a canvas (≤ 1920 px, WebP or JPEG, < 5 MB). | Brief asks for client-side compression; no library. |

---

## 7. Open items and later prompts

**To do before deploying anything:**
- [ ] Paste migrations **018 → 030** into the production SQL editor, in order, before the deploy
      that needs them. The landing page and in-app bar tolerate their absence; the admin sections
      and the Hackathon tab don't. Without 024 the "who's registered" list is just empty, without
      027 the arena has no pulse or cohorts, without 028 the team room has no activity, quiet
      notes or sleep, without 029 the lobby page fails to load (it reads `system_key`), and without 030 the
      submission page and team room fail (they read `is_complete`).
- [ ] If the owner moves to Vercel Pro: add the per-minute cron for `/api/cron/hackathon-matcher`
      to `vercel.json` (see section 5c).
- [ ] Push the branch when the owner says, and set up Vercel Preview env vars for staging when the
      owner is ready.

**Later prompts (from the brief):**
- Judging (Prompt 9): judges read complete submissions only (030); the scores table and its
  window exist (020).
- Public project pages (Prompt 10/11): reuse `ProjectShowcase`; screenshots need signed URLs.
- **Prompt 10:** the reveal gallery (replace `GallerySlot` in `components/hackathon/RevealGallery.tsx`).
- **Prompt 9:** external judge accounts. Link `invite_email` judges to accounts, and build decision
  14 (judge-only accounts never counted as founding seats and never placed in a cohort).

**Known gaps and ideas, not yet built:**
- **From Phases 6–8, not built or not checked:**
  - Team room and lobby messages can't be edited in the UI (the database allows it); lobby
    authors can't delete their own either; admins can't pin system lines from the lobby page.
  - Team docs: last save wins with a "Keep mine / Load theirs" choice; no live co-editing (would
    need a library such as Yjs). Content is capped at 100,000 characters of editor JSON.
  - Lobby milestones: a time moved *earlier* after its milestone posted keeps the old timestamp;
    editing the theme after kickoff doesn't update the "Sprint is LIVE" line.
  - Submission screenshots: two teammates uploading at the same moment can drop one from the list
    (field-level last save wins; the file is orphaned). Removing a screenshot deletes the file at
    once, even if that save then fails. Signed URLs last an hour, so an open form older than that
    shows broken images until reloaded.
  - Not checked in the browser: the spectator kept out of the lobby (database tests cover it),
    the lobby rate limit from the UI (admins are exempt), the admin console's welcome-note field
    and "open room ↗" link (need the admin code), "Copy my unsaved text" (no clipboard in the
    pane), and what judges and the public see after the reveal (database tests; Prompt 10 builds
    the pages).
- **Collab thread:** your own message only appears after a reload, because the Collab room waits
  for its realtime echo and its socket is anonymous (the realtime lead below). Pre-existing;
  unchanged by the refactor.
- Team room messages can't be edited or deleted in the UI yet (the database allows the author to;
  the Collab thread has neither, and the room matches it).
- **Realtime elsewhere in the app** (lead, flagged as a separate task): 10 non-Hackathon components
  subscribe without setting the member's token, and may be missing live updates for RLS tables.
  The Collab ones need the owner's approval to change.
- Staging's cohorts are auto-named (e.g. "cohort_1790441332626"), so cohort chips look raw there;
  real cohort names will read better.
- Invited judges see a note on the Sprint page but can't accept yet (`hackathon_accept_judge_invite`
  exists; the button comes with the judging tools).
- Resuming a paused Sprint doesn't bring the nav's LIVE label back until the next page load
  (the open Sprint page itself updates within 30 s).
- Emails: nothing sends Sprint emails yet ("scheduled emails follow the Sprint's times" is a
  design promise to keep).
- Notifications aren't sent yet (Prompt 12): join requests and answers, invitations, and "you've
  been matched". The matcher's report holds what the matched-team message needs.
- `min_team_size` is stored but not enforced; the matcher can make a team of 2 from leftovers.
- The admin console's matcher summary and check-in highlight haven't been checked in the browser
  (they need the admin code).
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
| `6ce6407` | Phase 3 approved; record its commit |
| `47cdf9d` | Registration and teams, the team matcher, kickoff check-in (025–026) |
| `8287dcb` | Record the Phase 4 commit |
| `785a37c` | The arena, live and sealed by design (027) |
| `8ef8388`, `2ac37b8` | Record the Phase 5 commit; start-here handoff |
| `a1652f8` | The team room: thread, docs, links, votes, who's active and who's asleep (028) |
| `e2e386b` | "Unanimous" only when everyone chose the winner (Collab and Sprint rooms) |
| `fa5e4ae` | The Sprint lobby, with milestones posted exactly once (029) |
| `9060636` | Record the Phase 7 commit |
| `5ba01ab` | The submission form, with drafts, autosave and a hard deadline (030) |
| `821a0b1` | Record the Phase 8 commit |
