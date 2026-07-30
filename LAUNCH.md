# Quorum — Launch Plan

> Working document. Check items off as they land. Written 2026-07-30, after the
> six launch blockers were fixed and deployed (`main` @ `2605f8b`, migration 014
> applied). Everything below is what remains.

---

## 1. How to read this

The flat checklist at the end is the complete inventory. The phases are the
*order*, and the order matters more than the inventory does — four items block
other items, and doing them late costs days of waiting rather than hours of work.

**The four constraints that set the sequence:**

1. **The domain blocks five other things.** SMTP DKIM records, the Vercel domain
   binding, Supabase's redirect allow-list, the Stripe webhook endpoint, and
   `NEXT_PUBLIC_APP_URL` all need it. Buy it first, before any branding polish is
   finalized — the name can be decided independently of the DNS existing.

2. **Legal pages gate a waiting period.** Stripe inspects the live site for Terms
   and Privacy during account activation, and activation is not instant. These
   feel like the most deferrable items on the list and are actually the ones that
   unblock the longest wait.

3. **The config cutover is atomic.** `NEXT_PUBLIC_APP_URL`, the Supabase Site URL
   + redirect allow-list, and the Stripe webhook endpoint must move to the new
   domain together. Changing one without the others breaks auth emails or
   webhooks in the gap.

4. **Nothing generates revenue for 30 days.** The trial is card-free and 30 days
   long (45 if referred). First charges land a month after first signups, and
   only for people who convert. Plan cash and expectations against that, and see
   §4 for the trial-expiry gap that directly threatens the conversion.

---

## 2. Division of labor

Every item below is tagged:

| Tag | Meaning |
|---|---|
| **[me]** | Claude can do this end to end — code, config files, scripts, docs |
| **[me → you]** | Claude prepares it; you apply it (SQL to paste, a script to run, a dashboard setting to flip) |
| **[you]** | Only you can do this |

### The hard lines — things Claude will not or cannot do

These aren't preferences, so don't plan around them changing:

- **Creating accounts.** Resend, Postmark, Sentry, the domain registrar, Stripe
  activation — all you. Claude does not create accounts or authenticate as you.
- **Entering credentials anywhere.** API keys, secret keys, bank details, card
  numbers. Claude never handles a live secret. Scripts Claude writes read from
  *your* environment; you supply the value.
- **Purchases.** The domain, any paid tier of SMTP or monitoring, and the live
  test checkout in Phase 6.
- **Executing SQL against your database.** This is a technical limit, not a
  policy one: the service-role key only reaches PostgREST, which doesn't run
  arbitrary SQL. Every migration is a paste into the Supabase SQL editor by you.
  Claude *can* verify one applied afterward with a read-only RPC probe.
- **Dashboard configuration.** Supabase, Stripe, and Vercel dashboards are yours.
  Claude can tell you the exact setting and the exact value; it cannot click it.

### What Claude can do that may not be obvious

- **Push to `main` and trigger a Vercel deploy** — with your say-so each time.
- **Verify production over HTTP.** Route probes, redirect checks, migration
  markers via PostgREST, response codes. This is how the last deploy was
  confirmed.
- **Write scripts you run against live Stripe.** For several Phase 3 items this
  beats clicking through the dashboard — the script is reviewable, repeatable,
  and can't fat-finger a price. You run it; your key never leaves your machine.
- **Draft the legal pages.** With a caveat — see Phase 0.

---

## 3. Phases

### Phase 0 — start the long poles (do today)

Nothing here depends on anything else, and three of them start clocks that run
without you.

- [ ] **[you]** **Buy the domain.** Everything downstream needs it.
- [ ] **[you]** **Begin Stripe live activation** — business details, bank
      account, identity verification. Can sit in review while you do the rest.
- [ ] **[me → you]** **Terms of Service, Privacy Policy, refund/cancellation
      policy.** Claude can draft all three to a solid first-pass standard, and
      wire them into the footer, pricing page, and signup. **But treat the draft
      as a draft.** These are legally binding documents describing how you handle
      other people's data, and Claude is not a lawyer. Read them, and get a
      professional review if you're taking EU users or expect to raise.
