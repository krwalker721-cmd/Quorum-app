-- ---------------------------------------------------------------------------
-- 028 — The team room: who on the team is active, seen, or asleep
--
-- The room's header shows each teammate's last activity, and while the Sprint
-- is live it softly flags a teammate who has gone quiet for three waking
-- hours. "Waking" needs two things the app didn't know:
--   * each member's time zone (their 11 pm – 7 am never counts as quiet),
--     reported by their own browser whenever they open the room;
--   * "Sleeping until…", which a member sets for naps or odd schedules.
--
-- hackathon_team_member_activity is one row per person on a team:
--   last_active_at  their last contribution: a message (not system lines,
--                   edits or deletions), a doc created or edited, a link, a
--                   vote, a ballot. Kept by triggers, like the arena's pulse.
--   last_seen_at    the last time they had the room open (hackathon_room_seen,
--                   at most once a minute).
--   time_zone       from their browser, checked against pg_timezone_names.
--   sleeping_until  set by hackathon_room_sleep; any contribution clears a
--                   sleep still running.
--
-- It is part of the sealed room: readable by that team's members and admins
-- (private.can_read_team_room), never by spectators, judges or other teams.
-- Nobody writes it directly. It is in realtime so the header updates live.
--
-- Room writes are unchanged: open until the reveal (decision 12; the owner
-- kept it in Phase 6).
--
-- RUN AFTER 027. Idempotent.
-- ---------------------------------------------------------------------------

