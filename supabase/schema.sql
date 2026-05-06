-- Run this in the Supabase SQL editor.

-- ============================================================================
-- profiles
-- ============================================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  what_they_are_building text,
  stage text check (stage in ('idea','pre-seed','seed','series_a')),
  status text default 'pending' check (status in ('pending','approved')),
  trust_score integer default 0,
  tier text default 'free' check (tier in ('free','tier_1','tier_2')),
  created_at timestamp default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "authenticated_read_approved_profiles" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Any authenticated user can read approved profiles (cohort visibility).
create policy "authenticated_read_approved_profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated' and status = 'approved');

-- ============================================================================
-- posts
-- ============================================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  tag text check (tag in ('decision','mindset','hiring','real_talk','growth','ops','fundraising')),
  is_anonymous boolean default false,
  post_type text default 'cohort' check (post_type in ('cohort','pulse')),
  reply_count integer default 0,
  created_at timestamp default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_post_type_idx on public.posts (post_type);

alter table public.posts enable row level security;

drop policy if exists "authenticated_read_posts" on public.posts;
drop policy if exists "authenticated_insert_posts" on public.posts;

create policy "authenticated_read_posts"
  on public.posts for select
  using (auth.role() = 'authenticated');

create policy "authenticated_insert_posts"
  on public.posts for insert
  with check (auth.uid() = author_id);

-- Enable realtime on posts
alter publication supabase_realtime add table public.posts;

-- ============================================================================
-- cohort_members
-- ============================================================================
create table if not exists public.cohort_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  cohort_id uuid,
  joined_at timestamp default now()
);

alter table public.cohort_members enable row level security;

drop policy if exists "cohort_members_read_all" on public.cohort_members;
drop policy if exists "cohort_members_insert_own" on public.cohort_members;

create policy "cohort_members_read_all"
  on public.cohort_members for select
  using (auth.role() = 'authenticated');

create policy "cohort_members_insert_own"
  on public.cohort_members for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- messages (1:1 DMs)
-- ============================================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamp default now(),
  read boolean default false
);

create index if not exists messages_pair_idx on public.messages (sender_id, recipient_id, created_at);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "messages_read_party" on public.messages;
drop policy if exists "messages_insert_sender" on public.messages;
drop policy if exists "messages_update_recipient" on public.messages;

create policy "messages_read_party"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "messages_insert_sender"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "messages_update_recipient"
  on public.messages for update
  using (auth.uid() = recipient_id);

alter publication supabase_realtime add table public.messages;

-- ============================================================================
-- check_ins (weekly)
-- ============================================================================
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  decision text,
  last_week_rating text check (last_week_rating in ('solid','mixed','rough','lost')),
  blocker text,
  weekly_win text,
  is_anonymous boolean default false,
  created_at timestamp default now()
);

create index if not exists check_ins_user_idx on public.check_ins (user_id, created_at desc);

alter table public.check_ins enable row level security;

drop policy if exists "check_ins_read_own_or_cohort" on public.check_ins;
drop policy if exists "check_ins_insert_own" on public.check_ins;

-- Anyone authenticated can read check-ins (anonymity is enforced in the app layer
-- by hiding the user_id in UI when is_anonymous is true).
create policy "check_ins_read_own_or_cohort"
  on public.check_ins for select
  using (auth.role() = 'authenticated');

create policy "check_ins_insert_own"
  on public.check_ins for insert
  with check (auth.uid() = user_id);