- [ ] **[me]** **Fix the PKCE cross-device error message** (see §5) — small, and
      it's a real support ticket on launch week.
- [ ] **[you]** Decide §4a (trial notification) and §4b (admission cadence).
      Both change what gets built in later phases.

### Phase 1 — infrastructure cutover (once DNS resolves)

- [ ] **[you]** Add the domain to Vercel; confirm HTTPS.
- [ ] **[you]** **Custom SMTP** — create the Resend or Postmark account, verify
      the sending domain (SPF/DKIM DNS records), and put the credentials into
      Supabase. Without this, the password reset flow that is *already deployed*
      silently delivers nothing.
- [ ] **[me → you]** Supabase auth email templates — they say "Supabase" by
      default, not Quorum. Claude can write the HTML for confirmation, recovery,
      and magic-link; you paste them into the dashboard.
- [ ] **[you]** **The atomic cutover** — all three in one sitting:
  - [ ] `NEXT_PUBLIC_APP_URL` in **Vercel's** env vars (not just `.env.local`)
  - [ ] Supabase → Auth → URL Configuration → Site URL + redirect allow-list
  - [ ] Stripe webhook endpoint → `https://<domain>/api/webhooks/stripe`
- [ ] **[you]** **Turn on "Confirm email"** in Supabase Auth. Safe now that
      migration 014's `handle_new_user()` trigger creates the profile without
      needing a session.
- [ ] **[you]** Confirm every env var exists in Vercel production, not only
      locally. **[me]** can produce the definitive list to check against.

### Phase 2 — Stripe live mode (once activated)

- [ ] **[you]** Swap to `sk_live_` / `pk_live_` in Vercel env vars
- [ ] **[me → you]** Recreate all four prices in live mode — test-mode IDs do not
      carry over: `MEMBER`, `MEMBER_ANNUAL`, `FOUNDING`, `PARTNER`. Claude can
      write a script that creates all four from `lib/pricing.ts` so the numbers
      can't drift from the app; you run it with your live key.
- [ ] **[you]** New webhook signing secret (`STRIPE_WEBHOOK_SECRET`) — the test
      secret will not validate live events
- [ ] **[me → you]** **Run `scripts/create-stripe-coupons.ts` against live.**
      Script already exists; you run it. Four coupons (`QUORUM_MONTHLY_FREE`,
      `_30`, `_20`, `_10`). `lib/referral-bonus.ts` attaches them by hard-coded
      ID — without them every referral bonus fails silently and the referrer just
      keeps paying full price.
- [ ] **[you]** Public business information: name, logo, support email — this is
      what makes the billing page and receipts say Quorum instead of your
      personal name
- [ ] **[you]** Statement descriptor — what appears on the cardholder's statement
- [ ] **[you]** Configure the **Customer Portal in live mode**.
      `/api/subscription` calls `billingPortal.sessions.create`, which 400s if the
      portal was only ever configured in test.
- [ ] **[you]** Decide on Stripe Tax if you'll take EU/UK customers

### Phase 3 — operational safety net

Do this before announcing. These are the things whose absence you only notice
once something has already gone wrong.

- [ ] **[me → you]** **Deploy the 3 edge functions and schedule them.** The cron
      expressions exist only as comments in the source. Claude can write the
      `pg_cron` SQL; you paste and run it, and deploy the functions.
  - `expire-trials` — hourly (`0 * * * *`)
  - `check-referral-activity` — daily 2am UTC (`0 2 * * *`)
  - `nudge-pending-referrals` — daily 10am UTC (`0 10 * * *`)
- [ ] **[you]** Enable database backups / PITR
- [ ] **[me → you]** Error monitoring. Claude installs and wires the Sentry SDK;
      **[you]** create the account and supply the DSN as a Vercel env var.
      Webhook and entitlement failures currently `console.error` into Vercel logs
      and nowhere else — you will not know a webhook is failing.
