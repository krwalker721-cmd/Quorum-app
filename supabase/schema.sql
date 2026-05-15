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

-- Enable realtime on posts (idempotent)
do $$ begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
end $$;

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

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

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

-- ============================================================================
-- user_skills (collab board profile data)
-- ============================================================================
create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  skill text not null,
  created_at timestamp default now(),
  unique (user_id, skill)
);

create index if not exists user_skills_user_idx on public.user_skills (user_id);

alter table public.user_skills enable row level security;

drop policy if exists "user_skills_read_all" on public.user_skills;
drop policy if exists "user_skills_write_own" on public.user_skills;

create policy "user_skills_read_all"
  on public.user_skills for select
  using (auth.role() = 'authenticated');

create policy "user_skills_write_own"
  on public.user_skills for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- projects (collab board)
-- ============================================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  status text default 'active' check (status in ('active','completed')),
  created_at timestamp default now()
);

create index if not exists projects_owner_idx on public.projects (owner_id);

alter table public.projects enable row level security;

drop policy if exists "projects_read_all" on public.projects;
drop policy if exists "projects_write_owner" on public.projects;

create policy "projects_read_all"
  on public.projects for select
  using (auth.role() = 'authenticated');

create policy "projects_write_owner"
  on public.projects for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ============================================================================
-- posts.room_type — structured cohort-room post types
-- ============================================================================
alter table public.posts add column if not exists room_type text;
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'posts_room_type_check'
  ) then
    alter table public.posts
      add constraint posts_room_type_check
      check (room_type is null or room_type in ('question','update','decision','win','blocker'));
  end if;
end $$;

-- ============================================================================
-- handshakes
-- ============================================================================
create table if not exists public.handshakes (
  id uuid primary key default gen_random_uuid(),
  initiator_id uuid references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  agreement text,
  date date default current_date,
  created_at timestamp default now()
);

create index if not exists handshakes_initiator_idx on public.handshakes (initiator_id, created_at desc);
create index if not exists handshakes_recipient_idx on public.handshakes (recipient_id, created_at desc);

alter table public.handshakes enable row level security;

drop policy if exists "handshakes_read_party" on public.handshakes;
drop policy if exists "handshakes_insert_initiator" on public.handshakes;

create policy "handshakes_read_party"
  on public.handshakes for select
  using (auth.role() = 'authenticated');

create policy "handshakes_insert_initiator"
  on public.handshakes for insert
  with check (auth.uid() = initiator_id);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text,
  joined_at timestamp default now(),
  unique (project_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members (user_id);
create index if not exists project_members_project_idx on public.project_members (project_id);

alter table public.project_members enable row level security;

drop policy if exists "project_members_read_all" on public.project_members;
drop policy if exists "project_members_insert_self_or_owner" on public.project_members;

create policy "project_members_read_all"
  on public.project_members for select
  using (auth.role() = 'authenticated');

create policy "project_members_insert_self_or_owner"
  on public.project_members for insert
  with check (
    auth.uid() = user_id
    or exists (select 1 from public.projects p where p.id = project_members.project_id and p.owner_id = auth.uid())
  );

-- ============================================================================
-- recognition system
-- ============================================================================

-- one-time flag for first honest (anonymous) post notice
alter table public.profiles add column if not exists has_seen_first_honest_message boolean default false;

-- capture poster's local hour so we can quietly render a glow on 00:00-04:00 posts
alter table public.posts add column if not exists local_hour smallint;

-- post replies (threaded responses). minimal table; powers "moved the room",
-- "question responder" indicator, and "response rate mirror".
create table if not exists public.post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamp default now()
);

create index if not exists post_replies_post_idx on public.post_replies (post_id, created_at);
create index if not exists post_replies_author_idx on public.post_replies (author_id, created_at desc);

alter table public.post_replies enable row level security;

drop policy if exists "post_replies_read_all" on public.post_replies;
drop policy if exists "post_replies_insert_own" on public.post_replies;

create policy "post_replies_read_all"
  on public.post_replies for select
  using (auth.role() = 'authenticated');

create policy "post_replies_insert_own"
  on public.post_replies for insert
  with check (auth.uid() = author_id);

do $$ begin
  alter publication supabase_realtime add table public.post_replies;
exception when duplicate_object then null;
end $$;

-- keep posts.reply_count in sync
create or replace function public.post_replies_bump_count()
returns trigger language plpgsql security definer as $$
begin
  update public.posts set reply_count = coalesce(reply_count, 0) + 1 where id = new.post_id;
  return new;
end; $$;

drop trigger if exists post_replies_bump_trigger on public.post_replies;
create trigger post_replies_bump_trigger
  after insert on public.post_replies
  for each row execute function public.post_replies_bump_count();

