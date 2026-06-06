-- 005_cohort_scoping_and_admin.sql
-- Run this in the Supabase SQL editor.
--
-- Covers:
--   1. profiles.is_admin flag (community-wisdom nominations are admin-only)
--   2. posts.cohort_id (cohort posts are scoped to a specific cohort room)
--   3. RLS so leaving a cohort fully removes access to its posts/members/room
--   4. RLS so only admins can create / review vault nominations

-- ============================================================================
-- 1. profiles.is_admin
-- ============================================================================
alter table public.profiles add column if not exists is_admin boolean default false;

-- Set your own account as admin (replace the email before running):
-- update public.profiles set is_admin = true where email = 'your-email-here';

-- ============================================================================
-- 2. posts.cohort_id — which cohort room a cohort post belongs to
-- ============================================================================
alter table public.posts add column if not exists cohort_id uuid references public.cohorts(id) on delete cascade;
create index if not exists posts_cohort_id_idx on public.posts (cohort_id);

-- Best-effort backfill for existing cohort posts that pre-date scoping: attach
-- each cohort post to its author's (single) cohort membership so historical
-- posts stay visible to that cohort instead of disappearing under the new RLS.
update public.posts p
set cohort_id = cm.cohort_id
from public.cohort_members cm
where p.post_type = 'cohort'
  and p.cohort_id is null
  and cm.user_id = p.author_id
  and (
    select count(*) from public.cohort_members cm2 where cm2.user_id = p.author_id
  ) = 1;

-- ============================================================================
-- 3. Cohort scoping RLS
-- ============================================================================

-- Helper: the set of cohort ids the current user belongs to. SECURITY DEFINER
-- so it bypasses RLS on cohort_members — this is what prevents the "infinite
-- recursion detected in policy" error a self-referential subquery would cause.
create or replace function public.my_cohort_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select cohort_id from public.cohort_members where user_id = auth.uid();
$$;

-- Posts: pulse is global; cohort posts only visible to members of that cohort.
drop policy if exists "authenticated_read_posts" on public.posts;
drop policy if exists "Cohort members can view cohort posts" on public.posts;
create policy "Cohort members can view cohort posts" on public.posts
  for select using (
    post_type = 'pulse'
    or (
      post_type = 'cohort'
      and cohort_id in (select public.my_cohort_ids())
    )
  );

-- cohort_members: users can see their own rows and co-members of cohorts they
-- belong to (so the room roster works) — but nothing from cohorts they left.
drop policy if exists "cohort_members_read_all" on public.cohort_members;
drop policy if exists "Users can view their cohort memberships" on public.cohort_members;
create policy "Users can view their cohort memberships" on public.cohort_members
  for select using (
    user_id = auth.uid()
    or cohort_id in (select public.my_cohort_ids())
  );

-- Users can delete their own cohort membership (leave a cohort).
drop policy if exists "Users can leave cohorts" on public.cohort_members;
create policy "Users can leave cohorts" on public.cohort_members
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- 4. vault_nominations — admin only
-- ============================================================================
drop policy if exists "vault_nominations_insert_auth" on public.vault_nominations;
drop policy if exists "Users can nominate posts" on public.vault_nominations;
drop policy if exists "Admins can nominate posts" on public.vault_nominations;
create policy "Admins can nominate posts" on public.vault_nominations
  for insert with check (
    (select is_admin from public.profiles where id = auth.uid()) = true
  );

drop policy if exists "vault_nominations_read_own" on public.vault_nominations;
drop policy if exists "Admins can view nominations" on public.vault_nominations;
create policy "Admins can view nominations" on public.vault_nominations
  for select using (
    (select is_admin from public.profiles where id = auth.uid()) = true
  );

drop policy if exists "Admins can update nominations" on public.vault_nominations;
create policy "Admins can update nominations" on public.vault_nominations
  for update using (
    (select is_admin from public.profiles where id = auth.uid()) = true
  );
