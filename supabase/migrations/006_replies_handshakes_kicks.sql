-- 006_replies_handshakes_kicks.sql
-- Run this in the Supabase SQL editor.
--
-- Covers five feature changes:
--   1. Post creation cohort validation (INSERT RLS on posts)
--   2. Cohort fill metric — no schema change (query fix in app)
--   3. Handshake privacy (SELECT RLS) + optional project scoping
--   4. Replies on posts (posts.parent_post_id, reply_count sync, notify)
--   5. Kick from projects and cohorts (DELETE RLS, is_creator, realtime)

-- ============================================================================
-- CHANGE 3 — post creation cohort validation
-- ============================================================================
-- A user may only create a cohort post in a cohort they belong to. Pulse posts
-- are always allowed. my_cohort_ids() is SECURITY DEFINER so it does not
-- recurse through posts' own RLS.
drop policy if exists "authenticated_insert_posts" on public.posts;
drop policy if exists "Users can create posts" on public.posts;
create policy "Users can create posts" on public.posts
  for insert with check (
    auth.uid() = author_id
    and (
      post_type = 'pulse'
      or (
        post_type = 'cohort'
        and cohort_id in (select public.my_cohort_ids())
      )
    )
  );

-- ============================================================================
-- CHANGE 1 — replies on posts
-- ============================================================================
-- Replies are posts with parent_post_id pointing at the post they reply to.
-- Top-level posts have parent_post_id = null. One level of nesting only.
alter table public.posts
  add column if not exists parent_post_id uuid references public.posts(id) on delete cascade;
create index if not exists posts_parent_post_id_idx on public.posts (parent_post_id);

-- Keep posts.reply_count in sync with the number of child posts.
create or replace function public.posts_reply_count_sync()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') and new.parent_post_id is not null then
    update public.posts
      set reply_count = coalesce(reply_count, 0) + 1
      where id = new.parent_post_id;
  elsif (tg_op = 'DELETE') and old.parent_post_id is not null then
    update public.posts
      set reply_count = greatest(coalesce(reply_count, 0) - 1, 0)
      where id = old.parent_post_id;
  end if;
  return null;
end; $$;

drop trigger if exists posts_reply_count_trigger on public.posts;
create trigger posts_reply_count_trigger
  after insert or delete on public.posts
  for each row execute function public.posts_reply_count_sync();

-- Notify the parent post's author when someone replies (skips self-replies and
-- carries the author name unless the reply is anonymous).
create or replace function public.posts_reply_notify()
returns trigger language plpgsql security definer as $$
declare
  parent_author uuid;
  replier_name text;
begin
  if new.parent_post_id is null then return new; end if;
  select author_id into parent_author from public.posts where id = new.parent_post_id;
  if parent_author is null or parent_author = new.author_id then return new; end if;
  if new.is_anonymous then
    replier_name := 'someone';
  else
    select coalesce(full_name, username, 'someone') into replier_name
      from public.profiles where id = new.author_id;
  end if;
  insert into public.notifications (user_id, kind, message, payload)
  values (
    parent_author,
    'reply',
    coalesce(replier_name, 'someone') || ' replied to your post',
    jsonb_build_object('post_id', new.parent_post_id, 'reply_id', new.id, 'post_type', new.post_type)
  );
  return new;
end; $$;

drop trigger if exists posts_reply_notify_trigger on public.posts;
create trigger posts_reply_notify_trigger
  after insert on public.posts
  for each row execute function public.posts_reply_notify();

-- ============================================================================
-- CHANGE 2 — handshake privacy + project scoping
-- ============================================================================
drop policy if exists "handshakes_read_party" on public.handshakes;
drop policy if exists "Users can view handshakes" on public.handshakes;
drop policy if exists "Users can view own handshakes" on public.handshakes;
create policy "Users can view own handshakes" on public.handshakes
  for select using (
    auth.uid() = initiator_id or auth.uid() = recipient_id
  );

-- Optional: which project room a handshake was logged in (null = profile/global).
alter table public.handshakes
  add column if not exists project_id uuid references public.projects(id) on delete set null;

-- ============================================================================
-- CHANGE 5 — kick from projects and cohorts
-- ============================================================================

-- Project creators (projects.owner_id) can remove other members.
drop policy if exists "Project creators can remove members" on public.project_members;
create policy "Project creators can remove members" on public.project_members
  for delete using (
    auth.uid() = (select owner_id from public.projects where id = project_members.project_id)
    and user_id != auth.uid()
  );

-- Track the cohort creator so they (and only they) can kick members.
alter table public.cohort_members add column if not exists is_creator boolean default false;

-- Backfill: earliest member of each cohort is the creator.
update public.cohort_members cm
  set is_creator = true
  where cm.joined_at = (
    select min(joined_at) from public.cohort_members where cohort_id = cm.cohort_id
  );

-- Helper: cohort ids where the current user is the creator. SECURITY DEFINER so
-- the DELETE policy below does not recurse through cohort_members' own RLS.
create or replace function public.my_creator_cohort_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select cohort_id from public.cohort_members
  where user_id = auth.uid() and is_creator = true;
$$;

drop policy if exists "Cohort creators can remove members" on public.cohort_members;
create policy "Cohort creators can remove members" on public.cohort_members
  for delete using (
    user_id != auth.uid()
    and cohort_id in (select public.my_creator_cohort_ids())
  );

-- ============================================================================
-- realtime — replica identity FULL so DELETE events carry user_id/project_id,
-- and publication membership for the kick-redirect + live-count subscriptions.
-- ============================================================================
alter table public.project_members replica identity full;
alter table public.cohort_members replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.project_members;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.cohort_members;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