- [ ] **[me]** Rate limiting. Nothing has any. Highest priority:
      `/api/admin/verify`, which accepts unlimited guesses against a single
      static passphrase.
- [ ] **[me → you]** Verify migrations 001–014 are all applied to production.
      Claude can write probe queries for each; 014 is already confirmed, the rest
      are assumed and there's no `config.toml` to check against.

### Phase 4 — the storefront

Almost entirely Claude's, and it's what to build *while waiting* on Stripe
activation and DNS.

- [ ] **[me]** **Public landing page.** `/` currently redirects straight to
      `/login`, so the new domain shows a bare login box with no explanation of
      what Quorum is or why it costs $39/mo. For a product whose pitch *is* the
      filter, this is the highest-leverage item in this phase. Claude builds it;
      **[you]** own the positioning and copy decisions.
- [ ] **[me]** `error.tsx`, `not-found.tsx`, `global-error.tsx`
- [ ] **[me]** `public/` directory: `robots.txt`, OG image
- [ ] **[me]** `metadataBase` + `openGraph` in the root layout — links shared to
      Twitter, LinkedIn, or Slack currently render as a bare URL
- [ ] **[me → you]** Analytics — Claude wires it, you create the account

### Phase 5 — docs drift (anytime, low risk)

- [ ] **[me]** README still describes "part 1: auth + waitlist" on Next 14 — ~105
      commits stale
- [ ] **[me]** `.env.local.example` missing `STRIPE_MEMBER_ANNUAL_PRICE_ID` and
      `STRIPE_FOUNDING_PRICE_ID`, both required by `lib/plans.ts`
- [ ] **[me]** Next 16 deprecated the `middleware` convention in favor of `proxy`
- [ ] **[me]** Dead code: `isAdminUnlocked()` on the profile page (see §5)

### Phase 6 — production test pass (the gate)

Do not announce until every one of these passes **on the real domain**. Mostly
yours, because most of them need a real inbox or a real card.

- [ ] **[you]** Full signup, with email confirmation on, from a clean browser
- [ ] **[you]** Password reset end to end — including clicking the link on a
      *different device* than the one that requested it
- [ ] **[you]** A real checkout with a live card; confirm the webhook fires and
      the tier updates
- [ ] **[you]** Founding-seat claim stamps `is_founding_member` and decrements
      the pool
- [ ] **[you]** A referral: signup through a link, add a card, confirm the
      referrer's coupon actually attaches in Stripe
- [ ] **[you]** Account deletion → confirm the Stripe subscription genuinely
      cancels
- [ ] **[me]** Route-level and redirect verification over HTTP; migration marker
      probes; confirm the six fixed blockers hold in production

### Phase 7 — first week

- [ ] **[you]** Watch the Stripe webhook delivery log daily
- [ ] **[you]** Watch for trial-expiry churn (see §4a)
- [ ] **[you]** Approve waitlist signups on a predictable cadence (see §4b)

---

## 4. Two things that need a decision, not a checkbox

### 4a. The trial-expiry gap

The card-free trial exists **only in the `subscriptions` table**, not in Stripe.
That means `customer.subscription.trial_will_end` — the webhook that would warn
someone their trial is ending — never fires for trialing users. The only warning
is `TrialBanner`, which requires them to open the app.

So a founder who signs up, gets value, drifts for two weeks, and comes back on
day 31 finds themselves locked out with no warning having been sent. Your entire
first cohort is on that path, and it lands exactly when conversion is decided.

Options, roughly in order of effort:

1. **Email the trial warning yourself** — a scheduled function at T-7 / T-3 / T-1
   reading `trial_ends_at`. Needs the SMTP work from Phase 1 anyway.
   **[me]** builds it, **[you]** supply SMTP.
2. **Require a card at signup** and let Stripe run the trial natively. Fixes the
   notification for free and raises conversion, at the cost of signup friction —
   which for a deliberately filtered room may be a feature. **[me]** can
   implement; **[you]** decide.
