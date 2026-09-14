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
- **Where it runs today:** `https://quorumhq.co`, live Stripe, since the Phase 1
  cutover on 2026-09-13. The old `quorum-app-kappa.vercel.app` host still
  resolves but is no longer canonical.
- **Repo:** `main` is the deploy branch; Vercel auto-deploys from it via the
  GitHub integration (`krwalker721-cmd/Quorum-app`). No Vercel CLI or token is
  configured locally.
- **Status (2026-09-13):** Phases 0–4 are done apart from the items marked open.
  Migrations 001–017 are applied. **Phase 6's payment tests were skipped at
  the owner's call** (see Phase 6). What's left, and whose it is:
  - **[me]** Finish the in-app redesign (tracker at the end of Phase 4), then
    Phase 5.
  - **[you]** Database backups (Supabase Pro) before approving the first group;
    the DBA certificate; a `support@` inbox; the Stripe Tax decision; analytics
    account (optional).
- **Read §7 before touching the database or deploying** — the migration and
  deploy workflow here has a specific ordering requirement that will break signup
  if ignored.
- **Design language**, if any UI work comes up: dark, boxed tiles, amber as the
  single accent, green for live/positive only. Pages are moving to the
  landing page's "sleek" finish (`components/ui/sleek.module.css`): hairline
  top-lit tiles, a glass topbar, gradient page titles, sentence-case labels at
  13–14px instead of tiny uppercase mono. See the redesign tracker in Phase 4.
  `design/REDESIGN-BUILD-GUIDE.md` predates this and still needs updating to
  match; don't reintroduce a rainbow of accent colors.

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
- [x] **[me → you]** **Terms of Service, Privacy Policy, refund/cancellation
      policy.** ✅ **Done 2026-09-12** — live on `quorumhq.co`, reviewed against
      current law (§8), with consent captured at signup, on the referral card
      form, and in Stripe Checkout. Claude can draft all three to a solid first-pass standard, and
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
        session creation fails outright if it isn't.
        ✅ **Verified 2026-09-12:** deployed as `6557c62`; the owner clicked
        "Join" on production and saw the checkbox on Stripe's page. That also
        confirms the Terms URL is on file in test mode, not only live
- [ ] **[you]** **File a Massachusetts business certificate ("DBA") for
      "Quorum".** Massachusetts requires anyone doing business under a name other
      than their own legal name to file a business certificate with the clerk of
      the city or town where the business is based (M.G.L. c. 110, § 5). The
      Terms will name "Denyse Walker, doing business as Quorum", so the filing
      should exist to back that up. It's done in Denyse's name, at her town
      clerk's office; fees are small and set by the town. Some banks also want
      it to accept payments made out to the business name.
- [x] **[you]** **Turn on Stripe's trial-ending reminder email.** *On
      2026-09-13, in live mode.* Referred
      members add a card and get a 45-day trial that converts to paid on its
      own, but the only warning today is an in-app notification from the
      `customer.subscription.trial_will_end` webhook. California's automatic
      renewal law requires notice before a free trial longer than 31 days
      converts, and a member who never opens the app gets none. Stripe can send
      the reminder itself: Settings → Billing → the subscription/customer
      emails section → the option to email customers before a free trial ends.
      One toggle. (The card-free standard trial never auto-charges, so it isn't
      affected — that gap is §4a, a conversion problem rather than a legal one.)
- [x] **[me]** **Fix the PKCE cross-device error message** (see §5) — small, and
      it's a real support ticket on launch week.
      ✅ *2026-09-12, branch `fix/pkce-cross-device`:* `/auth/callback` now maps
      Supabase's error **codes** to plain messages instead of passing raw text
      to the login page — cross-device (`pkce_code_verifier_not_found`,
      `bad_code_verifier`, `flow_state_not_found`), expired (`otp_expired`,
      `flow_state_expired`), and a generic fallback — each worded for resets
      (`type=recovery`) or signups; the raw error is still logged server-side.
      Verified locally with four fake links: the server log shows the real
      `AuthPKCECodeVerifierMissingError` being caught, and the login page shows
      the reset message cleanly. ✅ **Deployed 2026-09-12 as `065b61b`** and
      verified on production: fake cross-device reset, cross-device signup,
      and expired-link requests to `quorumhq.co/auth/callback` all return the
      new messages. Phase 6's different-device reset test (needs Phase 1 SMTP)
      is the real-world confirmation.
- [x] **[you]** Decide §4a (trial notification) and §4b (admission cadence).
      Both change what gets built in later phases.
      ✅ §4a decided 2026-09-12: **option 1**, Quorum-sent reminder emails.
      ✅ §4b decided 2026-09-12: **approve in groups of 12**, keeping a manual
      way to approve anyone; approved members must be told. Mechanism: **by
      hand** — select about 12, bulk approve. Semi-automatic release is
      deferred (see §4b).

