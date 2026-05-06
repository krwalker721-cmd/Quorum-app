# quorum

private founder community — part 1 (foundation: auth + waitlist).

## stack

- next.js 14 (app router)
- supabase (auth, postgres, realtime)
- tailwind css
- deploy: vercel

## setup

1. install deps:

   ```bash
   npm install
   ```

2. create a supabase project at https://supabase.com and copy your keys.

3. copy env file and fill in values:

   ```bash
   cp .env.local.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` — project url
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key (server only, used by /admin)

4. in supabase sql editor, run `supabase/schema.sql` to create the `profiles` table and rls policies.

5. in supabase auth settings, you may want to disable "confirm email" while developing so signups work without an email round-trip.

6. run dev server:

   ```bash
   npm run dev
   ```

## flows

- `/signup` — collects full name, email, password, what they're building, stage. Creates an `auth.users` row + a matching `profiles` row with `status = "pending"`.
- `/login` — signs in, then routes to `/pending` or `/home` based on profile status.
- `/pending` — waiting screen for unapproved users.
- `/home` — the (placeholder) member home; protected.
- `/admin` — lists pending users with an approve button. **note**: this route is currently open to any authenticated user. lock it down by gating on a specific email or an `is_admin` column when you go beyond the founder team.

## feature flags

- `lib/flags.ts` exports `WAITLIST_ENABLED`. Set to `false` to bypass the waitlist and send all signups straight to `/home`.

## structure

```
app/
  layout.tsx, page.tsx, globals.css
  login/, signup/, pending/, home/, admin/
  api/admin/approve/route.ts
components/
  LogoMark.tsx, SignOutButton.tsx
lib/
  flags.ts
  supabase/{client,server,middleware}.ts
supabase/schema.sql
middleware.ts
```
