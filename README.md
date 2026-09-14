# Quorum

A private community for founders: small cohorts, an honest feed, and people who
show up for each other. $39/month, with a card-free trial. Live at
[quorumhq.co](https://quorumhq.co).

The launch plan, what's done, and what's left live in [`LAUNCH.md`](LAUNCH.md).
The in-app look is described in
[`design/REDESIGN-BUILD-GUIDE.md`](design/REDESIGN-BUILD-GUIDE.md).

## Stack

- **Next.js 16** (App Router, Turbopack) and **React 19**
- **Supabase**: auth, Postgres with row-level security, realtime
- **Stripe**: subscriptions, through hosted Checkout and an inline card form
- **Resend**: transactional email (trial reminders, approvals)
- **Sentry**: error monitoring
- **Tailwind CSS 3**
- **Vercel**: hosting, and the two daily crons in `vercel.json`

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the env file and fill it in:

   ```bash
   cp .env.local.example .env.local
   ```

   | Variable | What it's for |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client (admin panel, webhooks, crons) |
   | `ADMIN_CODE` | Admin panel passphrase, used until one is saved in the database |
   | `NEXT_PUBLIC_APP_URL` | Base URL for links in emails and Stripe redirects |
   | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe API keys |
   | `STRIPE_WEBHOOK_SECRET` | Verifies `/api/webhooks/stripe` |
   | `STRIPE_MEMBER_PRICE_ID`, `STRIPE_MEMBER_ANNUAL_PRICE_ID`, `STRIPE_FOUNDING_PRICE_ID`, `STRIPE_PARTNER_PRICE_ID` | Plan prices (`lib/plans.ts`) |
   | `RESEND_API_KEY` | Sends email |
   | `CRON_SECRET` | Bearer token the `/api/cron/*` routes require |
   | `NEXT_PUBLIC_SENTRY_DSN` | Sentry project (optional locally) |

3. Set up the database in the Supabase SQL editor: run `supabase/schema.sql`,
   then each file in `supabase/migrations/` in numeric order. The project isn't
   linked to the Supabase CLI, so migrations are pasted by hand.

4. Auth email templates are in `supabase/templates/`; its README says where
   each one goes in the dashboard.

5. Start the dev server:

   ```bash
   npm run dev
   ```

## Deploying

Pushing `main` deploys to production on Vercel. A migration has to be applied
in Supabase **before** the deploy that depends on it, since signup runs through
the `handle_new_user()` trigger.

## How it fits together

- **Signup:** signup → confirm email → `/pending` → approved by an admin →
  straight into the app, where a guided tour starts. The admin panel can switch
  the platform to open mode, where new members are approved on arrival
  (`lib/platform.ts`).
- **Access:** `lib/entitlements.ts` is the one source of truth for what an
  account can do. A member or a live trial gets full access; anyone else can
  read but not write. There is no free tier.
- **Sessions:** `proxy.ts` (Next 16's name for middleware) refreshes the
  Supabase session cookie on each request.
- **Layout:** member pages are under `app/(app)/`, legal pages under
  `app/(legal)/`, the admin panel under `app/admin/`, and API routes under
  `app/api/`. The signed-out landing page is `components/landing/`.