3. **Accept it for the first cohort** and watch what happens, given the numbers
   are small enough to handle by hand. **[you]**.

### 4b. Cold start and the shape of admission

`WAITLIST_ENABLED = true`, so every signup waits for manual approval. Worth
keeping — but the *pattern* of approval matters more than the fact of it.

Cohorts cap at 12 and `assignUserToCohort` fills the oldest open cohort first. If
admissions trickle in continuously, early members sit in near-empty rooms, and an
empty room is the one thing this product cannot survive — the entire value
proposition is the other founders.

Batching admissions so a cohort fills in days rather than weeks is likely worth
more than any item in Phase 4. The waitlist is an asset here, not a chore: it
lets you hold people until there's a room worth joining.

**[you]** decides the cadence. **[me]** can build tooling for it — batch-approve
in the admin panel, or a "hold until N approved" flow — if you want it.

---

## 5. Reference: what was fixed on 2026-07-30

Shipped in `main` @ `2605f8b`; schema in `supabase/migrations/014_launch_privacy_and_auth.sql`.

| # | Was | Now |
|---|---|---|
| 1 | No password reset at all — a forgotten password was an unrecoverable account | `/forgot-password`, `/reset-password`, `/auth/callback` |
| 2 | Email confirmation broken in both positions; profile insert failed RLS with no session | `handle_new_user()` trigger creates the profile in the same transaction as the auth user |
| 3 | Deleting an account left the Stripe subscription live and billing | Billing torn down first; a Stripe failure aborts the delete |
| 4 | `check_ins` world-readable; anonymous check-ins rendered attributed by name | RLS withholds anonymous rows; cohort room filters them too |
| 5 | `handshakes` world-readable, exposing private `agreement` text | Restricted to the two parties; count preserved via `handshake_count()` |
| 6 | Any user could self-grant `tier='partner'`, `is_admin`, `status='approved'` | `BEFORE INSERT OR UPDATE` trigger clamps privileged columns on self-writes |

**Known follow-ups from that work:**

- **PKCE cross-device message.** `/auth/callback` passes Supabase's raw error
  through. Correct for most failures, bad for the common case of requesting a
  reset on desktop and clicking the link on mobile, which produces a developer-
  facing wall of text. Should say "open this link on the device you requested it
  from." **[me]**
- **Collab activity ticker degraded.** It listed recent handshakes across the
  community; now that handshake rows are private it only shows your own. If the
  ambient signal is wanted back, it needs the same `SECURITY DEFINER` treatment
  as `handshake_count()`. **[me → you]** — code plus a small migration.
- **Dead code.** `app/(app)/profile/[username]/page.tsx` calls
  `isAdminUnlocked()`, which reads a cookie nothing sets anymore (the admin panel
  moved to `localStorage`). The admin-only vault-nomination affordance on
  profiles is silently always-off. **[me]**

---

## 6. Open decisions

All **[you]**:

- **Partner tier** — "coming soon" in four places, but `/api/checkout` accepts
  `plan: "partner"` and the price ID is configured. Ship it or close the path.
- **Waitlist cadence** — see §4b.
- **Trial notification** — see §4a.
- **Landing page positioning** — Claude can build the page; the pitch is yours.

---

## 7. Operational notes

- **Migrations are applied by hand.** No `supabase/config.toml`, no CLI link —
  paste into the Supabase SQL editor. A multi-statement paste runs in one
  implicit transaction, so it's all-or-nothing.
- **Verify a migration applied** by calling one of its functions as an RPC
  through PostgREST. A 200 confirms it; `PGRST202` means it's missing.
- **Schema must land before the code that needs it.** Since 014, signup depends
  on `handle_new_user()` — deploying that code first breaks every new account.
- **Deploys** are triggered by pushing `main`; Vercel picks it up via the GitHub
  integration. There's no Vercel CLI or token configured locally.
