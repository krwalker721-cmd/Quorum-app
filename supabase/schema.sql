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

-- Add username column (idempotent)
alter table public.profiles add column if not exists username text unique;

-- Backfill any existing rows missing a username
update public.profiles
set username = lower(regexp_replace(coalesce(full_name, 'founder'), '[^a-zA-Z0-9]+', '-', 'g'))
               || '-' || substring(id::text, 1, 4)
where username is null;

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

-- Ensure a user can't be added to the same cohort twice
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'cohort_members_user_cohort_unique'
  ) then
    alter table public.cohort_members
      add constraint cohort_members_user_cohort_unique unique (user_id, cohort_id);
  end if;
end $$;

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

-- ============================================================================
-- cohorts (user-created groups)
-- ============================================================================
create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  creator_id uuid references public.profiles(id) on delete set null,
  is_open boolean default true,
  created_at timestamp default now()
);

alter table public.cohorts enable row level security;

drop policy if exists "cohorts_read_all" on public.cohorts;
drop policy if exists "cohorts_insert_own" on public.cohorts;
drop policy if exists "cohorts_update_creator" on public.cohorts;

create policy "cohorts_read_all"
  on public.cohorts for select
  using (auth.role() = 'authenticated');

create policy "cohorts_insert_own"
  on public.cohorts for insert
  with check (auth.uid() = creator_id);

create policy "cohorts_update_creator"
  on public.cohorts for update
  using (auth.uid() = creator_id);

-- Auto-add creator as first member after cohort insert
create or replace function public.cohorts_add_creator_as_member()
returns trigger language plpgsql security definer as $$
begin
  insert into public.cohort_members (user_id, cohort_id) values (new.creator_id, new.id)
  on conflict do nothing;
  return new;
end; $$;

drop trigger if exists cohorts_add_creator_trigger on public.cohorts;
create trigger cohorts_add_creator_trigger
  after insert on public.cohorts
  for each row execute function public.cohorts_add_creator_as_member();

-- ============================================================================
-- cohort_invites (links + email invites)
-- ============================================================================
create table if not exists public.cohort_invites (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts(id) on delete cascade,
  inviter_id uuid references public.profiles(id) on delete set null,
  email text,
  token text unique not null default encode(gen_random_bytes(12), 'hex'),
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamp,
  created_at timestamp default now(),
  expires_at timestamp
);

create index if not exists cohort_invites_token_idx on public.cohort_invites (token);

alter table public.cohort_invites enable row level security;

drop policy if exists "invites_read_relevant" on public.cohort_invites;
drop policy if exists "invites_insert_member" on public.cohort_invites;
drop policy if exists "invites_update_consume" on public.cohort_invites;

-- Members of the cohort or the invitee can read
create policy "invites_read_relevant"
  on public.cohort_invites for select
  using (
    auth.uid() = inviter_id
    or exists (select 1 from public.cohort_members cm where cm.cohort_id = cohort_invites.cohort_id and cm.user_id = auth.uid())
  );

create policy "invites_insert_member"
  on public.cohort_invites for insert
  with check (
    auth.uid() = inviter_id
    and exists (select 1 from public.cohort_members cm where cm.cohort_id = cohort_invites.cohort_id and cm.user_id = auth.uid())
  );

create policy "invites_update_consume"
  on public.cohort_invites for update
  using (auth.role() = 'authenticated');

-- ============================================================================
-- cohort_join_requests
-- ============================================================================
create table if not exists public.cohort_join_requests (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamp default now(),
  unique (cohort_id, user_id)
);

alter table public.cohort_join_requests enable row level security;

drop policy if exists "join_requests_read_own_or_creator" on public.cohort_join_requests;
drop policy if exists "join_requests_insert_own" on public.cohort_join_requests;
drop policy if exists "join_requests_update_creator" on public.cohort_join_requests;

create policy "join_requests_read_own_or_creator"
  on public.cohort_join_requests for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.cohorts c where c.id = cohort_join_requests.cohort_id and c.creator_id = auth.uid())
  );

create policy "join_requests_insert_own"
  on public.cohort_join_requests for insert
  with check (auth.uid() = user_id);

create policy "join_requests_update_creator"
  on public.cohort_join_requests for update
  using (exists (select 1 from public.cohorts c where c.id = cohort_join_requests.cohort_id and c.creator_id = auth.uid()));

-- ============================================================================
-- trust_score auto-increments (triggers)
-- ============================================================================
create or replace function public.bump_trust_score(uid uuid, delta int)
returns void language sql security definer as $$
  update public.profiles set trust_score = coalesce(trust_score, 0) + delta where id = uid;
$$;

create or replace function public.trust_on_post_insert()
returns trigger language plpgsql security definer as $$
begin
  perform public.bump_trust_score(new.author_id, 2);
  return new;
end; $$;

drop trigger if exists trust_post_trigger on public.posts;
create trigger trust_post_trigger
  after insert on public.posts
  for each row execute function public.trust_on_post_insert();

create or replace function public.trust_on_checkin_insert()
returns trigger language plpgsql security definer as $$
begin
  perform public.bump_trust_score(new.user_id, 3);
  return new;
end; $$;

drop trigger if exists trust_checkin_trigger on public.check_ins;
create trigger trust_checkin_trigger
  after insert on public.check_ins
  for each row execute function public.trust_on_checkin_insert();

create or replace function public.trust_on_message_insert()
returns trigger language plpgsql security definer as $$
begin
  perform public.bump_trust_score(new.sender_id, 1);
  return new;
end; $$;

drop trigger if exists trust_message_trigger on public.messages;
create trigger trust_message_trigger
  after insert on public.messages
  for each row execute function public.trust_on_message_insert();