-- vouches: one founder vouching for another
create table if not exists public.vouches (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid references public.profiles(id) on delete cascade,
  vouched_for_id uuid references public.profiles(id) on delete cascade,
  note text,
  created_at timestamp default now(),
  unique (voucher_id, vouched_for_id),
  check (voucher_id <> vouched_for_id)
);

create index if not exists vouches_vouched_for_idx on public.vouches (vouched_for_id, created_at desc);
create index if not exists vouches_voucher_idx on public.vouches (voucher_id, created_at desc);

alter table public.vouches enable row level security;

drop policy if exists "vouches_read_all" on public.vouches;
drop policy if exists "vouches_insert_own" on public.vouches;
drop policy if exists "vouches_delete_own" on public.vouches;

create policy "vouches_read_all"
  on public.vouches for select
  using (auth.role() = 'authenticated');

create policy "vouches_insert_own"
  on public.vouches for insert
  with check (auth.uid() = voucher_id);

create policy "vouches_delete_own"
  on public.vouches for delete
  using (auth.uid() = voucher_id);

-- one-time recognition notices delivered on home screen
-- kinds: 'first_honest', 'connector'
create table if not exists public.recognition_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('first_honest','connector','stage_advance')),
  payload jsonb default '{}'::jsonb,
  seen_at timestamp,
  created_at timestamp default now()
);

-- widen the kind check for existing installs that ran the earlier version
do $$ begin
  alter table public.recognition_notices drop constraint if exists recognition_notices_kind_check;
  alter table public.recognition_notices
    add constraint recognition_notices_kind_check
    check (kind in ('first_honest','connector','stage_advance'));
end $$;

create index if not exists recognition_notices_user_unseen_idx
  on public.recognition_notices (user_id) where seen_at is null;

alter table public.recognition_notices enable row level security;

drop policy if exists "recognition_notices_read_own" on public.recognition_notices;
drop policy if exists "recognition_notices_update_own" on public.recognition_notices;

create policy "recognition_notices_read_own"
  on public.recognition_notices for select
  using (auth.uid() = user_id);

create policy "recognition_notices_update_own"
  on public.recognition_notices for update
  using (auth.uid() = user_id);

-- introductions logged for the "connector" award. inserted by introducer when
-- they bring two founders together (e.g. mention both in a post or via an intro
-- action). awarded flips true when both people DM each other for the first time.
create table if not exists public.introductions (
  id uuid primary key default gen_random_uuid(),
  introducer_id uuid references public.profiles(id) on delete cascade,
  person_a_id uuid references public.profiles(id) on delete cascade,
  person_b_id uuid references public.profiles(id) on delete cascade,
  awarded boolean default false,
  created_at timestamp default now(),
  check (person_a_id <> person_b_id and introducer_id not in (person_a_id, person_b_id))
);

create index if not exists introductions_introducer_idx on public.introductions (introducer_id);
create index if not exists introductions_pair_idx on public.introductions (person_a_id, person_b_id);

alter table public.introductions enable row level security;

drop policy if exists "introductions_read_party" on public.introductions;
drop policy if exists "introductions_insert_own" on public.introductions;

create policy "introductions_read_party"
  on public.introductions for select
  using (
    auth.uid() in (introducer_id, person_a_id, person_b_id)
  );

create policy "introductions_insert_own"
  on public.introductions for insert
  with check (auth.uid() = introducer_id);

-- ============================================================================
-- vault rebuild — saved_items, notes, note_collections, nominations, wisdom
-- The old vault_posts table is fully replaced by this system.
-- ============================================================================
drop table if exists public.vault_posts cascade;

-- saved_items: anything a user bookmarks from anywhere on Quorum
create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('pulse_post','cohort_post','project')),
  item_id uuid not null,
  personal_note text,
  created_at timestamp default now(),
  unique (user_id, item_type, item_id)
);

create index if not exists saved_items_user_idx on public.saved_items (user_id, created_at desc);
create index if not exists saved_items_lookup_idx on public.saved_items (item_type, item_id);

alter table public.saved_items enable row level security;

drop policy if exists "saved_items_read_own" on public.saved_items;
drop policy if exists "saved_items_write_own" on public.saved_items;
drop policy if exists "saved_items_update_own" on public.saved_items;
drop policy if exists "saved_items_delete_own" on public.saved_items;

create policy "saved_items_read_own"
  on public.saved_items for select
  using (auth.uid() = user_id);

create policy "saved_items_write_own"
  on public.saved_items for insert
  with check (auth.uid() = user_id);

create policy "saved_items_update_own"
  on public.saved_items for update
  using (auth.uid() = user_id);

create policy "saved_items_delete_own"
  on public.saved_items for delete
  using (auth.uid() = user_id);

do $$ begin
  alter publication supabase_realtime add table public.saved_items;
exception when duplicate_object then null;
end $$;

