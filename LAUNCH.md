# Quorum — Launch Plan

> Working document. Check items off as they land. Written 2026-07-30, after the
> six launch blockers were fixed and deployed (`main` @ `2605f8b`, migration 014
> applied). Everything below is what remains.

---

## 0. Start here (context for a fresh session)

If you are picking this up cold, this is the state of the world:

- **What Quorum is:** a private, invite-gated community for founders. Twelve-seat
  cohorts, a weekly check-in rhythm, a pulse feed, a collab board, a vault, DMs,
  and referrals. Next.js 16 / React 19, Supabase (auth + Postgres + RLS +
  realtime), Stripe billing, deployed on Vercel.
- **Pricing:** $39/mo Member, $390/yr, $19/mo founding rate for the first 100
  seats, $99/mo Partner (not shipped). 30-day card-free trial, 45 if referred.
  There is no free tier — an unentitled account has a write limit of 0.
- **Where it runs today:** `https://quorum-app-kappa.vercel.app`. The launch
  domain **`quorumhq.co`** was bought 2026-07-31 through Vercel (Vercel is
  registrar, DNS, and host) and already serves HTTPS on the apex — but it is not
  yet the canonical URL. `NEXT_PUBLIC_APP_URL`, Supabase's Site URL, and the
  Stripe webhook endpoint all still point at the `.vercel.app` host until the
  Phase 1 atomic cutover.
- **Repo:** `main` is the deploy branch; Vercel auto-deploys from it via the
  GitHub integration (`krwalker721-cmd/Quorum-app`). No Vercel CLI or token is
  configured locally.
- **Status:** the six launch blockers in §5 are fixed, deployed, and verified in
  production. Migration 014 is applied. Nothing in this document is done yet.
- **Read §7 before touching the database or deploying** — the migration and
  deploy workflow here has a specific ordering requirement that will break signup
  if ignored.
- **Design language**, if any UI work comes up: dark, boxed tiles, amber as the
  single accent, green for live/positive only, mono micro-labels as seasoning.
  `design/REDESIGN-BUILD-GUIDE.md` is the authority; don't reintroduce a rainbow
  of accent colors.

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

- [x] **[you]** **Buy the domain.** Everything downstream needs it.
      ✅ `quorumhq.co`, bought 2026-07-31 through Vercel. Apex is bound and
      serving HTTPS. ~~`www.quorumhq.co` was not added and had no certificate.~~
      ✅ Resolved by 2026-09-12: `www` now 307-redirects to the apex with a valid
      certificate.
- [x] **[you]** **Begin Stripe live activation** — business details, bank
      account, identity verification.
      ✅ **Already active as of 2026-07-31.** Account status reads *active*; live
      keys are issued. Denyse Walker's identity verification was completed
      previously on this account. **Phase 2 is therefore not gated** — it can be
      done whenever, and two of its items should fold into the Phase 1 cutover
      (see the note at the top of Phase 2). Business website still to be set to
      `https://quorumhq.co`.

      **Which Stripe account (decided 2026-07-31):** Quorum uses the *existing*
      account `acct_1T75lURPXtW7MxMw`, originally created for a freelance
      business. Two things about it that will look wrong later without this note:

      - **The verified legal entity is Denyse Walker** — the owner's mother and
        business partner in Quorum. She is therefore the merchant of record: the
        1099-K, the payout bank account, chargeback liability, and Stripe's terms
        all attach to her, and *she* must be the one to complete any identity or
        verification step. Her identity verification is already done, which is
        the reason this account was kept. Account name, statement descriptor, and
        branding are display fields and are set to **Quorum**.
      - **The account is configured as a Connect *platform***, left over from the
        freelance setup. This is dormant and harmless with zero connected
        accounts — it does not affect subscriptions, checkout, the portal,
        webhooks, or payouts. If the setup guide demands a business model, choose
        **Platform**. Quorum needs no Connect functionality: referral rewards are
        Stripe *coupons*, not payouts, so no funds ever move to a third party.

      **Open:** confirm whether an accountant should weigh in on the partnership
      structure (sole prop under her SSN vs. a shared entity/EIN) before revenue
      starts. Cheap now, expensive to unwind after money moves.

      **Expect a snag:**
      reviewers look for pricing, Terms, Privacy, refund policy, and contact info
      on the live site, and `/` currently redirects straight to `/login`. That
      makes the legal pages *and* a minimal landing page more urgent than their
      phase numbers imply — a "need more information" response restarts the wait.