### Phase 1 — infrastructure cutover (once DNS resolves)

- [x] **[you]** Add the domain to Vercel; confirm HTTPS. ✅ Done at purchase —
      bought through Vercel, so it was bound automatically. The apex serves
      HTTPS and `www` 307-redirects to it; verified 2026-09-12.
- [x] **[you]** **Custom SMTP** — create the Resend or Postmark account, verify
      the sending domain (SPF/DKIM DNS records), and put the credentials into
      Supabase. Without this, the password reset flow that is *already deployed*
      silently delivers nothing.
      *Progress 2026-09-13:* provider is **Resend** (free tier: 3,000/month,
      **100/day**; Pro $20/month removes the daily cap). Account created and
      `quorumhq.co` added in region US East; Resend's Vercel integration
      auto-published the DNS records, verified with `dig` via Vercel's
      nameserver, 8.8.8.8, and 1.1.1.1: DKIM `resend._domainkey`, SPF TXT
      and MX on `send.quorumhq.co` (→ `feedback-smtp.us-east-1.amazonses.com`).
      DMARC `v=DMARC1; p=none;` at `_dmarc` added by hand in Vercel (monitor
      only — it blocks nothing), confirmed live on all three resolvers.
      **Domain verified in Resend 2026-09-13** (DKIM + SPF). Resend's "Enable
      Receiving" turned **off**: sending doesn't need it, it delivers to code
      rather than a readable inbox, and it would claim the apex MX that a real
      `support@` inbox will need.
      ✅ **Working 2026-09-13.** Supabase SMTP saved with sender `Quorum
      <no-reply@quorumhq.co>`. The first test failed with `535 invalid
      username`: Chrome had autofilled the owner's email into the Username
      field, which must be exactly `resend`. **If SMTP ever breaks, check
      that field first.** After the fix, a password reset from the `vercel.app`
      host was delivered — **to spam**. Gmail's "Show original" shows **SPF,
      DKIM, and DMARC all PASS**, so the configuration is right. The spam
      placement is reputation and content: a days-old domain with no sending
      history, sending Supabase's default template with a link to
      `*.supabase.co`. See the email-templates item below.
      Apex A records untouched; no apex MX (no inbox yet — separate item).
      Supabase SMTP values: host `smtp.resend.com`, port `465`, username
      `resend`, password = the Resend API key (never committed or pasted).
- [ ] **[you]** **Inbound email on the domain — `support@quorumhq.co`.** Separate
      problem from the SMTP item above: that one is *sending*, this one is
      *receiving*. Vercel is registrar and DNS but does not host mailboxes, so
      right now there is no address at `quorumhq.co` that can receive anything.
      Stripe puts the support address on receipts and in the billing portal, and
      it is also what a locked-out member will write to. A personal Gmail works
      as a stopgap and is changeable any time; before launch, either add a
      forwarding service (MX records into Vercel DNS) or Google Workspace at
      ~$6/mo. Decide which; neither is launch-blocking on its own.
- [x] **[me]** **Trial-ending reminder emails** (the §4a decision). *Live
      2026-09-13 (`141eb62`); a manual Run from Vercel → Cron Jobs logged a
      clean `[cron] trial-reminders` summary, and unauthenticated calls get
      401.* At 7, 3,
      and 1 days before `subscriptions.trial_ends_at`, email card-free
      trialers what ends, when, what it costs to continue, and a link to
      subscribe. Build notes:
      - **Blocked on the SMTP item above** — nothing can be sent until it lands
      - **Skip members whose trial is a Stripe trial** (a
        `stripe_subscription_id` is set, i.e. the referral card path). Stripe
        already sends them its 7-day reminder; a second email would confuse
      - **Honour the existing `email_trial_ending` preference** in Settings. The
        card-free trial never auto-charges, so no auto-renewal law requires this
        email, and an opt-out is fine
      - Record each send, so a retried job can't email the same person twice
      - Scheduled alongside the Phase 3 edge functions and `pg_cron` jobs
      - **Deadline:** live before the first cohort's T-7 mark (§4a)
      - *Built 2026-09-13, branch `feat/trial-and-approval-emails`:* migration
        `015_trial_reminder_sends.sql` (the send log), `lib/email/`, and
        `/api/cron/trial-reminders`, run daily at 14:00 UTC by Vercel Cron
        (`vercel.json`). Each mark owns a one-day window around it, so a daily
        run always catches it; a missed run sends late with the true time
        left. Checked against 2,000 simulated trials. Goes live once 015 is
        pasted (before the deploy), `RESEND_API_KEY` and `CRON_SECRET` are in
        Production, and it's pushed.