-- note_collections: user-defined folders for notes
create table if not exists public.note_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamp default now()
);

create index if not exists note_collections_user_idx on public.note_collections (user_id, created_at);

alter table public.note_collections enable row level security;

drop policy if exists "note_collections_all_own" on public.note_collections;
create policy "note_collections_all_own"
  on public.note_collections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- notes: private block-based personal notes
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text default '',
  content jsonb default '[]'::jsonb,
  collection_id uuid references public.note_collections(id) on delete set null,
  tags text[] default '{}',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index if not exists notes_user_idx on public.notes (user_id, updated_at desc);

alter table public.notes enable row level security;

drop policy if exists "notes_all_own" on public.notes;
create policy "notes_all_own"
  on public.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$ begin
  alter publication supabase_realtime add table public.notes;
exception when duplicate_object then null;
end $$;

-- vault_nominations: pulse posts proposed for community_wisdom
create table if not exists public.vault_nominations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  nominated_by uuid references public.profiles(id) on delete cascade,
  reason text,
  status text default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamp default now(),
  unique (post_id, nominated_by)
);

create index if not exists vault_nominations_status_idx on public.vault_nominations (status, created_at desc);

alter table public.vault_nominations enable row level security;

drop policy if exists "vault_nominations_insert_auth" on public.vault_nominations;
drop policy if exists "vault_nominations_read_own" on public.vault_nominations;

create policy "vault_nominations_insert_auth"
  on public.vault_nominations for insert
  with check (auth.uid() = nominated_by);

-- Nominators can read their own; admin reads via service role.
create policy "vault_nominations_read_own"
  on public.vault_nominations for select
  using (auth.uid() = nominated_by);

-- community_wisdom: approved nominations, visible to all authenticated users
create table if not exists public.community_wisdom (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  nominated_by uuid references public.profiles(id) on delete set null,
  nomination_reason text,
  approved_at timestamp default now(),
  created_at timestamp default now(),
  unique (post_id)
);

create index if not exists community_wisdom_created_idx on public.community_wisdom (created_at desc);

alter table public.community_wisdom enable row level security;

drop policy if exists "community_wisdom_read_all" on public.community_wisdom;

create policy "community_wisdom_read_all"
  on public.community_wisdom for select
  using (auth.role() = 'authenticated');

do $$ begin
  alter publication supabase_realtime add table public.community_wisdom;
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- collab board: extend projects + new tables
-- ============================================================================

-- extend existing projects table for the collab board (additive — keeps name/owner_id/active|completed working for the profile page)
alter table public.projects add column if not exists title text;
alter table public.projects add column if not exists category text;
alter table public.projects add column if not exists looking_for text;
alter table public.projects add column if not exists post_type text default 'project';

-- widen the status check to also allow 'open' / 'closed' used by the collab board
do $$ begin
  alter table public.projects drop constraint if exists projects_status_check;
  alter table public.projects
    add constraint projects_status_check
    check (status in ('active','completed','open','closed'));
end $$;

do $$ begin
  alter table public.projects drop constraint if exists projects_post_type_check;
  alter table public.projects
    add constraint projects_post_type_check
    check (post_type in ('project','need'));
end $$;

-- backfill title from name so listings work for any legacy rows
update public.projects set title = name where title is null and name is not null;

-- name is currently NOT NULL — make sure new collab inserts that omit name still succeed by mirroring it from title via trigger
create or replace function public.projects_sync_name_title()
returns trigger language plpgsql as $$
begin
  if new.title is null and new.name is not null then new.title := new.name; end if;
  if new.name is null and new.title is not null then new.name := new.title; end if;
  return new;
end; $$;

drop trigger if exists projects_sync_name_title_trigger on public.projects;
create trigger projects_sync_name_title_trigger
  before insert or update on public.projects
  for each row execute function public.projects_sync_name_title();

-- ============================================================================
-- project_interests — who tapped "respond →" on a project
-- ============================================================================
create table if not exists public.project_interests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  note text,
  created_at timestamp default now(),
  unique (project_id, user_id)
);

create index if not exists project_interests_project_idx on public.project_interests (project_id);

alter table public.project_interests enable row level security;

drop policy if exists "project_interests_read_all" on public.project_interests;
drop policy if exists "project_interests_insert_own" on public.project_interests;

create policy "project_interests_read_all"
  on public.project_interests for select
  using (auth.role() = 'authenticated');

create policy "project_interests_insert_own"
  on public.project_interests for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- project_messages — thread inside a project room
-- ============================================================================
create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  is_system boolean default false,
  created_at timestamp default now()
);

create index if not exists project_messages_project_idx on public.project_messages (project_id, created_at);

alter table public.project_messages enable row level security;

drop policy if exists "project_messages_read_members" on public.project_messages;
drop policy if exists "project_messages_insert_members" on public.project_messages;

