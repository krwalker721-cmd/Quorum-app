-- ---------------------------------------------------------------------------
-- 016 — admin code attempt log (rate limiting)
--
-- Eighteen admin routes accept the admin code, so each was a place to guess it,
-- without limit. lib/admin/auth.ts now records every distinct wrong code here
-- and refuses further attempts once an address, or everyone together, has sent
-- too many in a 15-minute window.
--
-- code_hash is a keyed hash of the wrong code, never the code itself. It lets a
-- stale admin tab that repeats one old code count once instead of per request.
-- Rows older than a day are deleted as new ones arrive.
--
-- RUN THIS BEFORE deploying the code that reads it (see LAUNCH.md §7). The
-- check fails closed: without this table, admin stays locked.
-- ---------------------------------------------------------------------------

create table if not exists public.admin_auth_failures (
  id         bigint generated always as identity primary key,
  ip         text        not null,
  code_hash  text        not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_auth_failures_ip_time
  on public.admin_auth_failures (ip, created_at desc);
create index if not exists admin_auth_failures_time
  on public.admin_auth_failures (created_at desc);

-- No policies: only the service role (the admin check) reads or writes this.
alter table public.admin_auth_failures enable row level security;