- [x] **[me]** **"You're in" approval email** (the §4b decision). *Live
      2026-09-13; approving a `+approvaltest` signup delivered it with the
      right trial length.* Sent from
      `approveUser()` in `lib/admin/approve.ts`, so every approval path sends
      it: single, bulk, or a released group. Say that their group has opened,
      and link straight to `quorumhq.co/login`. **Blocked on the SMTP item
      above**; until it lands, email each approved group by hand.
      *Built 2026-09-13 on the same branch:* `approveUser()` sends it after
      the approval, best-effort (a failed email never undoes an approval), with
      the member's real trial length (30, or 45 if referred).
- [x] **[me → you]** Supabase auth email templates
      *Research 2026-09-13 — the plan changed.* Don't just rebrand the
      defaults. Switch the links from `{{ .ConfirmationURL }}` (a
      `*.supabase.co` URL that completes via the PKCE `code` exchange) to
      Supabase's recommended server-side format,
      `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>`,
      handled by a new `/auth/confirm` route that calls
      `supabase.auth.verifyOtp({ token_hash, type })`. That fixes three
      problems at once:
      - **Spam:** the link stays on our own domain instead of `supabase.co`,
        which no longer mismatches the `quorumhq.co` sender
      - **Cross-device:** `verifyOtp` in the installed `@supabase/auth-js`
        2.105.3 never reads a PKCE code verifier (checked in its source), so a
        reset requested on a laptop works when opened on a phone
      - **Branding:** the emails say Quorum, not Supabase
      Types: signup `email`, `recovery`, `magiclink`, `invite`, plus email
      change. **Ordering, as in §7: deploy `/auth/confirm` *before* pasting
      the new templates**, or every email sent in between links to a 404.
      `/auth/callback` stays for links already in flight. Until the Phase 1
      cutover, `{{ .SiteURL }}` is still the `vercel.app` host; it becomes
      `quorumhq.co` automatically when the Site URL moves. Known limit: some
      corporate email scanners prefetch links, which can spend a one-time
      token before the person clicks; a click-to-confirm page fixes that if it
      ever shows up. Sources: Supabase docs "Email Templates" and "Password-based
      Auth"; `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`
      `verifyOtp()`.
      *Built 2026-09-13 on `feat/auth-confirm-templates` (not yet deployed):*
      `app/auth/confirm/route.ts` calls `verifyOtp` and routes recovery →
      `/reset-password`, email change → `/settings`, and signup → referral
      claim, then `/`. The shared helpers moved to `lib/auth/email-links.ts`,
      and `/auth/callback` was rewritten onto them with unchanged behaviour.
      Templates for Confirm signup, Reset Password, and Change Email Address
      are in `supabase/templates/`, with a README of subjects and where to
      paste each; the app sends no magic links or invites. **Also fixed:** a
      confirmation opened on another device would have dropped the signup's
      referral, because the code lived only in a cookie. `/signup` now also
      saves it in user metadata, and the claim falls back to it. Verified
      locally: fake reset and signup tokens, a missing token, and an unknown
      type all land on login with plain messages (Supabase reports a bad token
      as `otp_expired`), and `/auth/callback` output is unchanged.
      ✅ **Deployed 2026-09-13 as `39568e3`.** The gate passed: fake tokens to
      `/auth/confirm` on production return a 307 to login with the right
      message, not a 404, and `/auth/callback` is unchanged. **Next [you]:**
      paste the templates, Reset Password first; test it by requesting on one
      device and opening on another; then the other two.
      ✅ **Reset Password pasted and verified 2026-09-13:** requested on a
      computer, opened on a phone, and the button reached the set-password
      page on the phone. It rendered as designed and landed in **Primary**,
      not spam, so the own-domain link fixed the spam placement.
      ✅ **All three pasted 2026-09-13.** Confirm signup gets tested when
      "Confirm email" is turned on (below). Change Email Address is untested,
      since a live test would change the owner's real account email. — they say "Supabase" by
      default, not Quorum. Claude can write the HTML for confirmation, recovery,
      and magic-link; you paste them into the dashboard.