- [ ] **[me → you]** **Terms of Service, Privacy Policy, refund/cancellation
      policy.** Claude can draft all three to a solid first-pass standard, and
      wire them into the footer, pricing page, and signup. **But treat the draft
      as a draft.** These are legally binding documents describing how you handle
      other people's data, and Claude is not a lawyer. Read them, and get a
      professional review if you're taking EU users or expect to raise.
      **Decisions (2026-09-12):**
      - Legal party: **Denyse Walker, doing business as Quorum**
      - Governing law: **Massachusetts**
      - Refunds: **none** — cancel anytime, access runs to the end of the paid
        period (matches the Customer Portal's cancel-at-period-end setting)
      - **US-only at launch.** Enforced by the waitlist: approve US founders
        only for now. The privacy policy follows GDPR-compatible practice
        (access and deletion honoured for everyone) so adding EU/UK later is a
        new section, not a rewrite — but that section, plus Stripe Tax, must
        land *before* the first EU/UK approval.
      - Legal/privacy contact: the owner's personal Gmail as a stopgap, held in
        one constant so `support@quorumhq.co` is a one-line swap

      **Drafted 2026-09-12 (not yet deployed):** `/terms`, `/privacy`, and
      `/refunds` under `app/(legal)/`, all public — verified logged-out (HTTP
      200, content present, no console or server errors). Identity and contact
      live in `lib/legal.ts`; trial lengths, grace days, and founding seats are
      read from `lib/pricing.ts`, so the copy can't drift from the app. Wired in:
      an agreement line under the signup button, a links row on login and
      pricing, an auto-renewal notice on pricing, and — via `custom_text` in
      `/api/checkout` — the same notice directly above Stripe Checkout's
      Subscribe button. Also fixed along the way: the referral `CardForm` said
      "charged on day 31", which was wrong for 45-day trials, and now names the
      real date and price; the delete-account warning now says deletion cancels
      at once with no refund.
      **Reviewed against current law 2026-09-12 — see §8.** The review added a
      required signup checkbox (with the accepted Terms version and time saved),
      renewal consent on the referral card form (stamped onto the Stripe
      subscription), a Do Not Track paragraph, and a copyright-complaints
      section, and it fixed the price-change notice window to 7–30 days.
      **Still open before this item is done:**
      - ✅ **[you]** public contact address (`krwalker721@gmail.com`) and the
        choices baked into the Terms — founding rate only while continuously
        active, refunds if we terminate without cause or shut down, 7–30 day
        price notice, 14 days for material Terms changes, admins can see
        anonymous check-in authors — confirmed by the owner 2026-09-12. The
        pages weren't reviewed line by line by the owner.
      - ✅ **[you]** Stripe email settings from §8 turned on (2026-09-12,
        confirmed by the owner in the dashboard — those toggles aren't exposed
        through Stripe's API, so they couldn't be probed)
      - ✅ **[me]** deployed — merged to `main` as `651f6c8` on 2026-09-12. All
        six pages return 200 logged-out on `quorumhq.co` with the new content;
        the pricing notice and legal links verified in a real browser
      - ✅ **[you]** Terms and Privacy URLs added to Stripe's public business
        details and the Customer Portal (per owner, 2026-09-12)
      - **[me]** then require Terms acceptance inside Checkout
        (`consent_collection.terms_of_service`) — it errors unless Stripe has a
        Terms URL on file, so it can only follow the step above.
        *Written 2026-09-12 on branch `launch/checkout-consent`:* a required
        checkbox reading "I agree to the Terms of Service, including that my
        membership renews automatically until I cancel", with a Markdown link to
        `/terms`. **Done once deployed and the owner has clicked "Join" once and
        seen the checkbox** — that click is the only way to prove the Terms URL
        is on file in the mode production uses (still test keys), because
        session creation fails outright if it isn't
- [ ] **[you]** **File a Massachusetts business certificate ("DBA") for
      "Quorum".** Massachusetts requires anyone doing business under a name other
      than their own legal name to file a business certificate with the clerk of
      the city or town where the business is based (M.G.L. c. 110, § 5). The
      Terms will name "Denyse Walker, doing business as Quorum", so the filing
      should exist to back that up. It's done in Denyse's name, at her town
      clerk's office; fees are small and set by the town. Some banks also want
      it to accept payments made out to the business name.
- [ ] **[you]** **Turn on Stripe's trial-ending reminder email.** Referred
      members add a card and get a 45-day trial that converts to paid on its
      own, but the only warning today is an in-app notification from the
      `customer.subscription.trial_will_end` webhook. California's automatic
      renewal law requires notice before a free trial longer than 31 days
      converts, and a member who never opens the app gets none. Stripe can send
      the reminder itself: Settings → Billing → the subscription/customer
      emails section → the option to email customers before a free trial ends.
      One toggle. (The card-free standard trial never auto-charges, so it isn't
      affected — that gap is §4a, a conversion problem rather than a legal one.)
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
- [ ] **[you]** **Inbound email on the domain — `support@quorumhq.co`.** Separate
      problem from the SMTP item above: that one is *sending*, this one is
      *receiving*. Vercel is registrar and DNS but does not host mailboxes, so
      right now there is no address at `quorumhq.co` that can receive anything.
      Stripe puts the support address on receipts and in the billing portal, and
      it is also what a locked-out member will write to. A personal Gmail works
      as a stopgap and is changeable any time; before launch, either add a
      forwarding service (MX records into Vercel DNS) or Google Workspace at
      ~$6/mo. Decide which; neither is launch-blocking on its own.
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

### Phase 2 — Stripe live mode (~~once activated~~ — activation is done)

**Resequencing note, 2026-07-31.** Live activation turned out to be already
complete, so this phase is no longer blocked. But it splits in two:

- **Domain-independent — do any time, now if convenient:** the four live prices,
  the coupons script, business info, statement descriptor, branding, Customer
  Portal config, and the Stripe Tax decision. None of these care what the app's
  URL is.
- **Domain-coupled — must wait and land *inside* the Phase 1 atomic cutover:**
  swapping Vercel to live keys, and creating the webhook endpoint + secret. The
  endpoint has to point at `https://quorumhq.co/api/webhooks/stripe`, so creating
  it now against the `.vercel.app` host just means doing it twice.

Nothing is paying yet and the waitlist gates signup, so leaving production on
test keys until the cutover costs nothing.

- [ ] **[you]** Swap to `sk_live_` / `pk_live_` in Vercel env vars
      — **do this during the Phase 1 cutover, not before**
- [x] **[me → you]** Recreate all four prices in live mode — test-mode IDs do not
      carry over: `MEMBER`, `MEMBER_ANNUAL`, `FOUNDING`, `PARTNER`. Claude can
      write a script that creates all four from `lib/pricing.ts` so the numbers
      can't drift from the app; you run it with your live key.
      **Script: `scripts/create-stripe-prices.mjs`** — dry run by default, which
      also prints the account's public profile and branding so the dashboard
      items above get verified in the same pass; `--apply` creates. Idempotent
      (fixed product ids, price lookup keys). Run instructions are in its header.
      ✅ **Created in live mode 2026-09-12** on `acct_1T75lURPXtW7MxMw`, under
      products `quorum_member`, `quorum_founding`, `quorum_partner`. Price IDs
      are not secret; these go into Vercel during the Phase 1 cutover:

      ```
      STRIPE_MEMBER_PRICE_ID=price_1UEsuVRPXtW7MxMwEVtvBzSw          # $39/mo
      STRIPE_MEMBER_ANNUAL_PRICE_ID=price_1UEsuVRPXtW7MxMwAmVNiILO   # $390/yr
      STRIPE_FOUNDING_PRICE_ID=price_1UEsuVRPXtW7MxMwg3Jjgzyv        # $19/mo
      STRIPE_PARTNER_PRICE_ID=price_1UEsuWRPXtW7MxMw2ZlV7moC         # $99/mo
      ```

      **Scope them to Vercel's *Production* environment only.** Preview and
      Development should keep the test keys and test price IDs — otherwise any
      checkout tried on a preview deploy charges a real card. Leave
      `STRIPE_PARTNER_PRICE_ID` unset in Production unless Partner ships; that
      is what keeps its checkout path closed.
- [ ] **[you]** New webhook signing secret (`STRIPE_WEBHOOK_SECRET`) — the test
      secret will not validate live events — **during the Phase 1 cutover**
- [x] **[me → you]** **Run `scripts/create-stripe-coupons.mjs` against live.**
      ✅ **All four created in live mode 2026-09-12** on `acct_1T75lURPXtW7MxMw`:
      `QUORUM_MONTHLY_FREE` (100%), `_30`, `_20`, `_10`.
      Four coupons (`QUORUM_MONTHLY_FREE`, `_30`, `_20`, `_10`).
      `lib/referral-bonus.ts` attaches them by hard-coded ID — without them every
      referral bonus fails silently and the referrer just keeps paying full price.
      *2026-09-12:* the original `create-stripe-coupons.ts` could not run — its
      `npx ts-node` command fails on Node 26 with `Cannot find module
      '…/lib/stripe'`, because Node's native TypeScript handling rejects
      extensionless imports. Replaced by `create-stripe-coupons.mjs`: dry run by
      default, `--apply` to create, and it reads the coupon ids and amounts from
      `BONUS_TIERS` in `lib/referral-model.ts` rather than keeping a copy, so the
      coupons can't drift from what founders are promised. Key handling for both
      Stripe scripts is shared in `scripts/stripe-key.mjs`.
- [x] **[you]** Public business information: name, logo, support email — this is
      what makes the billing page and receipts say Quorum instead of your
      personal name
      ✅ *2026-09-12:* website `https://quorumhq.co` and logo verified by the price
      script; support email set afterwards (a personal Gmail as a stopgap — swap
      to `support@quorumhq.co` once the Phase 1 inbound-email item lands).
      **Follow-up:** the public name reads lowercase `quorum` and prints on
      receipts — confirm that's intended, or capitalise it.
- [x] **[you]** **Stripe → Settings → Branding**: logo, amber accent, background.
      Hosted Checkout *and* the Customer Portal both inherit it, so this is the
      cheap 90% of making billing feel like Quorum. See §4c.
      ✅ *2026-09-12:* accent `#f59e0b` and logo verified; icon set afterwards.
      Brand color is `#0d1117` (dark) rather than amber — it mirrors the app's own
      dark-background-plus-amber pairing and was kept deliberately.
- [x] **[you]** Statement descriptor — what appears on the cardholder's statement
      ✅ `QUORUM`, verified 2026-09-12.
- [x] **[you]** Configure the **Customer Portal in live mode**.
      ✅ **Saved in live mode 2026-09-12** with the settings below. Stripe's opt-in
      "next generation portal experience" was deliberately **left off**: it was
      undocumented in Stripe's portal docs and changelog as of that date, and
      swapping the billing surface right before launch is risk with no payoff.
      Revisit after launch, in a sandbox first.
      `/api/subscription` calls `billingPortal.sessions.create`, which 400s if the
      portal was only ever configured in test.
      **Settings (decided 2026-09-12)** — Settings → Billing → Customer portal:
      - Update payment methods **on**; invoice history **on**
      - Customer info: billing address **on**, email **off** (the Quorum login is
        the identity; keep one email on file), tax ID **off** until the Stripe
        Tax decision
      - Cancel subscriptions **on**, **at end of billing period** — the billing
        cards already render "Cancels <date>" from `cancel_at_period_end`;
        collect a cancellation reason; no retention offer
      - Switch plans **on**, products: **Quorum Member only** (the $39/mo and
        $390/yr prices). **Never add Quorum Founding or Quorum Partner.**
        `tierForSubscription` (`lib/entitlements.ts`) checks
        `metadata.plan` first and falls back to the price, and subscriptions
        made by the referral `CardForm` carry no `plan` — so for those members
        the price alone decides the tier. Offering Partner would let them
        self-upgrade to an unshipped tier; offering Founding would hand out
        the $19 rate without `claimFoundingSeat` ever running.
      - Quantities **off**; promotion codes **off**
      - Privacy and Terms links: **blank until the Phase 0 legal pages exist**,
        then fill in. Default redirect link blank — the app sets `return_url`
        per session. Skip the no-code login link.
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
- [ ] **[me]** **`/pricing` renders nothing without JavaScript in production.**
      Found 2026-09-12. `PricingBody` calls `useSearchParams()` under a
      page-wide `Suspense`, so the production build bails out of pre-rendering
      the whole page (the HTML carries Next's `BAILOUT_TO_CLIENT_SIDE_RENDERING`
      marker). The served HTML is an 8 KB shell with no heading, prices, or
      renewal notice. Browsers are fine (verified), but link previews, search
      engines, and any non-JS reviewer see an empty page. Fix: read the search
      param in a small child component inside its own `Suspense`, so the rest
      of the page prerenders.
- [ ] **[me → you]** Analytics — Claude wires it, you create the account

### Phase 5 — docs drift (anytime, low risk)

- [ ] **[me]** README still describes "part 1: auth + waitlist" on Next 14 — ~105
      commits stale
- [ ] **[me]** `.env.local.example` missing `STRIPE_MEMBER_ANNUAL_PRICE_ID` and
      `STRIPE_FOUNDING_PRICE_ID`, both required by `lib/plans.ts`
- [ ] **[me]** Next 16 deprecated the `middleware` convention in favor of `proxy`
- [ ] **[me]** Dead code: `isAdminUnlocked()` on the profile page (see §5)
- [ ] **[me]** **Favicon is the wrong amber.** `app/icon.svg` draws the logo mark
      in `#e8702a`, but the design token and `components/LogoMark.tsx` both use
      `#f59e0b`. Same mark, two different oranges depending on whether you're
      looking at the browser tab or the page.
- [ ] **[me]** **Billing cards still describe a free tier.**
      `components/ProfileBilling.tsx` (lines 42, 49) and
      `components/SettingsBilling.tsx` (lines 63, 71) show "Free tier" and "Free
      plan — read everything, post within limits", but there is no free tier — an
      unentitled account's write limit is 0. A lapsed member is told they're on a
      plan that doesn't exist, which undercuts the reason to resubscribe.

### Phase 6 — production test pass (the gate)

Do not announce until every one of these passes **on the real domain**. Mostly
yours, because most of them need a real inbox or a real card.

- [ ] **[you]** Full signup, with email confirmation on, from a clean browser
- [ ] **[you]** Password reset end to end — including clicking the link on a
      *different device* than the one that requested it
- [ ] **[you]** A real checkout with a live card; confirm the webhook fires and
      the tier updates. **Test both payment paths** — the hosted Checkout
      redirect *and* the inline `CardForm` on `/pricing`. They are separate code
      paths that write subscription state differently. See §4c.
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

## 4. Three things that need a decision, not a checkbox

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

### 4c. The billing surface — two payment paths already exist

Raised 2026-07-31: should members pay and manage billing *inside* Quorum rather
than being handed to Stripe? Partly already true, and that's the problem.

**There are two divergent payment paths in the codebase today:**

| Path | Where | Used by |
|---|---|---|
| **Inline Elements** — card entered inside Quorum | `CardForm` in `app/pricing/page.tsx`; `POST`+`PUT /api/setup-intent` | The referred free-month claim, only |
| **Hosted Stripe Checkout** — redirect to `checkout.stripe.com` | `app/api/checkout/route.ts` | `PaywallModal`, `SettingsBilling`, onboarding pricing |

The inline path creates a SetupIntent, confirms the card with
`stripe.confirmCardSetup`, then creates the subscription with a `trial_end`. The
card never leaves the domain. So the "own the checkout" work is ~80% built — it
is just scoped to one flow.

**The read:**

- **On checkout, the "looks more legit" argument is weak.** For an unknown brand
  charging $39/mo, Stripe's presence *reassures*. The real argument for going
  inline is continuity — no domain seam mid-flow — which is worth something for a
  product whose pitch is a curated room, but it is not a launch blocker.
- **On billing management, the argument is strong.** The Customer Portal is
  visibly Stripe's and generic. This is the piece worth owning.

**Recommended sequencing:**

1. **Before launch — do nothing in code.** Set logo, amber accent, and background
   in **Stripe → Settings → Branding**. Hosted Checkout *and* the Customer Portal
   both inherit it. Ten minutes, folded into the Phase 2 branding item.
2. **After launch — own the reads, delegate the writes.** Build a billing summary
   inside Quorum (plan, price, renewal date, trial countdown, referral coupon
   status, invoices) and keep mutations — change card, cancel, switch plan — going
   to the portal. Stripe handles proration, dunning, and failed-payment recovery
   correctly; that logic is where self-built billing quietly breaks.

**Hard line:** never put raw card `<input>` fields on a Quorum form. Card entry
stays inside Stripe's iframe (Elements, as today). That is what keeps this in PCI
**SAQ-A** instead of **SAQ-D**, which is a serious compliance burden.

**Two defects found while assessing this:**

- **`/api/setup-intent` (PUT) hardcodes `STRIPE_MEMBER_PRICE_ID`** — it always
  creates a Member *monthly* subscription regardless of the plan chosen. Harmless
  for the referral flow it was written for; a real bug the moment anything else
  routes through it. **[me]**
- **`CardElement` is Stripe's legacy API.** `PaymentElement` is current and adds
  Apple Pay, Google Pay, and Link — wallets lift conversion. Migrate when the
  billing page gets built, not before. **[me]**

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
- **Billing surface** — see §4c. Whether to converge on an in-app billing page or
  keep delegating to Stripe's hosted Checkout and Customer Portal.
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

---

## 8. Legal and compliance review (2026-09-12)

Claude checked the legal drafts against current law on 2026-09-12, from primary
sources where it could reach them. **This is research, not legal advice** — re-check
anything load-bearing before relying on it.

### What applies, and what it requires

| Law | What it requires of Quorum | Status |
|---|---|---|
| **940 CMR 38.05** (Massachusetts, recurring charges & trials) | Clear written disclosure *before* acceptance of the charge, the cancel deadline, and the date charges begin; notice **5–30 days** before a trial converts; for billing periods ≤31 days, a notice with **every charge** (amount + how to cancel); for longer terms, notice **5–30 days** before renewal; cancellation as easy as signup, same medium | Disclosures ✅ (CardForm, Checkout, pricing). Notices need the **Stripe settings below** |
| **Cal. Bus. & Prof. Code § 17602** (California ARL, amended by AB 2863, eff. 2025-07-01) | Terms in visual proximity to consent; **affirmative consent**, with proof kept **3 years** (or 1 year after termination); post-purchase acknowledgment with renewal terms + how to cancel; trial >31 days: notice **3–21 days** before it ends; **annual reminder**; price-change notice **7–30 days** ahead; online cancellation | Consent ✅ (checkboxes; referral consent stamped on the Stripe subscription). Checkout consent record — **after deploy**, below. Price-change wording fixed to 7–30 days |
| **New York** (amended, eff. 2025-11-05) | Trial >31 days: notice 3–21 days before paid period | Covered by Stripe's 7-day trial reminder |
| **Maryland** (eff. 2026-06-01) | Trial >14 days: notice 3–21 days before; terms ≥1 year: 15–45 days before renewal | Covered by the 7-day trial reminder and a **30-day** renewal reminder |
| **Utah** | Trial: ≥3 days' notice; terms >45 days: **30–60 days** before renewal | 30-day renewal reminder is the one value that satisfies MA (5–30), MD (15–45), and UT (30–60) at once |
| **Minnesota** | Annual notice of terms and how to cancel | Monthly receipts with a manage/cancel link *probably* cover this — lawyer question |
| **ROSCA** (federal) — the FTC's click-to-cancel rule was vacated by the 8th Circuit in July 2025, but ROSCA still applies | Clear disclosure, express informed consent, simple cancellation | ✅ |
| **Kauders v. Uber**, 486 Mass. 557 (2021) | Online terms bind only with reasonable notice *and* a reasonable manifestation of assent; the SJC strongly prefers a checkbox/"I agree" | Signup now requires a checkbox; the Terms version and time accepted are saved in `auth.users.raw_user_meta_data` |
| **CalOPPA** (Cal. Bus. & Prof. Code § 22575) | Privacy policy must say how the site responds to **Do Not Track** and whether third parties track across sites | Added to the Privacy Policy |
| **M.G.L. c. 110, § 5** | Business certificate ("DBA") for trading under a name other than your own; fines up to **$300 per month** of non-compliance; valid 4 years | **[you]** — Phase 0 item |
| **Massachusetts sales tax** (830 CMR 64H.1.3) | Prewritten software accessed remotely (SaaS) is taxable at 6.25%. DOR applies an "object of the transaction" test; Quorum is software members use themselves — `lib/pricing.ts` itself calls it "software with no facilitation" — so it **likely is taxable**. An in-state seller has no threshold: collect from the first Massachusetts sale | **[you]** — accountant; register on MassTaxConnect; ties into the Stripe Tax decision |
| **DMCA § 512(c)** | Safe harbor for members' uploads needs a designated agent registered with the Copyright Office ($6, renew every 3 years) and a takedown process | Takedown section added to the Terms; **[you]** agent registration optional |
| **201 CMR 17.00 / M.G.L. c. 93H** | Security program and breach notices for "personal information" = name + SSN, driver's licence, or financial account/card number | Probably doesn't apply — Quorum stores none of those (Stripe holds cards). Breach-notice language kept |
| **Massachusetts comprehensive privacy bill** | Not in effect; House and Senate versions in conference committee as of mid-2026 | Watch it; revisit the Privacy Policy if it passes |

### Required Stripe settings — a pre-deploy gate ✅ done 2026-09-12

*Confirmed by the owner in the dashboard. These toggles aren't visible through
Stripe's API, so unlike the prices and branding they weren't verified by a probe.
Phase 6 should confirm them for real: a test trial should produce the 7-day
reminder, and a test charge a receipt with the manage-subscription link.*

The Terms now promise a trial reminder, a receipt with every charge, and renewal
reminders on annual plans. **Don't deploy the legal pages until these are on**, or
the Terms promise something that doesn't happen.

- **Settings → Billing → Subscriptions and emails → Email notifications and customer management**
  - **Send a reminder email 7 days before a free trial ends** — on
  - **Send emails about upcoming renewals** — on; set **Prevent failed payments → Upcoming renewal events** to **30 days**
  - Link destination for these emails → the **Stripe-hosted customer portal**; also set the **Manage subscription link** → customer portal
- **Settings → Emails → Successful payments** (customer receipts) — on. Stripe adds trial information and the cancellation link to receipts automatically

### After deploy

- **[you]** Put the `/terms` URL in Stripe's public business details, and the Terms and Privacy URLs in the Customer Portal settings.
- **[me]** Then turn on `consent_collection.terms_of_service = "required"` in `/api/checkout`, with `custom_text.terms_of_service_acceptance` naming the renewal terms — *written 2026-09-12, see the Phase 0 legal item for its status.* Stripe then records `consent.terms_of_service = accepted` on every Checkout session — California's proof-of-consent requirement, stored by Stripe. It **errors unless Stripe has a Terms URL**, which is why it can't come first.

### Sources

[940 CMR 38.05](https://www.law.cornell.edu/regulations/massachusetts/940-CMR-38-05) ·
[Cal. BPC § 17602](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17602) ·
[Kelley Drye 2025 auto-renewal round-up](https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/auto-renewal-laws-2025-round-up) ·
[Maryland ARL](https://www.subscriptioninsider.com/blog/maryland-automatic-renewal-law-raises-compliance-stakes-for-consumer-subscription-businesses-news) ·
[ROSCA after the vacatur](https://www.gibsondunn.com/ftc-restarts-negative-option-rulemaking-after-eighth-circuit-vacatur-enforcement-under-rosca-continues/) ·
[Kauders v. Uber](https://law.justia.com/cases/massachusetts/supreme-court/volumes/486/486mass557.html) ·
[CalOPPA DNT](https://iapp.org/news/a/what-do-the-new-disclosure-requirements-under-caloppa-mean-for-your-busines) ·
[M.G.L. c. 110 § 5](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXV/Chapter110/Section5) ·
[MA SaaS tax](https://www.numeral.com/blog/saas-sales-tax-massachusetts) ·
[MA LR 16-1 (object of the transaction)](https://mass.gov/letter-ruling/letter-ruling-16-1-application-of-the-massachusetts-sales-tax-to-sales-associated) ·
[DMCA agent directory](https://www.copyright.gov/dmca-directory/) ·
[201 CMR 17.00](https://www.mass.gov/regulations/201-CMR-1700-standards-for-the-protection-of-personal-information-of-residents-of-the-commonwealth) ·
[MA privacy bill status](https://foleyhoag.com/news-and-insights/blogs/state-ag-insights/2026/june/one-step-closer-to-a-massachusetts-data-privacy-law-comparing-the-current-house-and-senate-bills/) ·
[Stripe trial compliance](https://docs.stripe.com/billing/subscriptions/trials/manage-trial-compliance) ·
[Stripe customer emails](https://docs.stripe.com/billing/revenue-recovery/customer-emails) ·
[Stripe Checkout policies](https://docs.stripe.com/payments/checkout/customization/policies)