create policy "project_messages_read_members"
  on public.project_messages for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_messages.project_id and pm.user_id = auth.uid()
    )
  );

create policy "project_messages_insert_members"
  on public.project_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = project_messages.project_id and pm.user_id = auth.uid()
    )
  );

do $$ begin
  alter publication supabase_realtime add table public.project_messages;
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- shared_docs — doc metadata entries inside a project room
-- ============================================================================
create table if not exists public.shared_docs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  created_at timestamp default now()
);

create index if not exists shared_docs_project_idx on public.shared_docs (project_id, created_at desc);

alter table public.shared_docs enable row level security;

drop policy if exists "shared_docs_read_members" on public.shared_docs;
drop policy if exists "shared_docs_insert_members" on public.shared_docs;

create policy "shared_docs_read_members"
  on public.shared_docs for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = shared_docs.project_id and pm.user_id = auth.uid()
    )
  );

create policy "shared_docs_insert_members"
  on public.shared_docs for insert
  with check (
    auth.uid() = added_by
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = shared_docs.project_id and pm.user_id = auth.uid()
    )
  );

-- when a doc is added, drop a system message into the thread
create or replace function public.shared_docs_system_message()
returns trigger language plpgsql security definer as $$
declare
  uname text;
begin
  select coalesce(username, lower(full_name)) into uname from public.profiles where id = new.added_by;
  insert into public.project_messages (project_id, sender_id, content, is_system)
  values (new.project_id, new.added_by, coalesce(uname, 'someone') || ' added ' || new.title, true);
  return new;
end; $$;

drop trigger if exists shared_docs_system_message_trigger on public.shared_docs;
create trigger shared_docs_system_message_trigger
  after insert on public.shared_docs
  for each row execute function public.shared_docs_system_message();

-- ============================================================================
-- decisions — votes inside a project room
-- ============================================================================
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  options jsonb not null default '[]'::jsonb,
  status text default 'open' check (status in ('open','decided')),
  winning_option text,
  created_at timestamp default now()
);

create index if not exists decisions_project_idx on public.decisions (project_id, created_at desc);

alter table public.decisions enable row level security;

drop policy if exists "decisions_read_members" on public.decisions;
drop policy if exists "decisions_insert_members" on public.decisions;
drop policy if exists "decisions_update_members" on public.decisions;

create policy "decisions_read_members"
  on public.decisions for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = decisions.project_id and pm.user_id = auth.uid()
    )
  );

create policy "decisions_insert_members"
  on public.decisions for insert
  with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = decisions.project_id and pm.user_id = auth.uid()
    )
  );

create policy "decisions_update_members"
  on public.decisions for update
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = decisions.project_id and pm.user_id = auth.uid()
    )
  );

create table if not exists public.decision_votes (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid references public.decisions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  option_chosen text not null,
  created_at timestamp default now(),
  unique (decision_id, user_id)
);

create index if not exists decision_votes_decision_idx on public.decision_votes (decision_id);

alter table public.decision_votes enable row level security;

drop policy if exists "decision_votes_read_members" on public.decision_votes;
drop policy if exists "decision_votes_insert_members" on public.decision_votes;

create policy "decision_votes_read_members"
  on public.decision_votes for select
  using (
    exists (
      select 1 from public.decisions d
      join public.project_members pm on pm.project_id = d.project_id
      where d.id = decision_votes.decision_id and pm.user_id = auth.uid()
    )
  );

create policy "decision_votes_insert_members"
  on public.decision_votes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.decisions d
      join public.project_members pm on pm.project_id = d.project_id
      where d.id = decision_votes.decision_id and pm.user_id = auth.uid()
    )
  );

-- when a decision is created, drop a system message
create or replace function public.decisions_system_message()
returns trigger language plpgsql security definer as $$
declare uname text;
begin
  select coalesce(username, lower(full_name)) into uname from public.profiles where id = new.created_by;
  insert into public.project_messages (project_id, sender_id, content, is_system)
  values (new.project_id, new.created_by, coalesce(uname, 'someone') || ' opened a decision: ' || new.title, true);
  return new;
end; $$;

drop trigger if exists decisions_system_message_trigger on public.decisions;
create trigger decisions_system_message_trigger
  after insert on public.decisions
  for each row execute function public.decisions_system_message();

-- auto-add project author/owner as the first member
create or replace function public.projects_add_owner_as_member()
returns trigger language plpgsql security definer as $$
begin
  if new.owner_id is not null then
    insert into public.project_members (project_id, user_id, role)
    values (new.id, new.owner_id, 'owner')
    on conflict do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists projects_add_owner_member_trigger on public.projects;
create trigger projects_add_owner_member_trigger
  after insert on public.projects
  for each row execute function public.projects_add_owner_as_member();