- [x] **[you]** **The atomic cutover** — all three in one sitting. *Done
      2026-09-13, deployed as `bc29864`.* Smoke test: `/login` 200, the
      webhook refuses an unsigned POST (`No signature`), `/pricing` ships
      `pk_live_…`, and a Member checkout opened live Stripe Checkout at $39
      (live secret key + price IDs proven; abandoned, nothing charged). **Still
      unproven: the live webhook signing secret.** First time a real member
      adds a card, check Stripe → Webhooks → Quorum production → Event
      deliveries shows 200s. Stripe retries failures for 3 days, so a bad
      secret is fixable without losing the payment.
  - [x] `NEXT_PUBLIC_APP_URL` in **Vercel's** env vars (not just `.env.local`).
        Vercel refuses a `NEXT_PUBLIC_*` var marked Sensitive, and a Sensitive
        var can't be switched back: remove and re-add it as a plain (Config)
        var. Same for the publishable key, which is public by design.
  - [x] Supabase → Auth → URL Configuration → Site URL + redirect allow-list
  - [x] Stripe webhook endpoint → `https://quorumhq.co/api/webhooks/stripe`
        *API-version trap, found 2026-09-13.* Webhook payloads arrive in the
        **endpoint's** API version, not the client's pinned `2024-06-20`, and
        the dashboard only offers the account default or the latest version
        for a new endpoint (the installed SDK is `2026-05-27.dahlia`). Stripe
        `2025-03-31` (basil) moved an invoice's subscription to
        `parent.subscription_details.subscription` and moved
        `current_period_start`/`_end` onto subscription items. The old
        handler read only the old fields: `invoice.payment_succeeded` would hit
        `if (!invoice.subscription) break;` and record **no payment, with no
        error**, and the billing cards would lose their next-billing date.
        **Fixed on `cutover/quorumhq-live`** — the webhook and
        `syncSubscriptionToSupabase` read both shapes — so it deploys with the
        live keys, before any live payment can arrive. Either version the
        dashboard offers is fine. Events to send: `customer.subscription.created`,
        `.updated`, `.deleted`, `.trial_will_end`, `invoice.payment_succeeded`,
        `invoice.payment_failed`.
  - [x] *(folded in from Phase 2)* live Stripe keys, live webhook secret, and
        live price IDs in Vercel **Production only**; remove
        `STRIPE_PARTNER_PRICE_ID` from Production (see the env-var table below)
  - [x] **Redeploy** after the env-var edits — `NEXT_PUBLIC_*` values are
        baked into the build, so nothing changes until a new deploy is live
  - [x] **Clear the test-mode Stripe IDs** *(run 2026-09-13; verify row
        `0,0,0,0`)* with
        `supabase/cutover/stripe-test-to-live-1-check.sql` (read-only) and
        `…-2-cleanup.sql`, the cleanup pasted right after the
        live-key deploy is confirmed (not before, or a checkout in the gap
        writes fresh test IDs). Found 2026-09-13: production has only ever used
        test keys, so every stored `stripe_customer_id` and
        `stripe_subscription_id` is a test-mode ID that live Stripe rejects.
        `getOrCreateStripeCustomer` returns a stored ID unchecked, so checkout,
        the billing portal, and the referral card form would fail for any
        test-era account, including the owner's; and account deletion, which
        aborts on any Stripe error by design, couldn't delete one at all. With
        the IDs cleared, checkout creates a fresh live customer and deletion
        searches live Stripe, finds nothing, and proceeds. The reconcile path
        and the referrals page already catch the error and log it. Run the
        read-only `-1-check` file first (safe any time), to see what will
        change.
        *Check run 2026-09-13:* two rows, both the owner's accounts
        (`krwalker721@gmail.com` and a school test address). Neither has a
        test subscription and there are no founding stamps, so the cleanup
        only clears two test customer IDs. Side note: the owner's main account
        is `trialing` with a null `trial_ends_at` — a billing row created by
        `getOrCreateStripeCustomer` before any trial was initialized. It
        doesn't affect members, since approval always sets a trial date.
        **Also reset the founding stamps.** `claimFoundingSeat` stamps
        `is_founding_member` only when a founding subscription is created, and
        every subscription so far was test-mode, so every existing stamp came
        from a test checkout. Each one counts against the 100 founding seats
        (`foundingSeatsRemaining` counts the stamps), so leaving them in place
        would launch with fewer than 100 seats and no visible reason. The
        lapse columns from migration 013 (`lapsed_at`, `seat_released_at`) are
        deliberately left alone.
- [x] **[you]** **Turn on "Confirm email"** in Supabase Auth. *On 2026-09-13;
      passed the Phase 6 signup test below.* Safe now that
      migration 014's `handle_new_user()` trigger creates the profile without
      needing a session.
