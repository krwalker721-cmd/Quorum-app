-- Migration: collab overhaul
-- Adds profiles.skills text[] (canonical skill store),
-- join_requests table for project gating, shared_docs link support,
-- need_applications table, notifications additive columns, and
-- tightens project_messages / shared_docs RLS to members-only.

-- ============================================================================
-- profiles.skills text[] (canonical)
-- ============================================================================
alter table public.profiles add column if not exists skills text[] default '{}';

-- Backfill from legacy user_skills table (kept around for safety; not authoritative)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_skills') then
    update public.profiles p
    set skills = sub.arr
    from (
      select user_id, array_agg(distinct lower(skill)) as arr
      from public.user_skills
      group by user_id
    ) sub
    where p.id = sub.user_id
      and (p.skills is null or array_length(p.skills, 1) is null);
  end if;
end $$;

-- ============================================================================
-- join_requests
-- ============================================================================
create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  requester_id uuid references public.profiles(id) on delete cascade,
  reason text not null,
  what_they_offer text,
  status text default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamp default now(),
  unique (project_id, requester_id)
);

create index if not exists join_requests_project_idx on public.join_requests (project_id, created_at desc);
create index if not exists join_requests_requester_idx on public.join_requests (requester_id);

alter table public.join_requests enable row level security;

drop policy if exists "join_requests_select_creator_or_requester" on public.join_requests;
drop policy if exists "join_requests_insert_own" on public.join_requests;
drop policy if exists "join_requests_update_creator" on public.join_requests;

create policy "join_requests_select_creator_or_requester"
  on public.join_requests for select
  using (
    auth.uid() = requester_id
    or auth.uid() = (select owner_id from public.projects where id = join_requests.project_id)
  );

create policy "join_requests_insert_own"
  on public.join_requests for insert
  with check (auth.uid() = requester_id);

create policy "join_requests_update_creator"
  on public.join_requests for update
  using (auth.uid() = (select owner_id from public.projects where id = join_requests.project_id));

do $$ begin
  alter publication supabase_realtime add table public.join_requests;
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- need_applications
-- ============================================================================
create table if not exists public.need_applications (
  id uuid primary key default gen_random_uuid(),
  need_id uuid references public.projects(id) on delete cascade,
  applicant_id uuid references public.profiles(id) on delete cascade,
  response text not null,
  created_at timestamp default now(),
  unique (need_id, applicant_id)
);

create index if not exists need_applications_need_idx on public.need_applications (need_id, created_at desc);
create index if not exists need_applications_applicant_idx on public.need_applications (applicant_id);

alter table public.need_applications enable row level security;

drop policy if exists "need_applications_select_owner_or_applicant" on public.need_applications;
drop policy if exists "need_applications_insert_own" on public.need_applications;

create policy "need_applications_select_owner_or_applicant"
  on public.need_applications for select
  using (
    auth.uid() = applicant_id
    or auth.uid() = (select owner_id from public.projects where id = need_applications.need_id)
  );

create policy "need_applications_insert_own"
  on public.need_applications for insert
  with check (auth.uid() = applicant_id);

-- ============================================================================
-- shared_docs link support
-- ============================================================================
alter table public.shared_docs add column if not exists external_url text;
alter table public.shared_docs add column if not exists doc_type text default 'file';
do $$ begin
  alter table public.shared_docs drop constraint if exists shared_docs_doc_type_check;
  alter table public.shared_docs
    add constraint shared_docs_doc_type_check
    check (doc_type in ('file','link'));
end $$;

-- ============================================================================
-- notifications: additive columns (don't break existing schema)
-- ============================================================================
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists source_id uuid;
alter table public.notifications add column if not exists source_type text;
alter table public.notifications add column if not exists read boolean default false;

-- Sync existing rows: kind -> type, seen_at -> read
update public.notifications set type = kind where type is null;
update public.notifications set read = true where seen_at is not null and read = false;

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read = false;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- Allow users to insert their own notifications (used by client helpers).
drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own"
  on public.notifications for insert
  with check (auth.uid() = user_id);

-- Allow anyone authenticated to insert notifications addressed to other users
-- (used when, e.g., a join request triggers a notification to the project owner).
drop policy if exists "notifications_insert_any" on public.notifications;
create policy "notifications_insert_any"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

-- ============================================================================
-- Tighten project_messages + shared_docs RLS to members-only (idempotent)
-- (Existing policies already do this; recreate to be safe.)
-- ============================================================================
drop policy if exists "Project members can view messages" on public.project_messages;
create policy "Project members can view messages"
  on public.project_messages for select
  using (
    auth.uid() in (
      select user_id from public.project_members where project_id = project_messages.project_id
    )
  );

drop policy if exists "Project members can view docs" on public.shared_docs;
create policy "Project members can view docs"
  on public.shared_docs for select
  using (
    auth.uid() in (
      select user_id from public.project_members where project_id = shared_docs.project_id
    )
  );

-- ============================================================================
-- Needs are lightweight posts — no project room, no auto-membership.
-- Replace the auto-owner-member trigger so it skips post_type='need'.
-- ============================================================================
create or replace function public.projects_add_owner_as_member()
returns trigger language plpgsql security definer as $$
begin
  if new.owner_id is not null and coalesce(new.post_type, 'project') <> 'need' then
    insert into public.project_members (project_id, user_id, role)
    values (new.id, new.owner_id, 'owner')
    on conflict do nothing;
  end if;
  return new;
end; $$;

-- Backfill: remove project_members rows that exist only because a need was posted.
delete from public.project_members pm
using public.projects p
where pm.project_id = p.id and p.post_type = 'need';

-- ============================================================================
-- Helper: keep profiles.skills lowercased + unique (light constraint via trigger)
-- ============================================================================
create or replace function public.profiles_normalize_skills()
returns trigger language plpgsql as $$
declare normalized text[];
begin
  if new.skills is null then
    new.skills := '{}';
  else
    select array_agg(distinct lower(trim(s))) into normalized
    from unnest(new.skills) as s
    where s is not null and trim(s) <> '';
    new.skills := coalesce(normalized, '{}');
  end if;
  return new;
end; $$;

drop trigger if exists profiles_normalize_skills_trigger on public.profiles;
create trigger profiles_normalize_skills_trigger
  before insert or update of skills on public.profiles
  for each row execute function public.profiles_normalize_skills();
