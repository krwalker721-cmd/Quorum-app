-- ---------------------------------------------------------------------------
-- 027 — The arena's live pulse, sealed by design; members' cohorts
--
-- The arena shows every team working without showing what it's making. Its
-- live updates can't come from the room tables: realtime sends whole rows, so
-- a subscription there would carry message text the moment a rule slipped
-- (and spectators, rightly, get nothing from them).
--
-- hackathon_team_pulse is one row per team holding only
--   team, Sprint, activity count, last active, submitted (and when)
-- kept up to date by triggers on the team room tables and submissions. It is
-- in realtime and readable by the arena's audience (private.can_view_arena),
-- so spectators get a live pulse whose payload has nothing in it to leak.
-- Nobody writes it directly.
--
-- hackathon_arena_cohorts(id) gives the same audience the cohort NAME of each
-- person on a team in that Sprint, and nothing else about cohorts. (Who is in
-- which cohort is otherwise visible only to co-members; cohort names are
-- already readable by every member.)
--
-- RUN AFTER 026. Idempotent.
-- ---------------------------------------------------------------------------

create table if not exists public.hackathon_team_pulse (
  team_id        uuid primary key references public.hackathon_teams(id) on delete cascade,
  hackathon_id   uuid not null references public.hackathons(id) on delete cascade,
  activity_count integer not null default 0,
  last_active_at timestamptz,
  has_submitted  boolean not null default false,
  submitted_at   timestamptz,
  updated_at     timestamptz not null default now()
);
create index if not exists hackathon_team_pulse_hackathon_idx on public.hackathon_team_pulse (hackathon_id);

alter table public.hackathon_team_pulse enable row level security;
revoke all on public.hackathon_team_pulse from anon, authenticated;
grant select on public.hackathon_team_pulse to authenticated;

drop policy if exists "hackathon_team_pulse_read_arena" on public.hackathon_team_pulse;
create policy "hackathon_team_pulse_read_arena"
  on public.hackathon_team_pulse for select to authenticated
  using (private.can_view_arena(hackathon_id, auth.uid()));
-- No write policies: only the triggers below write it.

-- A new team starts with a quiet pulse, so its first activity is an UPDATE
-- that realtime delivers like any other.
create or replace function private.hackathon_team_pulse_new_team()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.hackathon_team_pulse (team_id, hackathon_id)
  values (new.id, new.hackathon_id)
  on conflict (team_id) do nothing;
  return null;
end $$;

drop trigger if exists hackathon_team_pulse_new_team_trigger on public.hackathon_teams;
create trigger hackathon_team_pulse_new_team_trigger
  after insert on public.hackathon_teams
  for each row execute function private.hackathon_team_pulse_new_team();

-- Something happened in a team's room, or its submission was saved. Counts
-- and times only: nothing from the row itself is copied.
create or replace function private.hackathon_team_pulse_bump()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_at timestamptz;
  v_submitted boolean := tg_table_name = 'hackathon_submissions';
begin
  if tg_table_name = 'hackathon_team_messages' then
    -- Edits, soft deletes and system lines ("Alice added a doc") aren't new activity.
    if tg_op = 'UPDATE' then
      return null;
    end if;
    if new.is_system then
      return null;
    end if;
  end if;
  if tg_table_name in ('hackathon_team_docs', 'hackathon_team_ballots', 'hackathon_submissions') then
    v_at := coalesce(new.updated_at, now());
  else
    v_at := coalesce(new.created_at, now());
  end if;

  insert into public.hackathon_team_pulse as p (team_id, hackathon_id, activity_count, last_active_at, has_submitted, submitted_at)
  select t.id, t.hackathon_id, 1, v_at, v_submitted, case when v_submitted then v_at end
  from public.hackathon_teams t
  where t.id = new.team_id
  on conflict (team_id) do update set
    activity_count = p.activity_count + 1,
    last_active_at = greatest(p.last_active_at, excluded.last_active_at),
    has_submitted  = p.has_submitted or excluded.has_submitted,
    submitted_at   = coalesce(p.submitted_at, excluded.submitted_at),
    updated_at     = now();
  return null;
end $$;

drop trigger if exists hackathon_team_pulse_messages_trigger on public.hackathon_team_messages;
create trigger hackathon_team_pulse_messages_trigger
  after insert or update on public.hackathon_team_messages
  for each row execute function private.hackathon_team_pulse_bump();