- [x] **[you]** *(set during the Phase 1 cutover and the email build,
      2026-09-13)* Confirm every env var exists in Vercel production, not only
      locally. **[me]** can produce the definitive list to check against.
      *The definitive list (2026-09-13, from every `process.env` read in
      `app/`, `lib/`, `components/`, and `middleware.ts`):*

      | Var | Kind | Production at cutover | Preview / Development |
      |---|---|---|---|
      | `NEXT_PUBLIC_APP_URL` | public, **baked at build** | `https://quorumhq.co` | leave as is |
      | `NEXT_PUBLIC_SUPABASE_URL` | public | unchanged | unchanged |
      | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | unchanged | unchanged |
      | `SUPABASE_SERVICE_ROLE_KEY` | secret | unchanged | unchanged |
      | `ADMIN_CODE` | secret | unchanged | unchanged |
      | `STRIPE_SECRET_KEY` | secret | `sk_live_…` | keep `sk_test_…` |
      | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public, **baked at build** | `pk_live_…` | keep `pk_test_…` |
      | `STRIPE_WEBHOOK_SECRET` | secret | the **live** endpoint's `whsec_…` | keep test |
      | `STRIPE_MEMBER_PRICE_ID` | config | `price_1UEsuVRPXtW7MxMwEVtvBzSw` | keep test |
      | `STRIPE_MEMBER_ANNUAL_PRICE_ID` | config | `price_1UEsuVRPXtW7MxMwAmVNiILO` | keep test |
      | `STRIPE_FOUNDING_PRICE_ID` | config | `price_1UEsuVRPXtW7MxMwg3Jjgzyv` | keep test |
      | `STRIPE_PARTNER_PRICE_ID` | config | **remove** — unset closes Partner checkout; a leftover test ID would 500 under a live key | keep test |
      | `RESEND_API_KEY` | secret | a Resend key with **sending access**, separate from the one Supabase SMTP uses | unset: app emails are skipped and logged |
      | `CRON_SECRET` | secret | a long random string. Vercel Cron sends it to `/api/cron/trial-reminders`; without it the route refuses every call | unset |

      `ADMIN_CODE` is only a fallback: the admin panel checks
      `platform_settings.admin_code` first. The code was reset there by SQL on
      2026-09-13 after the old one was lost.

      `NODE_ENV` is set by Vercel. The edge functions' `SUPABASE_URL` and
      `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase. **`NEXT_PUBLIC_*`
      values are compiled into the build, so editing them in Vercel does
      nothing until a redeploy.** `.env.local.example` still lacks the annual
      and founding price IDs (Phase 5).

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

- [x] **[you]** Swap to `sk_live_` / `pk_live_` in Vercel env vars *(done in
      the Phase 1 cutover, 2026-09-13)*
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
- [x] **[you]** *(done in the Phase 1 cutover, 2026-09-13)* New webhook signing secret (`STRIPE_WEBHOOK_SECRET`) — the test
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

- [x] **[me → you]** ~~Deploy the 3 edge functions and schedule them.~~
      *Live 2026-09-13 (`fc0f6e8`); a manual Run logged
      `[cron] release-seats {"checked":0,…}` with a 200.*
      **Replaced 2026-09-13: the functions were stale, and are deleted from the
      repo** (branch `feat/release-seats-cron`). Do not deploy them from git
      history.
  - `expire-trials` — **harmful as written.** It set ended trials to
    `status: "active", tier: "free"` and told the member "you're now on the
    free plan", a tier that stopped existing in migration 013. And it isn't
    needed: access is derived from `trial_ends_at` on every read
    (`lib/entitlements.ts`), so an ended trial locks itself.
  - **The real gap was one nobody scheduled.** `enforceLapse()` (return a
    lapsed member's seat after the 7-day grace) ran only when that member
    opened the app, so a member who never came back held a seat forever.
    Now `/api/cron/release-seats` runs it daily for every seated member
    (Vercel Cron, 15:00 UTC), reusing `enforceLapse` unchanged.
  - `check-referral-activity` wrote `monthly_bonus` rows from the pre-013
    referral model. The app's own `deactivateReferral()` is current, but
    nothing reactivates a referral when the member returns, so scheduling
    it is a product decision. **Decided 2026-09-13: left off for launch.**
    Bonuses still drop on churn (the `customer.subscription.deleted`
    webhook). If inactivity is ever switched on, make a returning member
    reactivate the referral first, or a long break costs the referrer for
    good.
  - `nudge-pending-referrals` promised a 24-hour window (the code gives
    48) and counted from signup rather than approval. Dropped.
  - ✅ **[you]** Checked 2026-09-13 that they were never deployed: Supabase →
    Edge Functions lists none of the three, and nothing is scheduled in
    `cron.job`.
- [ ] **[you]** Enable database backups / PITR
      *Decided 2026-09-13:* stay on Supabase **Free** (no restorable backups)
      until there's a real member; **upgrade to Pro (daily backups, 7 days)
      before approving the first group**, since approval creates the first
      data worth keeping. PITR isn't needed at this size.
- [x] **[me → you]** Error monitoring. *Live 2026-09-13 (`bb96e0b`): a
      fake-signature webhook call showed up in Sentry → Issues and sent the
      new-issue alert email.* *Built on branch `feat/sentry`:*
      `@sentry/nextjs` 10.74 via `instrumentation.ts` (server + edge),
      `instrumentation-client.ts` (browser), and `app/global-error.tsx`.
      Server `console.error` calls are forwarded too
      (`captureConsoleIntegration`), since most failures here are caught and
      logged, not thrown. DSN in `NEXT_PUBLIC_SENTRY_DSN`, Production only.
      No `withSentryConfig` wrapper yet: browser stack traces stay minified
      until source maps are uploaded with a `SENTRY_AUTH_TOKEN`. The Privacy
      Policy now names Sentry and Resend (effective date → September 13).
      Claude installs and wires the Sentry SDK;
      **[you]** create the account and supply the DSN as a Vercel env var.
      Webhook and entitlement failures currently `console.error` into Vercel logs
      and nowhere else — you will not know a webhook is failing.
- [x] **[me]** Rate limiting. *Live 2026-09-13 (`da77270`): a wrong code on
      production gets 401 (so the attempt log is readable) and the real code
      still opens the panel.* Nothing had any. Highest priority:
      `/api/admin/verify`, which accepts unlimited guesses against a single
      static passphrase.
      *Built 2026-09-13, branch `feat/admin-rate-limit`.* The surface was wider
      than `/verify`: all 18 `/api/admin/*` routes accept the code, so the
      limit sits in their shared `verifyAdminRequest()`. 5 distinct wrong codes
      per address per 15 minutes, 50 site-wide; a repeated stale code counts
      once; wrong codes are stored only as keyed hashes (migration
      `016_admin_auth_failures.sql`). Fails closed if the log is unreadable,
      so 016 must be applied before the deploy. Also deleted the unused
      env-only `unlockAdmin` server action, a second code check the limit
      wouldn't have covered. Auth emails are already rate-limited by Supabase.
- [x] **[me → you]** Verify migrations 001–014 are all applied to production.
      *Done 2026-09-13: the `pg_policies` query returned all 8 policies.*
      *Probed 2026-09-13 with the public key (read-only, `limit=0`):* a
      table or column from every migration that adds one is present in
      production (002, 004–013, plus 015 and 016); 014 was confirmed earlier.
      A made-up column correctly came back missing. 001 and 003 only change
      access policies, which the public key can't see; they, plus the policy
      parts of 002 and 006, need one `pg_policies` query in the SQL editor
      (8 expected rows; no later migration drops any of them).
      Claude can write probe queries for each; 014 is already confirmed, the rest
      are assumed and there's no `config.toml` to check against.

### Phase 4 — the storefront

Almost entirely Claude's, and it's what to build *while waiting* on Stripe
activation and DNS.

- [x] **[me]** **Public landing page.** *Live 2026-09-13 (`21d6dfe`), with the
      redesign (drifting glow, cohort ring, topic strip, scroll reveals).
      Both flows tested on production with throwaway accounts: waitlist on
      (signup with bio → pending → approved → straight into the app, tour
      running, bio on the profile) and the admin switch set to open (signup →
      straight in, no approval), then set back to waitlist (confirmed from the
      live page's button, "Request an invite"). Test accounts deleted.*
      *Built on branch
      `feat/landing-page`, on the owner's choices: lead with "The honest
      version of LinkedIn", any stage (early-leaning), full pricing shown, a
      live founding-seat counter as the only proof. Signed-out visitors get
      `components/landing/Landing.tsx` at `/`; signed-in routing is
      unchanged. Server-rendered with native `<details>` for the FAQ, so it
      reads without JavaScript. Product and FAQ copy moved to
      `lib/marketing-copy.ts`, shared with /pricing.*
      *Same branch, the owner's flow change:* **onboarding is retired.** New
      members go signup → confirm → pending → approved → straight into the app,
      where the guided tour starts on its own (`startFresh` in
      `TourContext`, for anyone who never finished the old onboarding;
      members who finished it aren't re-toured). `/onboarding` redirects to
      home. Its pitch (the opening line, the question, the manifesto and
      three-part promise) is now the landing page's "why quorum" section, and
      the referral FAQ answer was added. **Not carried over: the "founder
      names" chapter** — eight invented members with invented results and
      quotes, which on a public page would be fake testimonials (FTC 16 CFR
      Part 465); they also stop being shown to members. **The growth stat:**
      onboarding's "founders with strong peer networks grow 2-3x faster
      (Enterprise Nation)" has no study behind it — the cited page doesn't
      contain it. The landing page instead attributes Vistage's own claim
      ("member companies grow 2.2x faster than non-members") with a link,
      as its own section (`components/landing/GrowthStat.tsx`) using
      onboarding's bar graph, animated on scroll. Drawn to scale (2.2 : 1);
      onboarding's version drew 3 : 1 and counted to 3.0×. Renders finished
      without JavaScript and under reduced motion.
      **Bio** moved to an optional signup field (280 chars), copied to the
      profile by `handle_new_user()` — **migration `017_signup_bio.sql`**.
      **The admin's waitlist/open switch now actually works:** it had only
      ever been saved, while every gate read a hard-coded `WAITLIST_ENABLED`
      (deleted). `lib/platform.ts` reads `platform_status` (failing toward the
      waitlist); in open mode a pending member is approved silently on arrival
      (trial + cohort, no "you're in" email). Login and signup now route
      through `/`, so the rule lives in one place. Dead code left for Phase 5:
      the unused onboarding chapters in `components/onboarding-v2/` (the tour
      still imports its `PricingSection`) and `components/onboarding-archived/`.
      `/` currently redirects straight to
      `/login`, so the new domain shows a bare login box with no explanation of
      what Quorum is or why it costs $39/mo. For a product whose pitch *is* the
      filter, this is the highest-leverage item in this phase. Claude builds it;
      **[you]** own the positioning and copy decisions.
- [x] **[me]** `error.tsx`, `not-found.tsx`, `global-error.tsx`
      *(Done 2026-09-13. `global-error.tsx` first, with Sentry; `error.tsx`
      also reports to Sentry. Both of the new pages use
      `components/StatusPage.tsx`, the landing page's finish.)*
- [x] **[me]** `robots.txt`, OG image *(Done 2026-09-13, as file conventions
      rather than a `public/` directory: `app/robots.ts`, `app/sitemap.ts`, and
      `app/opengraph-image.tsx`, a 1200×630 card generated at build time.)*
- [x] **[me]** `metadataBase` + `openGraph` in the root layout *(Done
      2026-09-13. Titles now follow "Page · Quorum".)*
- [x] **[me]** **`/pricing` renders nothing without JavaScript in production.**
      *(Fixed 2026-09-13. `app/pricing/page.tsx` is now a server page that reads
      `?canceled` and renders `PricingClient`, so there is no
      `useSearchParams()` and no bail-out: the served HTML carries the heading,
      prices, and renewal notice.)*
- [ ] **[me → you]** Analytics — Claude wires it, you create the account
- [ ] **[me]** **In-app redesign: the sleek finish, page by page.** The owner
      asked for the landing page's look inside the app. One page at a time,
      each shown in the preview and approved before the next.
      - [x] Sidebar and Home: live (`8be4899`).
      - [x] Pulse: approved, on branch `feat/app-polish-pulse` (`3462b92`).
      - [x] Cohort: approved, on branch `feat/app-polish-cohort` (`c791a2c`,
            `f950094`, which also fixes zoneless timestamps; see below).
      - [x] Collab board and project room: approved (`1e36b32`). Also fixed
            overlapping owner controls, a nested link, "1 docs", and zoneless
            times in the live line and the room's start date.
      - [x] Vault (`3984e47`, live). Also removed invented "a founder saved
            something" cards, fixed /pulse links (cards are `#post-<id>`),
            stacked Notes on phones, and read vault times as UTC.
      - [ ] Messages, Referrals, Profile, Settings.
      - [ ] The shared modals (`modal-shell` in `globals.css`): new post, room
            post, invite, and the rest. Deliberately left for one pass.
      - [ ] Update `design/REDESIGN-BUILD-GUIDE.md` to the new look.

      **How it's built.** Everything is opt-in so unconverted pages don't
      change: `<NoGrid />`, `<TopBar sleek>`, and a `sleek` prop on shared
      components (`PostCard`, `ReplyThread`, `TabPill`, `StagePill`). A
      component only one page uses is restyled directly. Check each page at
      desktop width and at 375px.

      **Timestamps.** `posts.created_at` (and likely other tables' columns) is
      `timestamp` without a time zone, so values arrive with no "Z" and browsers
      read them as local time. `lib/stage.ts` `parseDbTime()` treats them as
      UTC, and `timeAgo()` uses it. A few client-side `toLocaleDateString()`
      calls (project room, vault notes) still read them raw and can show the
      wrong day near midnight. The clean fix is a migration to `timestamptz`,
      offered to the owner as optional.

### Phase 5 — docs drift (anytime, low risk)

- [x] **[me]** README still describes "part 1: auth + waitlist" on Next 14 — ~105
      commits stale *(Rewritten 2026-09-13: current stack, env table, database
      setup, deploy order, and how signup and access work.)*
- [x] **[me]** `.env.local.example` missing `STRIPE_MEMBER_ANNUAL_PRICE_ID` and
      `STRIPE_FOUNDING_PRICE_ID`, both required by `lib/plans.ts` *(Added, along
      with `RESEND_API_KEY`, `CRON_SECRET`, and `NEXT_PUBLIC_SENTRY_DSN`, which
      the code also reads.)*
- [x] **[me]** Next 16 deprecated the `middleware` convention in favor of `proxy`
      *(`middleware.ts` → `proxy.ts`, exporting `proxy`; same matcher.)*
- [x] **[me]** Dead code: `isAdminUnlocked()` on the profile page (see §5)
      *(Removed with `app/admin/session.ts`. It only widened who could see a
      "free" tier pill, and nothing set its cookie.)*
- [x] **[me]** **Favicon is the wrong amber.** *(Fixed 2026-09-13: `app/icon.svg`
      now uses `#f59e0b`, matching `components/LogoMark.tsx`.)*
- [x] **[me]** **Billing cards still describe a free tier.** *(Fixed
      2026-09-13: both cards read `access_reason` from `/api/subscription`. An
      account without access now sees "No active membership" or "Membership
      ended", and Settings says what's paused instead of an empty usage list.
      Trial users see "Unlimited" and "Choose a plan", not "Upgrade". The
      trial-ended and cancelled notifications no longer say "you're now on the
      free tier" either (`lib/notificationMeta.ts`).)*
      `components/ProfileBilling.tsx` (lines 42, 49) and
      `components/SettingsBilling.tsx` (lines 63, 71) show "Free tier" and "Free
      plan — read everything, post within limits", but there is no free tier — an
      unentitled account's write limit is 0. A lapsed member is told they're on a
      plan that doesn't exist, which undercuts the reason to resubscribe.

### Phase 6 — production test pass (the gate)

Do not announce until every one of these passes **on the real domain**. Mostly
yours, because most of them need a real inbox or a real card.

> **Skipped at the owner's call (2026-09-13).** The live-card tests below were
> not run. The first real payments are therefore the first test of those paths:
> watch the Stripe webhook delivery log and Sentry closely for the first few
> sign-ups (Phase 7), and verify the live webhook secret on the first real card.

- [x] **[you]** Full signup, with email confirmation on, from a clean browser
      *Passed 2026-09-13 on `quorumhq.co`:* signed up in a private window,
      got the "confirm your email" screen and the branded email, opened the
      link on a phone (a different device) and landed signed in on /pending.
- [x] **[you]** Password reset end to end — including clicking the link on a
      *different device* than the one that requested it
      *Passed 2026-09-13 on the `vercel.app` host* (computer → phone, via the
      new `/auth/confirm` link). Repeat once on `quorumhq.co` after the
      Phase 1 cutover, since that's where `{{ .SiteURL }}` will point.
      *Passed again 2026-09-13 on `quorumhq.co`* (computer → phone, on a
      throwaway `+confirmtest` account).
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

**Decision (2026-09-12): option 1** — Quorum emails the trial warning itself,
keeping the card-free trial that the pricing page and Terms promise. It's built
in Phase 1, once SMTP works (see the item there). **Hard timing constraint:** it
must be live before the first cohort's T-7 mark, about 23 days after the first
approvals, or that cohort falls into exactly the gap this decision closes. Until
it ships, trials ending in the first cohort need a personal note by hand.

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

**Found 2026-09-12 while scoping this — three things any cadence has to fix:**

- **Bulk approve shortchanges referred founders.** The admin panel's "bulk
  approve" (`/api/admin/users/action`) calls `initializeUserSubscription(id,
  false)` for everyone, so a referred founder gets the 30-day trial instead of
  the 45 days the Terms and signup page promise, and no referral free-month
  window (the card form never appears for them). The single "approve" route
  (`/api/admin/approve`) reads `referred_by` and gets it right; it also creates
  the referral code and assigns the cohort at approval, which bulk approve
  leaves to the member's first visit. **[me]** fix: bulk approve should run the
  same steps as single approve.
- **Nobody is told they've been approved.** There's no approval email (no SMTP
  yet), so an approved batch only finds out if they happen to log in again —
  and a batch that doesn't come back is still an empty room. **[me]** approval
  email once Phase 1 SMTP lands; until then, email each approved batch by hand.
- **The waitlist page promises "we'll be in touch within 48 hours"**
  (`app/pending/page.tsx`). Nothing actually gets in touch, and a weekly batch
  would break that timing anyway. The copy has to match the chosen cadence.
  **[me]**

**Decision (2026-09-12): approve in groups of 12**, each group filling one
cohort, while keeping a manual way to approve anyone. Weekly batches were
rejected: they'd back up as volume grows. Approved members must be told.
**Mechanism, decided 2026-09-12: by hand.** When about 12 good applicants are
waiting, select them in the admin panel and bulk approve; approve anyone
individually at any time. **Deferred:** semi-automatic release (accept
applicants one by one; the 12th acceptance releases the whole group, with a
"release now" override). Build it when volume makes the manual step tedious;
it needs a small schema change. Status of the three fixes above:

- **Bulk approve** — ✅ fixed and deployed (`a1ee5a3`, 2026-09-12; both admin
  routes verified still locked on production). Both approve paths
  now call `approveUser()` in `lib/admin/approve.ts`. It also skips members who
  are already approved or suspended, because re-running approval restarts the
  trial clock.
- **Waiting-page copy** — now says founders are admitted in groups of twelve
  and that we'll email them when their group opens. No time promise.
- **Approval email** — a Phase 1 item, after SMTP. Until then, email each
  approved group by hand.

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
  from." **[me]** ✅ Fixed 2026-09-12 — see the Phase 0 item.
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