create table if not exists public.hackathon_team_member_activity (
  team_id        uuid not null references public.hackathon_teams(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  hackathon_id   uuid not null references public.hackathons(id) on delete cascade,
  last_active_at timestamptz,
  last_seen_at   timestamptz,
  time_zone      text check (time_zone is null or char_length(time_zone) <= 64),
  sleeping_until timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists hackathon_team_member_activity_user_idx
  on public.hackathon_team_member_activity (user_id);

alter table public.hackathon_team_member_activity enable row level security;
revoke all on public.hackathon_team_member_activity from anon, authenticated;
grant select on public.hackathon_team_member_activity to authenticated;

drop policy if exists "hackathon_team_member_activity_read" on public.hackathon_team_member_activity;
create policy "hackathon_team_member_activity_read"
  on public.hackathon_team_member_activity for select to authenticated
  using (private.can_read_team_room(team_id, auth.uid()));
-- No write policies: only the triggers and functions below write it.

-- ============================================================================
-- Rows follow team membership
-- ============================================================================
create or replace function private.hackathon_member_activity_roster()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and (tg_op = 'DELETE' or old.team_id is distinct from new.team_id) then
    delete from public.hackathon_team_member_activity
    where team_id = old.team_id and user_id = old.user_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.hackathon_team_member_activity (team_id, user_id, hackathon_id)
    values (new.team_id, new.user_id, new.hackathon_id)
    on conflict (team_id, user_id) do nothing;
  end if;
  return null;
end $$;

drop trigger if exists hackathon_member_activity_roster_trigger on public.hackathon_team_members;
create trigger hackathon_member_activity_roster_trigger
  after insert or update or delete on public.hackathon_team_members
  for each row execute function private.hackathon_member_activity_roster();

-- ============================================================================
-- Contributions move last_active_at
-- ============================================================================
-- The same events as the arena's pulse (027), credited to the person who did
-- them. Only current members of the team are tracked.
create or replace function private.hackathon_member_activity_bump()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid;
  v_at timestamptz;
begin
  if tg_table_name = 'hackathon_team_messages' then
    if tg_op = 'UPDATE' or new.is_system then
      return null;
    end if;
    v_actor := new.user_id;
    v_at := new.created_at;
  elsif tg_table_name = 'hackathon_team_docs' then
    v_actor := case when tg_op = 'INSERT' then coalesce(new.updated_by, new.created_by) else new.updated_by end;
    v_at := new.updated_at;
  elsif tg_table_name = 'hackathon_team_ballots' then
    v_actor := new.user_id;
    v_at := new.updated_at;
  else -- links, votes
    v_actor := new.created_by;
    v_at := new.created_at;
  end if;
  v_at := coalesce(v_at, now());

  if v_actor is null then
    return null;
  end if;

  insert into public.hackathon_team_member_activity as a (team_id, user_id, hackathon_id, last_active_at)
  select m.team_id, m.user_id, m.hackathon_id, v_at
  from public.hackathon_team_members m
  where m.team_id = new.team_id and m.user_id = v_actor
  on conflict (team_id, user_id) do update set
    last_active_at = greatest(a.last_active_at, excluded.last_active_at),
    -- Doing something means they're awake.
    sleeping_until = case when a.sleeping_until > now() then null else a.sleeping_until end,
    updated_at     = now();
  return null;
end $$;

drop trigger if exists hackathon_member_activity_messages_trigger on public.hackathon_team_messages;
create trigger hackathon_member_activity_messages_trigger
  after insert on public.hackathon_team_messages
  for each row execute function private.hackathon_member_activity_bump();
drop trigger if exists hackathon_member_activity_docs_trigger on public.hackathon_team_docs;
create trigger hackathon_member_activity_docs_trigger
  after insert or update on public.hackathon_team_docs
  for each row execute function private.hackathon_member_activity_bump();
drop trigger if exists hackathon_member_activity_links_trigger on public.hackathon_team_links;
create trigger hackathon_member_activity_links_trigger
  after insert on public.hackathon_team_links
  for each row execute function private.hackathon_member_activity_bump();
drop trigger if exists hackathon_member_activity_votes_trigger on public.hackathon_team_votes;
create trigger hackathon_member_activity_votes_trigger
  after insert on public.hackathon_team_votes
  for each row execute function private.hackathon_member_activity_bump();
drop trigger if exists hackathon_member_activity_ballots_trigger on public.hackathon_team_ballots;
create trigger hackathon_member_activity_ballots_trigger
  after insert or update on public.hackathon_team_ballots
  for each row execute function private.hackathon_member_activity_bump();

-- ============================================================================
-- Seen, and asleep
-- ============================================================================
-- The room calls this when it opens and every few minutes while it's visible.
-- A time zone the database doesn't know is ignored, not stored.
create or replace function public.hackathon_room_seen(p_team_id uuid, p_time_zone text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_tz text;
begin
  if uid is null or not private.is_team_member(p_team_id, uid) then
    raise exception 'Only this team''s members can do that.' using errcode = '42501', hint = 'not_member';
  end if;
  if p_time_zone is not null and char_length(p_time_zone) <= 64
     and exists (select 1 from pg_timezone_names where name = p_time_zone) then
    v_tz := p_time_zone;
  end if;

  insert into public.hackathon_team_member_activity as a (team_id, user_id, hackathon_id, last_seen_at, time_zone)
  values (p_team_id, uid, private.team_hackathon_id(p_team_id), now(), v_tz)
  on conflict (team_id, user_id) do update set
    last_seen_at = now(),
    time_zone    = coalesce(excluded.time_zone, a.time_zone),
    updated_at   = now()
  where a.last_seen_at is null
     or a.last_seen_at < now() - interval '1 minute'
     or a.time_zone is distinct from coalesce(excluded.time_zone, a.time_zone);
end $$;

-- "Sleeping until…": up to 12 hours ahead; null wakes them. Only while the
-- room is open for writing, like everything else a member does there.
create or replace function public.hackathon_room_sleep(p_team_id uuid, p_until timestamptz)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not private.is_team_member(p_team_id, uid) then
    raise exception 'Only this team''s members can do that.' using errcode = '42501', hint = 'not_member';
  end if;
  if not private.can_write_team_room(p_team_id, uid) then
    raise exception 'The room is read-only now.' using errcode = '42501', hint = 'room_closed';
  end if;
  if p_until is not null and (p_until <= now() or p_until > now() + interval '12 hours') then
    raise exception 'Pick a time in the next 12 hours.' using errcode = '22023', hint = 'bad_sleep';
  end if;

  insert into public.hackathon_team_member_activity as a (team_id, user_id, hackathon_id, sleeping_until)
  values (p_team_id, uid, private.team_hackathon_id(p_team_id), p_until)
  on conflict (team_id, user_id) do update set
    -- Waking early keeps the moment they woke, so quiet time counts from it.
    sleeping_until = case when excluded.sleeping_until is null and a.sleeping_until > now()
                          then now() else excluded.sleeping_until end,
    updated_at     = now();
  return p_until;
end $$;

-- ============================================================================
-- Every team member that already exists, from what the rooms hold now
-- ============================================================================
insert into public.hackathon_team_member_activity (team_id, user_id, hackathon_id, last_active_at)
select m.team_id, m.user_id, m.hackathon_id,
  greatest(
    (select max(x.created_at) from public.hackathon_team_messages x
      where x.team_id = m.team_id and x.user_id = m.user_id and not x.is_system),
    (select max(x.updated_at) from public.hackathon_team_docs x
      where x.team_id = m.team_id and coalesce(x.updated_by, x.created_by) = m.user_id),
    (select max(x.created_at) from public.hackathon_team_links x
      where x.team_id = m.team_id and x.created_by = m.user_id),
    (select max(x.created_at) from public.hackathon_team_votes x
      where x.team_id = m.team_id and x.created_by = m.user_id),
    (select max(x.updated_at) from public.hackathon_team_ballots x
      where x.team_id = m.team_id and x.user_id = m.user_id)
  )
from public.hackathon_team_members m
on conflict (team_id, user_id) do update set
  last_active_at = greatest(public.hackathon_team_member_activity.last_active_at, excluded.last_active_at),
  updated_at     = now();

-- ============================================================================
-- Grants and realtime
-- ============================================================================
grant execute on all functions in schema private to anon, authenticated, service_role;

revoke execute on function public.hackathon_room_seen(uuid, text) from public, anon;
grant execute on function public.hackathon_room_seen(uuid, text) to authenticated;
revoke execute on function public.hackathon_room_sleep(uuid, timestamptz) from public, anon;
grant execute on function public.hackathon_room_sleep(uuid, timestamptz) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.hackathon_team_member_activity;
exception when duplicate_object then null;
end $$;