drop trigger if exists hackathon_team_pulse_docs_trigger on public.hackathon_team_docs;
create trigger hackathon_team_pulse_docs_trigger
  after insert or update on public.hackathon_team_docs
  for each row execute function private.hackathon_team_pulse_bump();
drop trigger if exists hackathon_team_pulse_links_trigger on public.hackathon_team_links;
create trigger hackathon_team_pulse_links_trigger
  after insert on public.hackathon_team_links
  for each row execute function private.hackathon_team_pulse_bump();
drop trigger if exists hackathon_team_pulse_votes_trigger on public.hackathon_team_votes;
create trigger hackathon_team_pulse_votes_trigger
  after insert on public.hackathon_team_votes
  for each row execute function private.hackathon_team_pulse_bump();
drop trigger if exists hackathon_team_pulse_ballots_trigger on public.hackathon_team_ballots;
create trigger hackathon_team_pulse_ballots_trigger
  after insert or update on public.hackathon_team_ballots
  for each row execute function private.hackathon_team_pulse_bump();
drop trigger if exists hackathon_team_pulse_submissions_trigger on public.hackathon_submissions;
create trigger hackathon_team_pulse_submissions_trigger
  after insert or update on public.hackathon_submissions
  for each row execute function private.hackathon_team_pulse_bump();

-- Every team that already exists, from what its room holds now.
insert into public.hackathon_team_pulse (team_id, hackathon_id, activity_count, last_active_at, has_submitted, submitted_at)
select
  t.id, t.hackathon_id,
  (select count(*) from public.hackathon_team_messages m where m.team_id = t.id and not m.is_system)
    + (select count(*) from public.hackathon_team_docs d where d.team_id = t.id)
    + (select count(*) from public.hackathon_team_links l where l.team_id = t.id)
    + (select count(*) from public.hackathon_team_votes v where v.team_id = t.id)
    + (select count(*) from public.hackathon_team_ballots b where b.team_id = t.id)
    + (select count(*) from public.hackathon_submissions s where s.team_id = t.id),
  greatest(
    (select max(m.created_at) from public.hackathon_team_messages m where m.team_id = t.id and not m.is_system),
    (select max(d.updated_at) from public.hackathon_team_docs d where d.team_id = t.id),
    (select max(l.created_at) from public.hackathon_team_links l where l.team_id = t.id),
    (select max(v.created_at) from public.hackathon_team_votes v where v.team_id = t.id),
    (select max(b.updated_at) from public.hackathon_team_ballots b where b.team_id = t.id),
    (select s.updated_at from public.hackathon_submissions s where s.team_id = t.id)
  ),
  exists (select 1 from public.hackathon_submissions s where s.team_id = t.id),
  (select s.submitted_at from public.hackathon_submissions s where s.team_id = t.id)
from public.hackathon_teams t
on conflict (team_id) do update set
  activity_count = excluded.activity_count,
  last_active_at = excluded.last_active_at,
  has_submitted  = excluded.has_submitted,
  submitted_at   = excluded.submitted_at,
  updated_at     = now();

-- ============================================================================
-- Members' cohorts, for the arena
-- ============================================================================
create or replace function public.hackathon_arena_cohorts(p_hackathon_id uuid)
returns table (user_id uuid, cohort_id uuid, cohort_name text)
language sql stable security definer set search_path = public as $$
  select m.user_id, c.id, c.name
  from public.hackathon_team_members m
  cross join lateral (
    select cm.cohort_id from public.cohort_members cm
    where cm.user_id = m.user_id and cm.cohort_id is not null
    order by cm.joined_at nulls last, cm.cohort_id
    limit 1
  ) x
  join public.cohorts c on c.id = x.cohort_id
  where m.hackathon_id = p_hackathon_id
    and private.can_view_arena(p_hackathon_id, auth.uid())
$$;

-- ============================================================================
-- Grants and realtime
-- ============================================================================
grant execute on all functions in schema private to anon, authenticated, service_role;

revoke execute on function public.hackathon_arena_cohorts(uuid) from public, anon;
grant execute on function public.hackathon_arena_cohorts(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.hackathon_team_pulse;
exception when duplicate_object then null;
end $$;
