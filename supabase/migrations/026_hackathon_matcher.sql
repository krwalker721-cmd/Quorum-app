-- ---------------------------------------------------------------------------
-- 026 — The team matcher
--
-- hackathon_run_matcher(id) puts everyone registered but not on a team (the
-- random pool, plus anyone who meant to find a team and didn't) into teams,
-- once, at team lock. Service role only: the admin console's button, the
-- cron route, and the Sprint page when it loads after team lock.
--
-- ONCE ONLY. The Sprint row is locked, and the first run records matched_at
-- and a report. Every later run returns that report and changes nothing, so
-- two callers at the same moment, or the same one twice, can't double-match.
-- It only runs after team lock and while the Sprint isn't paused, cancelled
-- or unpublished. Past the submission deadline it records that it was too
-- late and does nothing else.
--
-- How it groups n people, with s = min(max_team_size, 3):
--   1. floor(n / s) new teams of s.
--   2. The r left over go, one at a time, into teams marked "open to
--      requests" that have room (smallest first), then spread across the new
--      teams up to the size limit.
--   3. If 2 or more are still left, they make one more team. If exactly 1 is
--      left, nothing had room: they stay unassigned and the report flags them
--      for an admin.
--   Seats are planned first; then people are placed one by one, biggest
--   cohort first, each into the seat whose team has the fewest people from
--   their cohort, then the fewest with the same kind of skill (technical,
--   design, business, from profiles.skills), then the fewest people. The
--   order is a hash of Sprint and person, so the same pool always gives the
--   same teams.
-- New teams get a name from a small word list ("Midnight Owls"), an emblem
-- and a colour, and their first member is the owner. Any member of a matched
-- team can rename it until the deadline (025).
--
-- RUN AFTER 025. Idempotent.
-- ---------------------------------------------------------------------------

alter table public.hackathons add column if not exists matched_at timestamptz;
alter table public.hackathons add column if not exists match_report jsonb;
-- Neither is granted to members: the report names people, and the page asks
-- through the service role.

-- The broad kind of skill someone lists, for balancing teams. NULL when they
-- list none.
create or replace function private.skill_bucket(p_skills text[])
returns text language sql immutable as $$
  select case
    when p_skills is null or cardinality(p_skills) = 0 then null
    when exists (
      select 1 from unnest(p_skills) s
      where s ~* '(engineer|develop|cod(e|ing)|program|software|back.?end|front.?end|full.?stack|devops|infra|data|machine learning|\mml\M|\mai\M|mobile|\mios\M|android|react|python|typescript|javascript|web3|blockchain|security|\mcto\M)'
    ) then 'technical'
    when exists (
      select 1 from unnest(p_skills) s
      where s ~* '(design|\mux\M|\mui\M|figma|brand|visual|illustrat|motion)'
    ) then 'design'
    else 'business'
  end
$$;

-- A new matched team with a name no other team in the Sprint has.
create or replace function private.create_matched_team(p_hackathon_id uuid, p_seed integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  adjectives constant text[] := array[
    'Midnight', 'Solar', 'Rogue', 'Lucky', 'Quiet', 'Neon', 'Swift', 'Bold', 'Clever', 'Brave',
    'Wild', 'Cosmic', 'Electric', 'Golden', 'Iron', 'Velvet', 'Atomic', 'Hidden', 'Rapid', 'Lunar'];
  nouns constant text[] := array[
    'Owls', 'Foxes', 'Comets', 'Rockets', 'Otters', 'Falcons', 'Builders', 'Sparks', 'Pilots', 'Rangers',
    'Ravens', 'Wolves', 'Tigers', 'Makers', 'Orbits', 'Lynxes', 'Badgers', 'Herons', 'Meteors', 'Shippers'];
  emblems constant text[] := array['◆', '▲', '●', '■', '✦', '◉', '⬢', '✳'];
  colors constant text[] := array['#f59e0b', '#38bdf8', '#22c55e', '#a78bfa', '#f472b6', '#fb923c', '#2dd4bf', '#facc15'];
  base bigint := hashtext(p_hackathon_id::text || ':' || p_seed::text)::bigint + 2147483648;
  v_name text;
  v_id uuid;
begin
  for i in 0..399 loop
    v_name := adjectives[1 + ((base + i) % 20)::integer] || ' ' || nouns[1 + ((base / 20 + i * 7) % 20)::integer];
    exit when not exists (
      select 1 from public.hackathon_teams t
      where t.hackathon_id = p_hackathon_id and lower(t.name) = lower(v_name)
    );
    v_name := null;
  end loop;
  v_name := coalesce(v_name, 'Team ' || p_seed::text || '-' || (base % 1000)::text);

  insert into public.hackathon_teams (hackathon_id, name, emblem, color, is_random_matched, is_open_to_requests)
  values (
    p_hackathon_id, v_name,
    emblems[1 + (base % 8)::integer], colors[1 + ((base / 8) % 8)::integer],
    true, false
  )
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.hackathon_run_matcher(p_hackathon_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  h public.hackathons%rowtype;
  v_phase text;
  s integer;
  v_max integer;
  n integer;
  k integer;
  r integer;
  v_team uuid;
  v_seq integer := 0;
  p record;
  v_flagged jsonb := '[]'::jsonb;
  v_report jsonb;
begin
  select * into h from public.hackathons where id = p_hackathon_id for update;
  if not found then
    raise exception 'That Sprint doesn''t exist.';
  end if;
  if h.matched_at is not null then
    return h.match_report || jsonb_build_object('already_matched', true);
  end if;
  if not h.is_published or h.status_override is not null then
    raise exception 'The matcher doesn''t run while a Sprint is unpublished, paused or cancelled.' using hint = 'sprint_frozen';
  end if;

  v_phase := private.hackathon_phase(p_hackathon_id);
  if v_phase in ('draft', 'upcoming', 'registration') then
    raise exception 'Teams haven''t locked yet. The matcher runs at team lock.' using hint = 'not_locked';
  end if;
  if v_phase in ('judging', 'revealed') then
    v_report := jsonb_build_object(
      'matched_at', now(), 'skipped', 'The submission deadline had passed, so nobody was matched.',
      'pool', 0, 'team_size', null, 'new_teams', '[]'::jsonb, 'joined_open_teams', '[]'::jsonb,
      'flagged', '[]'::jsonb, 'same_cohort_pairs', 0);
    update public.hackathons set matched_at = now(), match_report = v_report where id = p_hackathon_id;
    return v_report;
  end if;

  s := least(h.max_team_size, 3);
  v_max := h.max_team_size;

  -- Everyone registered and not on a team.
  drop table if exists pg_temp.hm_pool;
  create temp table hm_pool on commit drop as
  select
    r.user_id,
    (select cm.cohort_id from public.cohort_members cm
      where cm.user_id = r.user_id and cm.cohort_id is not null
      order by cm.joined_at nulls last, cm.cohort_id limit 1) as cohort,
    private.skill_bucket(pr.skills) as bucket,
    md5(p_hackathon_id::text || r.user_id::text) as ord,
    null::uuid as team_id,
    null::integer as seq
  from public.hackathon_registrations r
  join public.profiles pr on pr.id = r.user_id
  where r.hackathon_id = p_hackathon_id
    and r.withdrawn_at is null
    and not exists (
      select 1 from public.hackathon_team_members m
      where m.hackathon_id = p_hackathon_id and m.user_id = r.user_id
    );
  select count(*) into n from hm_pool;

  -- The seats this run hands out, per team.
  drop table if exists pg_temp.hm_slots;
  create temp table hm_slots (
    team_id uuid primary key,
    is_new  boolean not null,
    seats   integer not null,  -- still to fill in this run
    filled  integer not null,  -- members before this run
    room    integer not null,  -- the team's size limit
    ord     integer not null
  ) on commit drop;

  k := n / s;
  r := n % s;

  -- 1. New teams of s.
  for i in 1..k loop
    insert into hm_slots values (private.create_matched_team(p_hackathon_id, i), true, s, 0, v_max, i);
  end loop;

  -- 2a. Leftovers into teams open to requests, smallest first.
  insert into hm_slots
  select t.id, false, 0, c.n, coalesce(t.max_size_override, v_max), 1000 + row_number() over (order by c.n, t.created_at, t.id)::integer
  from public.hackathon_teams t
  cross join lateral (
    select count(*)::integer as n from public.hackathon_team_members m where m.team_id = t.id
  ) c
  where t.hackathon_id = p_hackathon_id
    and t.is_open_to_requests
    and not t.is_random_matched
    and c.n < coalesce(t.max_size_override, v_max);

  while r > 0 loop
    select sl.team_id into v_team from hm_slots sl
    where not sl.is_new and sl.filled + sl.seats < sl.room
    order by sl.filled + sl.seats, sl.ord
    limit 1;
    exit when not found;
    update hm_slots set seats = seats + 1 where team_id = v_team;
    r := r - 1;
  end loop;

  -- 2b. Then across the new teams, up to the size limit.
  while r > 0 loop
    select sl.team_id into v_team from hm_slots sl
    where sl.is_new and sl.seats < sl.room
    order by sl.seats, sl.ord
    limit 1;
    exit when not found;
    update hm_slots set seats = seats + 1 where team_id = v_team;
    r := r - 1;
  end loop;

  -- 3. Two or more still left make a team of their own. One left is flagged
  --    (the placing loop below finds no seat for them).
  if r >= 2 then
    insert into hm_slots values (private.create_matched_team(p_hackathon_id, k + 1), true, r, 0, v_max, k + 1);
    r := 0;
  end if;

  -- Who's already in the open teams, so their cohorts count too.
  drop table if exists pg_temp.hm_members;
  create temp table hm_members on commit drop as
  select
    m.team_id,
    (select cm.cohort_id from public.cohort_members cm
      where cm.user_id = m.user_id and cm.cohort_id is not null
      order by cm.joined_at nulls last, cm.cohort_id limit 1) as cohort,
    private.skill_bucket(pr.skills) as bucket
  from public.hackathon_team_members m
  join public.profiles pr on pr.id = m.user_id
  where m.team_id in (select team_id from hm_slots);

  -- Place people: biggest cohort first, each where their cohort (then their
  -- kind of skill, then the headcount) is thinnest.
  for p in
    select q.* from hm_pool q
    order by (select count(*) from hm_pool x where x.cohort = q.cohort) desc, q.bucket nulls last, q.ord
  loop
    select sl.team_id into v_team from hm_slots sl
    where sl.seats > 0
    order by
      (select count(*) from hm_members m where m.team_id = sl.team_id and p.cohort is not null and m.cohort = p.cohort),
      (select count(*) from hm_members m where m.team_id = sl.team_id and p.bucket is not null and m.bucket = p.bucket),
      (select count(*) from hm_members m where m.team_id = sl.team_id),
      sl.ord
    limit 1;
    if not found then
      v_flagged := v_flagged || jsonb_build_object(
        'user_id', p.user_id,
        'name', (select full_name from public.profiles where id = p.user_id));
      continue;
    end if;
    v_seq := v_seq + 1;
    update hm_slots set seats = seats - 1 where team_id = v_team;
    insert into hm_members values (v_team, p.cohort, p.bucket);
    update hm_pool set team_id = v_team, seq = v_seq where user_id = p.user_id;
  end loop;

  -- Seat them. The first person placed in a new team owns it. The size and
  -- one-team rules are checked again by the membership trigger.
  for p in select q.* from hm_pool q where q.team_id is not null order by q.seq loop
    insert into public.hackathon_team_members (team_id, user_id, role)
    values (
      p.team_id, p.user_id,
      case
        when (select sl.is_new from hm_slots sl where sl.team_id = p.team_id)
          and not exists (select 1 from public.hackathon_team_members m where m.team_id = p.team_id)
        then 'owner' else 'member'
      end
    );
  end loop;

  v_report := jsonb_build_object(
    'matched_at', now(),
    'pool', n,
    'team_size', s,
    'new_teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', t.id, 'name', t.name,
        'members', (select coalesce(jsonb_agg(pr.full_name order by q.seq), '[]'::jsonb)
                    from hm_pool q join public.profiles pr on pr.id = q.user_id where q.team_id = t.id))
        order by sl.ord)
      from hm_slots sl join public.hackathon_teams t on t.id = sl.team_id
      where sl.is_new), '[]'::jsonb),
    'joined_open_teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', t.id, 'name', t.name,
        'members', (select jsonb_agg(pr.full_name order by q.seq)
                    from hm_pool q join public.profiles pr on pr.id = q.user_id where q.team_id = t.id))
        order by sl.ord)
      from hm_slots sl join public.hackathon_teams t on t.id = sl.team_id
      where not sl.is_new and exists (select 1 from hm_pool q where q.team_id = sl.team_id)), '[]'::jsonb),
    'flagged', v_flagged,
    -- Pairs of teammates from the same cohort among the teams touched: 0 is a
    -- perfect mix.
    'same_cohort_pairs', (
      select count(*) from (
        select a.team_id from hm_members a
        join hm_members b on a.team_id = b.team_id and a.cohort = b.cohort and a.ctid < b.ctid
      ) x)
  );

  update public.hackathons set matched_at = now(), match_report = v_report where id = p_hackathon_id;
  return v_report;
end $$;

grant execute on all functions in schema private to anon, authenticated, service_role;

revoke execute on function public.hackathon_run_matcher(uuid) from public, anon, authenticated;
grant execute on function public.hackathon_run_matcher(uuid) to service_role;
