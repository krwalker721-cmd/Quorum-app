-- ---------------------------------------------------------------------------
-- Hackathon (Sprint) database tests — migrations 018, 019, 020.
--
-- Proves the rules hold in the database itself, as each kind of caller:
-- signed out (anon), members, participants, team owners, judges, admins.
--
-- HOW TO RUN
--   Locally:   scripts/db.sh local         (fresh database, then these tests)
--   Staging:   scripts/db.sh staging:test  (or paste this whole file into the
--              staging project's SQL editor and run it)
--   NEVER against production.
--   Needs migrations 018-021.
--
-- It creates its own users and Sprints, and ENDS BY RAISING AN ERROR ON
-- PURPOSE, so every change it made is rolled back, in the SQL editor too.
-- Success looks like an error reading:
--     ALL <n> TESTS PASSED (every change was rolled back)
-- Anything else lists the failing tests.
--
-- Faking time: now() is fixed for the whole run (it's one transaction), so
-- instead of moving the clock, tests.set_phase() moves the Sprint's own
-- timestamps around now(). hackathon_state_at() is tested directly against
-- fixed dates.
-- ---------------------------------------------------------------------------

begin;

-- ============================================================================
-- Harness
-- ============================================================================
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create table tests.results (
  n      serial primary key,
  name   text not null,
  ok     boolean not null,
  detail text
);
grant select, insert on tests.results to anon, authenticated, service_role;
grant usage on sequence tests.results_n_seq to anon, authenticated, service_role;

-- The cast of characters.
create function tests.u(p text) returns uuid language sql immutable as $$
  select (case p
    when 'admin' then 'a0000000-0000-0000-0000-000000000001'  -- is_admin, paid
    when 'alice' then 'a0000000-0000-0000-0000-000000000002'  -- trial; owns Rockets
    when 'bob'   then 'a0000000-0000-0000-0000-000000000003'  -- paid; on Rockets
    when 'carol' then 'a0000000-0000-0000-0000-000000000004'  -- trial; on Comets
    when 'dave'  then 'a0000000-0000-0000-0000-000000000005'  -- trial, lapses mid-Sprint; on Rockets
    when 'erin'  then 'a0000000-0000-0000-0000-000000000006'  -- lapsed member, never registered
    when 'jude'  then 'a0000000-0000-0000-0000-000000000007'  -- judge, doesn't pay
    when 'oscar' then 'a0000000-0000-0000-0000-000000000008'  -- active member, not in the Sprint
    when 'fay'   then 'a0000000-0000-0000-0000-000000000009'  -- trial; ends up in the random pool
    when 'gus'   then 'a0000000-0000-0000-0000-00000000000a'  -- trial; joins Comets, then withdraws
    when 'pete'  then 'a0000000-0000-0000-0000-00000000000b'  -- signed up, not yet approved
  end)::uuid
$$;

create function tests.h0() returns uuid language sql immutable as $$
  select 'c0000000-0000-0000-0000-000000000000'::uuid  -- fixed dates in 2031: state machine
$$;
create function tests.h1() returns uuid language sql immutable as $$
  select 'c1000000-0000-0000-0000-000000000001'::uuid  -- the Sprint everyone plays in
$$;

-- Act as someone. 'none' resets to the database owner first, so any role can
-- switch to any other.
create function tests.become(p_role text, p_user text) returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  if p_role = 'db' then
    perform set_config('request.jwt.claims', '', true);
    return;
  end if;
  perform set_config('role', p_role, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', coalesce(tests.u(p_user)::text, ''), 'role', p_role)::text, true);
end $$;
create function tests.login(p_user text) returns void language sql as $$ select tests.become('authenticated', p_user) $$;
create function tests.anon() returns void language sql as $$ select tests.become('anon', null) $$;
create function tests.as_db() returns void language sql as $$ select tests.become('db', null) $$;
-- The admin console's server routes use the service role.
create function tests.service() returns void language sql as $$ select tests.become('service_role', null) $$;

create function tests.ok(p_name text, p_cond boolean, p_detail text default null) returns void
language plpgsql as $$
begin
  insert into tests.results (name, ok, detail)
  values (p_name, coalesce(p_cond, false),
          case when coalesce(p_cond, false) then null
               else coalesce(p_detail, 'condition was ' || coalesce(p_cond::text, 'null')) end);
end $$;

create function tests.eq(p_name text, p_got text, p_want text) returns void language plpgsql as $$
begin
  perform tests.ok(p_name, p_got is not distinct from p_want,
    'got ' || coalesce(p_got, 'NULL') || ', wanted ' || coalesce(p_want, 'NULL'));
end $$;

create function tests.lives(p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    perform tests.ok(p_name, false, 'raised: ' || sqlerrm);
    return;
  end;
  perform tests.ok(p_name, true);
end $$;

create function tests.throws(p_name text, p_sql text, p_expect text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    perform tests.ok(p_name, sqlerrm ilike '%' || p_expect || '%',
      'raised "' || sqlerrm || '", wanted one mentioning "' || p_expect || '"');
    return;
  end;
  perform tests.ok(p_name, false, 'no error was raised');
end $$;

create function tests.count(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) q', p_sql) into n;
  return n;
end $$;

-- Rows an UPDATE or DELETE actually touched (RLS silently skips the rest).
create function tests.affected(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

-- Fixture helpers run as the database owner whoever is acting.
create function tests.set_phase(p_hackathon uuid, p_phase text) returns void
language plpgsql security definer set search_path = public as $$
declare
  t timestamptz := now();
  d interval := interval '1 day';
  h interval := interval '1 hour';
  r timestamptz[];
begin
  r := case p_phase
    when 'upcoming'       then array[t + d,     t + 2*d,   t + 3*d, t + 5*d,  t + 6*d, t + 7*d]
    when 'registration'   then array[t - d,     t + d,     t + 2*d, t + 4*d,  t + 5*d, t + 6*d]
    when 'teams_locked'   then array[t - 2*d,   t - h,     t + d,   t + 3*d,  t + 4*d, t + 5*d]
    when 'live'           then array[t - 3*d,   t - 2*d,   t - h,   t + 47*h, t + 3*d, t + 4*d]
    when 'judging'        then array[t - 4*d,   t - 3*d,   t - 2*d, t - h,    t + d,   t + 2*d]
    when 'judging_closed' then array[t - 6*d,   t - 5*d,   t - 4*d, t - 2*d,  t - h,   t + d]
    when 'revealed'       then array[t - 8*d,   t - 7*d,   t - 6*d, t - 4*d,  t - 3*d, t - h]
  end;
  if r is null then
    raise exception 'unknown phase %', p_phase;
  end if;
  update public.hackathons set
    registration_opens_at = r[1], team_lock_at = r[2], starts_at = r[3],
    ends_at = r[4], judging_ends_at = r[5], reveal_at = r[6]
  where id = p_hackathon;
end $$;

create function tests.pause(p_hackathon uuid, p_at timestamptz, p_kind text default 'paused') returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.hackathons set status_override = null where id = p_hackathon and status_override is not null;
  update public.hackathons set status_override = p_kind, status_override_at = p_at where id = p_hackathon;
end $$;

create function tests.clear_override(p_hackathon uuid) returns void
language sql security definer set search_path = public as $$
  update public.hackathons set status_override = null where id = p_hackathon
$$;

create function tests.set_member(p_user text, p_active boolean) returns void
language sql security definer set search_path = public as $$
  update public.profiles
  set trial_ends_at = case when p_active then now() + interval '20 days' else now() - interval '1 day' end
  where id = tests.u(p_user)
$$;

create function tests.team(p_name text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.hackathon_teams where name = p_name and hackathon_id = tests.h1()
$$;

create function tests.submission(p_team text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.hackathon_submissions where team_id = tests.team(p_team)
$$;

create function tests.request(p_team text, p_user text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.hackathon_team_join_requests
  where team_id = tests.team(p_team) and user_id = tests.u(p_user)
$$;

create function tests.path(p_team text, p_file text) returns text
language sql stable security definer set search_path = public as $$
  select tests.h1()::text || '/' || tests.team(p_team)::text || '/' || p_file
$$;

create function tests.vote(p_title text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.hackathon_team_votes where title = p_title
$$;

create function tests.audit_count(p_table text) returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) from public.hackathon_admin_audit where hackathon_id = tests.h1() and table_name = p_table
$$;

create function tests.last_audit() returns public.hackathon_admin_audit
language sql stable security definer set search_path = public as $$
  select * from public.hackathon_admin_audit order by id desc limit 1
$$;

create function tests.lobby_has(p_pattern text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hackathon_lobby_messages
    where hackathon_id = tests.h1() and is_system and body ilike '%' || p_pattern || '%'
  )
$$;

create function tests.finish() returns void language plpgsql as $$
declare
  total integer;
  failed integer;
  list text;
begin
  perform tests.as_db();
  select count(*), count(*) filter (where not ok),
         string_agg(format('#%s %s (%s)', n, name, detail), E';\n' order by n) filter (where not ok)
  into total, failed, list
  from tests.results;
  if failed = 0 then
    raise exception 'ALL % TESTS PASSED (every change was rolled back)', total;
  end if;
  raise exception E'% OF % TESTS FAILED (every change was rolled back):\n%', failed, total, list;
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ============================================================================
-- Fixtures
-- ============================================================================
select tests.as_db();

insert into auth.users (id, email, raw_user_meta_data) values
  (tests.u('admin'), 'admin@hackathon.test', '{"full_name": "Ada Admin"}'),
  (tests.u('alice'), 'alice@hackathon.test', '{"full_name": "Alice Arden"}'),
  (tests.u('bob'),   'bob@hackathon.test',   '{"full_name": "Bob Baker"}'),
  (tests.u('carol'), 'carol@hackathon.test', '{"full_name": "Carol Chen"}'),
  (tests.u('dave'),  'dave@hackathon.test',  '{"full_name": "Dave Diaz"}'),
  (tests.u('erin'),  'erin@hackathon.test',  '{"full_name": "Erin Etty"}'),
  (tests.u('jude'),  'jude@hackathon.test',  '{"full_name": "Jude Judge"}'),
  (tests.u('oscar'), 'oscar@hackathon.test', '{"full_name": "Oscar Out"}'),
  (tests.u('fay'),   'fay@hackathon.test',   '{"full_name": "Fay Fox"}'),
  (tests.u('gus'),   'gus@hackathon.test',   '{"full_name": "Gus Gray"}'),
  (tests.u('pete'),  'pete@hackathon.test',  '{"full_name": "Pete Pending"}');

-- handle_new_user() made the profiles. Approve everyone but Pete and open a
-- trial; Bob and the admin pay; Erin's and Jude's trials are over.
update public.profiles
set status = 'approved', trial_ends_at = now() + interval '20 days'
where id in (tests.u('admin'), tests.u('alice'), tests.u('bob'), tests.u('carol'), tests.u('dave'),
             tests.u('erin'), tests.u('jude'), tests.u('oscar'), tests.u('fay'), tests.u('gus'));
update public.profiles set trial_ends_at = now() + interval '20 days' where id = tests.u('pete');
update public.profiles set is_admin = true where id = tests.u('admin');
update public.profiles set trial_ends_at = null where id = tests.u('bob');
update public.profiles set trial_ends_at = now() - interval '1 day' where id in (tests.u('erin'), tests.u('jude'));
insert into public.subscriptions (user_id, status, tier) values
  (tests.u('bob'), 'active', 'member'),
  (tests.u('admin'), 'active', 'member');

select tests.ok('fixture: entitlement mirrors the app',
  private.is_active_member(tests.u('alice')) and private.is_active_member(tests.u('bob'))
  and not private.is_active_member(tests.u('erin')) and not private.is_active_member(tests.u('pete'))
  and not private.is_active_member(tests.u('jude')));

-- ============================================================================
-- State machine, against fixed dates
-- ============================================================================
insert into public.hackathons (id, slug, title, theme_hidden,
  registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at)
values (tests.h0(), 'state-machine-test', 'State machine', 'hidden',
  '2031-01-01 00:00Z', '2031-01-02 00:00Z', '2031-01-03 00:00Z',
  '2031-01-05 00:00Z', '2031-01-06 00:00Z', '2031-01-07 00:00Z');

select tests.eq('state: unpublished is draft', hackathon_state_at(tests.h0(), '2031-01-04Z'), 'draft');

select tests.anon();
select tests.eq('drafts: invisible signed out', tests.count($$ select 1 from hackathon_overview where id = tests.h0() $$)::text, '0');
select tests.eq('drafts: state is NULL signed out', hackathon_state(tests.h0()), null);
select tests.login('alice');
select tests.eq('drafts: invisible to members', tests.count($$ select 1 from hackathon_overview where id = tests.h0() $$)::text, '0');
select tests.login('admin');
select tests.eq('drafts: visible to admins', tests.count($$ select 1 from hackathon_overview where id = tests.h0() $$)::text, '1');
select tests.as_db();

update public.hackathons set is_published = true where id = tests.h0();
select tests.eq('state: before registration opens', hackathon_state_at(tests.h0(), '2030-12-31 23:59:59Z'), 'upcoming');
select tests.eq('state: registration opens exactly', hackathon_state_at(tests.h0(), '2031-01-01 00:00Z'), 'registration');
select tests.eq('state: team lock exactly', hackathon_state_at(tests.h0(), '2031-01-02 00:00Z'), 'teams_locked');
select tests.eq('state: kickoff exactly', hackathon_state_at(tests.h0(), '2031-01-03 00:00Z'), 'live');
select tests.eq('state: a microsecond before the deadline', hackathon_state_at(tests.h0(), '2031-01-04 23:59:59.999999Z'), 'live');
select tests.eq('state: the deadline exactly', hackathon_state_at(tests.h0(), '2031-01-05 00:00Z'), 'judging');
select tests.eq('state: judging closed, not yet revealed', hackathon_state_at(tests.h0(), '2031-01-06 12:00Z'), 'judging');
select tests.eq('state: reveal exactly', hackathon_state_at(tests.h0(), '2031-01-07 00:00Z'), 'revealed');
select tests.eq('state: now (2031 is ahead)', hackathon_state(tests.h0()), 'upcoming');
update public.hackathons set status_override = 'paused' where id = tests.h0();
select tests.eq('state: paused overrides the clock', hackathon_state_at(tests.h0(), '2031-01-04Z'), 'paused');
update public.hackathons set status_override = 'cancelled' where id = tests.h0();
select tests.eq('state: cancelled overrides the clock', hackathon_state_at(tests.h0(), '2031-01-04Z'), 'cancelled');
update public.hackathons set status_override = null where id = tests.h0();
select tests.eq('state: clearing the override restores the clock', hackathon_state_at(tests.h0(), '2031-01-04Z'), 'live');

select tests.throws('timeline: kickoff must come before the deadline', $$
  insert into public.hackathons (slug, title, registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at)
  values ('bad-1', 'Bad', now(), now(), now() + interval '1 day', now() + interval '1 day', now() + interval '2 days', now() + interval '3 days') $$,
  'hackathons_timeline_order');
select tests.throws('timeline: team lock can''t be after kickoff', $$
  insert into public.hackathons (slug, title, registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at)
  values ('bad-2', 'Bad', now(), now() + interval '2 days', now() + interval '1 day', now() + interval '3 days', now() + interval '4 days', now() + interval '5 days') $$,
  'hackathons_timeline_order');
select tests.throws('timeline: min team size can''t exceed max', $$
  insert into public.hackathons (slug, title, registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at, min_team_size, max_team_size)
  values ('bad-3', 'Bad', now(), now(), now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', now() + interval '4 days', 5, 4) $$,
  'hackathons_team_size_order');

-- The Sprint everyone plays in. Max team size 3.
insert into public.hackathons (id, slug, title, tagline, theme_hidden, rules, max_team_size, is_published,
  registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at)
values (tests.h1(), 'test-sprint', 'Test Sprint', 'Build something', 'Build for night owls', 'Be kind.', 3, true,
  now(), now(), now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', now() + interval '4 days');
select tests.set_phase(tests.h1(), 'registration');

select tests.ok('numbering: each Sprint takes the next number',
  (select number from public.hackathons where id = tests.h1()) = (select number from public.hackathons where id = tests.h0()) + 1);

-- ============================================================================
-- The theme is sealed until kickoff
-- ============================================================================
select tests.anon();
select tests.throws('theme: signed out can''t select the column', $$ select theme_hidden from public.hackathons $$, 'permission denied');
select tests.eq('theme: signed out sees the published Sprint', tests.count($$ select 1 from hackathon_overview where id = tests.h1() $$)::text, '1');
select tests.eq('theme: NULL signed out before kickoff', (select theme from hackathon_overview where id = tests.h1()), null);
select tests.login('alice');
select tests.throws('theme: a member can''t select the column', $$ select theme_hidden from public.hackathons $$, 'permission denied');
select tests.throws('theme: select * is refused too', $$ select * from public.hackathons $$, 'permission denied');
select tests.eq('theme: the other columns are readable', tests.count($$ select title, starts_at from public.hackathons where id = tests.h1() $$)::text, '1');
select tests.eq('theme: NULL for a member before kickoff', (select theme from hackathon_overview where id = tests.h1()), null);
select tests.eq('theme: state reads registration', (select state from hackathon_overview where id = tests.h1()), 'registration');
select tests.login('admin');
select tests.eq('theme: admins always see it', (select theme from hackathon_overview where id = tests.h1()), 'Build for night owls');

-- ============================================================================
-- Registration
-- ============================================================================
select tests.login('alice');
select tests.lives('register: an active trial member', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h1(), tests.u('alice')) $$);
select tests.throws('register: not for someone else', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h1(), tests.u('oscar')) $$, 'row-level security');
select tests.login('bob');
select tests.lives('register: a paying member', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h1(), tests.u('bob')) $$);
select tests.login('carol');
select tests.lives('register: carol', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h1(), tests.u('carol')) $$);
select tests.login('dave');
select tests.lives('register: dave', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h1(), tests.u('dave')) $$);
select tests.login('fay');
select tests.lives('register: fay', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h1(), tests.u('fay')) $$);
select tests.login('gus');
select tests.lives('register: gus', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h1(), tests.u('gus')) $$);
select tests.login('erin');
select tests.throws('register: a lapsed member is refused', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h1(), tests.u('erin')) $$, 'active members');
select tests.login('pete');
select tests.throws('register: an unapproved account is refused', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h1(), tests.u('pete')) $$, 'active members');

select tests.as_db();
select tests.lives('judges: the admin console invites Jude', $$ insert into hackathon_judges (hackathon_id, user_id) values (tests.h1(), tests.u('jude')) $$);
select tests.throws('judges: a registered participant can''t be made a judge', $$ insert into hackathon_judges (hackathon_id, user_id) values (tests.h1(), tests.u('alice')) $$, 'Remove their registration');
select tests.set_member('jude', true);
select tests.login('jude');
select tests.throws('judges: a judge can''t register', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h1(), tests.u('jude')) $$, 'judge');
select tests.set_member('jude', false);

select tests.login('alice');
select tests.lives('register: members can''t set their own team or check-in', $$
  update hackathon_registrations set checked_in_at = now(), team_id = gen_random_uuid()
  where hackathon_id = tests.h1() and user_id = tests.u('alice') $$);
select tests.ok('register: ...both stayed empty',
  (select checked_in_at is null and team_id is null from hackathon_registrations where hackathon_id = tests.h1() and user_id = tests.u('alice')));
select tests.eq('register: participants see who else is in', tests.count($$ select 1 from hackathon_registrations where hackathon_id = tests.h1() $$)::text, '6');
select tests.login('oscar');
select tests.eq('register: non-participants don''t', tests.count($$ select 1 from hackathon_registrations where hackathon_id = tests.h1() $$)::text, '0');

select tests.set_phase(tests.h1(), 'upcoming');
select tests.throws('register: not before registration opens', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h1(), tests.u('oscar')) $$, 'isn''t open');
select tests.set_phase(tests.h1(), 'registration');

-- ============================================================================
-- Teams
-- ============================================================================
select tests.login('alice');
select tests.lives('teams: a participant creates one', $$ select hackathon_create_team(tests.h1(), 'Rockets', 'R', '#f59e0b') $$);
select tests.eq('teams: slug comes from the name', (select slug from hackathon_teams where id = tests.team('Rockets')), 'rockets');
select tests.ok('teams: creator is owner, registration points at the team',
  (select r.team_id = tests.team('Rockets') and r.mode = 'team' from hackathon_registrations r where r.hackathon_id = tests.h1() and r.user_id = tests.u('alice'))
  and (select role = 'owner' from hackathon_team_members where team_id = tests.team('Rockets') and user_id = tests.u('alice')));
select tests.throws('teams: one team per Sprint', $$ select hackathon_create_team(tests.h1(), 'Second') $$, 'already on a team');
select tests.throws('teams: can''t switch to the random pool while on a team', $$
  update hackathon_registrations set mode = 'random' where hackathon_id = tests.h1() and user_id = tests.u('alice') $$, 'Leave your team');
select tests.login('carol');
select tests.lives('teams: carol creates Comets', $$ select hackathon_create_team(tests.h1(), 'Comets') $$);
select tests.login('fay');
select tests.throws('teams: names are unique in a Sprint, ignoring case', $$ select hackathon_create_team(tests.h1(), 'rockets ') $$, 'already exists');
select tests.login('oscar');
select tests.throws('teams: only participants can create one', $$ select hackathon_create_team(tests.h1(), 'Outsiders') $$, 'Register');

select tests.login('bob');
select tests.throws('teams: nobody can add themselves to a team directly', $$
  insert into hackathon_team_members (team_id, user_id) values (tests.team('Rockets'), tests.u('bob')) $$, 'row-level security');
select tests.lives('teams: bob asks to join Rockets', $$ select hackathon_request_to_join(tests.team('Rockets'), 'I do backend') $$);
select tests.throws('teams: one request per team', $$ select hackathon_request_to_join(tests.team('Rockets')) $$, 'already asked');
select tests.login('carol');
select tests.throws('teams: only the owner answers requests', $$ select hackathon_respond_to_join_request(tests.request('Rockets', 'bob'), true) $$, 'Only the team owner');
select tests.eq('teams: other teams can''t see the request', tests.count($$ select 1 from hackathon_team_join_requests where team_id = tests.team('Rockets') $$)::text, '0');
select tests.login('alice');
select tests.lives('teams: the owner accepts bob', $$ select hackathon_respond_to_join_request(tests.request('Rockets', 'bob'), true) $$);
select tests.login('dave');
select tests.lives('teams: dave asks', $$ select hackathon_request_to_join(tests.team('Rockets')) $$);
select tests.login('fay');
select tests.lives('teams: fay asks', $$ select hackathon_request_to_join(tests.team('Rockets')) $$);
select tests.login('alice');
select tests.lives('teams: dave takes the third and last seat', $$ select hackathon_respond_to_join_request(tests.request('Rockets', 'dave'), true) $$);
select tests.throws('teams: a full team refuses the next', $$ select hackathon_respond_to_join_request(tests.request('Rockets', 'fay'), true) $$, 'full');
select tests.eq('teams: Rockets has 3', tests.count($$ select 1 from hackathon_team_members where team_id = tests.team('Rockets') $$)::text, '3');

select tests.login('gus');
select tests.lives('teams: gus asks to join Comets', $$ select hackathon_request_to_join(tests.team('Comets')) $$);
select tests.login('carol');
select tests.lives('teams: carol accepts gus', $$ select hackathon_respond_to_join_request(tests.request('Comets', 'gus'), true) $$);
select tests.login('gus');
select tests.throws('teams: can''t ask another team once on one', $$ select hackathon_request_to_join(tests.team('Rockets')) $$, 'already on a team');

select tests.login('fay');
select tests.lives('teams: fay starts Meteors', $$ select hackathon_create_team(tests.h1(), 'Meteors') $$);
select tests.eq('teams: joining a team closes your other requests', (select status from hackathon_team_join_requests where id = tests.request('Rockets', 'fay')), 'cancelled');
select tests.as_db();
select tests.throws('teams: one team per Sprint binds the admin console too', $$
  insert into hackathon_team_members (team_id, user_id) values (tests.team('Meteors'), tests.u('gus')) $$, 'duplicate key');
select tests.login('fay');
select tests.lives('teams: the last member leaving before kickoff', $$ select hackathon_leave_team(tests.team('Meteors')) $$);
select tests.ok('teams: ...dissolves the team', tests.team('Meteors') is null);
select tests.lives('teams: fay goes to the random pool', $$
  update hackathon_registrations set mode = 'random' where hackathon_id = tests.h1() and user_id = tests.u('fay') $$);

select tests.login('carol');
select tests.lives('teams: the owner leaving', $$ select hackathon_leave_team(tests.team('Comets')) $$);
select tests.ok('teams: ...hands the team to the longest-standing member',
  (select role = 'owner' from hackathon_team_members where team_id = tests.team('Comets') and user_id = tests.u('gus')));
select tests.lives('teams: carol asks back in', $$ select hackathon_request_to_join(tests.team('Comets')) $$);
select tests.login('gus');
select tests.lives('teams: the new owner accepts', $$ select hackathon_respond_to_join_request(tests.request('Comets', 'carol'), true) $$);

select tests.login('oscar');
select tests.eq('arena: an active member sees the teams', tests.count($$ select 1 from hackathon_teams where hackathon_id = tests.h1() $$)::text, '2');
select tests.eq('arena: ...and the rosters', tests.count($$ select 1 from hackathon_team_members where hackathon_id = tests.h1() $$)::text, '5');
select tests.login('erin');
select tests.eq('arena: a lapsed non-participant doesn''t', tests.count($$ select 1 from hackathon_teams where hackathon_id = tests.h1() $$)::text, '0');
select tests.anon();
select tests.eq('arena: nor does anyone signed out', tests.count($$ select 1 from hackathon_teams where hackathon_id = tests.h1() $$)::text, '0');

-- ============================================================================
-- Team lock
-- ============================================================================
select tests.set_phase(tests.h1(), 'teams_locked');
select tests.login('fay');
select tests.throws('lock: no new teams', $$ select hackathon_create_team(tests.h1(), 'Late') $$, 'registration is open');
select tests.throws('lock: no switching mode', $$
  update hackathon_registrations set mode = 'team' where hackathon_id = tests.h1() and user_id = tests.u('fay') $$, 'registration is open');
select tests.login('alice');
select tests.throws('lock: the owner can''t remove members', $$ select hackathon_remove_member(tests.team('Rockets'), tests.u('bob')) $$, 'registration is open');
select tests.login('oscar');
select tests.throws('lock: registration is closed', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h1(), tests.u('oscar')) $$, 'isn''t open');
select tests.login('gus');
select tests.lives('lock: withdrawing is still allowed before kickoff', $$
  update hackathon_registrations set withdrawn_at = now() where hackathon_id = tests.h1() and user_id = tests.u('gus') $$);
select tests.ok('lock: ...withdrawing takes gus off Comets and carol is owner again',
  tests.count($$ select 1 from hackathon_team_members where team_id = tests.team('Comets') and user_id = tests.u('gus') $$) = 0
  and (select role = 'owner' from hackathon_team_members where team_id = tests.team('Comets') and user_id = tests.u('carol')));

-- ============================================================================
-- Live: sealed rooms
-- ============================================================================
select tests.set_phase(tests.h1(), 'live');
select tests.login('alice');
select tests.eq('theme: visible to members from kickoff', (select theme from hackathon_overview where id = tests.h1()), 'Build for night owls');
select tests.anon();
select tests.eq('theme: and signed out', (select theme from hackathon_overview where id = tests.h1()), 'Build for night owls');
select tests.login('gus');
select tests.throws('live: a withdrawn participant can''t come back', $$
  update hackathon_registrations set withdrawn_at = null where hackathon_id = tests.h1() and user_id = tests.u('gus') $$, 'isn''t open');

select tests.login('alice');
select tests.lives('room: a member posts in the thread', $$ insert into hackathon_team_messages (team_id, user_id, body) values (tests.team('Rockets'), tests.u('alice'), 'hello team') $$);
select tests.lives('room: a member can''t forge a system message', $$ insert into hackathon_team_messages (team_id, user_id, body, is_system) values (tests.team('Rockets'), tests.u('alice'), 'sneaky', true) $$);
select tests.eq('room: ...it was stored as an ordinary message', tests.count($$ select 1 from hackathon_team_messages where body = 'sneaky' and is_system $$)::text, '0');
select tests.login('carol');
select tests.throws('room: a non-member can''t post', $$ insert into hackathon_team_messages (team_id, user_id, body) values (tests.team('Rockets'), tests.u('carol'), 'let me in') $$, 'row-level security');
select tests.eq('SEALED: another team can''t read the thread', tests.count($$ select 1 from hackathon_team_messages where team_id = tests.team('Rockets') $$)::text, '0');
select tests.login('oscar');
select tests.eq('SEALED: a member outside the Sprint can''t read the thread', tests.count($$ select 1 from hackathon_team_messages where team_id = tests.team('Rockets') $$)::text, '0');
select tests.anon();
select tests.eq('SEALED: signed out can''t read the thread', tests.count($$ select 1 from hackathon_team_messages where team_id = tests.team('Rockets') $$)::text, '0');
select tests.login('admin');
select tests.ok('room: admins can read it', tests.count($$ select 1 from hackathon_team_messages where team_id = tests.team('Rockets') $$) >= 2);

select tests.login('bob');
select tests.lives('room: bob adds a doc', $$ insert into hackathon_team_docs (team_id, title, content, created_by) values (tests.team('Rockets'), 'Plan', 'the secret plan', tests.u('bob')) $$);
select tests.lives('room: bob adds a link', $$ insert into hackathon_team_links (team_id, url, label, created_by) values (tests.team('Rockets'), 'https://example.com/figma', 'Figma', tests.u('bob')) $$);
select tests.login('alice');
select tests.lives('room: alice edits bob''s doc', $$ update hackathon_team_docs set content = 'the better plan' where team_id = tests.team('Rockets') $$);
select tests.ok('room: a doc records who last edited it',
  (select updated_by = tests.u('alice') and created_by = tests.u('bob') from hackathon_team_docs where team_id = tests.team('Rockets')));
select tests.ok('room: adding a doc posts a system line', tests.count($$ select 1 from hackathon_team_messages where team_id = tests.team('Rockets') and is_system and body like '%added a doc: Plan' $$) = 1);
select tests.login('carol');
select tests.eq('SEALED: another team can''t read the docs', tests.count($$ select 1 from hackathon_team_docs where team_id = tests.team('Rockets') $$)::text, '0');
select tests.eq('SEALED: another team can''t read the links', tests.count($$ select 1 from hackathon_team_links where team_id = tests.team('Rockets') $$)::text, '0');
select tests.throws('room: another team can''t add a link', $$ insert into hackathon_team_links (team_id, url, created_by) values (tests.team('Rockets'), 'https://evil.example', tests.u('carol')) $$, 'row-level security');
select tests.eq('room: another team can''t change the docs', tests.affected($$ update hackathon_team_docs set content = 'x' where team_id = tests.team('Rockets') $$)::text, '0');

select tests.login('alice');
select tests.lives('votes: alice opens one', $$ insert into hackathon_team_votes (team_id, title, options, created_by) values (tests.team('Rockets'), 'Framework', '[" Next.js ", "Remix"]', tests.u('alice')) $$);
select tests.lives('votes: alice votes', $$ insert into hackathon_team_ballots (vote_id, team_id, user_id, option_chosen) select id, team_id, tests.u('alice'), 'Next.js' from hackathon_team_votes where title = 'Framework' $$);
select tests.login('carol');
select tests.eq('SEALED: another team can''t read votes', tests.count($$ select 1 from hackathon_team_votes where team_id = tests.team('Rockets') $$)::text, '0');
select tests.throws('votes: another team can''t vote', $$
  insert into hackathon_team_ballots (vote_id, team_id, user_id, option_chosen)
  values (tests.vote('Framework'), tests.team('Rockets'), tests.u('carol'), 'Remix') $$, 'row-level security');
select tests.login('bob');
select tests.throws('votes: only a listed option', $$ insert into hackathon_team_ballots (vote_id, team_id, user_id, option_chosen) select id, team_id, tests.u('bob'), 'Rails' from hackathon_team_votes where title = 'Framework' $$, 'isn''t one of the options');
select tests.lives('votes: bob votes', $$ insert into hackathon_team_ballots (vote_id, team_id, user_id, option_chosen) select id, team_id, tests.u('bob'), 'Remix' from hackathon_team_votes where title = 'Framework' $$);
select tests.eq('votes: still open until everyone has voted', (select status from hackathon_team_votes where title = 'Framework'), 'open');
select tests.login('dave');
select tests.lives('votes: dave votes last', $$ insert into hackathon_team_ballots (vote_id, team_id, user_id, option_chosen) select id, team_id, tests.u('dave'), 'Next.js' from hackathon_team_votes where title = 'Framework' $$);
select tests.eq('votes: the database closes it with the winner', (select status || ':' || winning_option from hackathon_team_votes where title = 'Framework'), 'decided:Next.js');
select tests.login('alice');
select tests.throws('votes: a closed vote takes no changes', $$ update hackathon_team_ballots set option_chosen = 'Remix' where user_id = tests.u('alice') $$, 'closed');

select tests.lives('messages: the author edits', $$ update hackathon_team_messages set body = 'hello team!' where body = 'hello team' $$);
select tests.ok('messages: ...and it is marked edited', (select edited_at is not null from hackathon_team_messages where body = 'hello team!'));
select tests.login('bob');
select tests.eq('messages: nobody else can edit it', tests.affected($$ update hackathon_team_messages set body = 'hacked' where body = 'hello team!' $$)::text, '0');
select tests.login('alice');
select tests.lives('messages: the author deletes', $$ update hackathon_team_messages set deleted_at = now() where body = 'hello team!' $$);
select tests.eq('messages: ...which blanks the text', tests.count($$ select 1 from hackathon_team_messages where body = 'hello team!' $$)::text, '0');
select tests.throws('messages: a deleted message stays deleted', $$ update hackathon_team_messages set body = 'back', deleted_at = null where deleted_at is not null $$, 'deleted');

-- ============================================================================
-- Live: the lobby
-- ============================================================================
select tests.login('alice');
select tests.lives('lobby: a participant posts', $$ insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h1(), tests.u('alice'), 'hi all') $$);
select tests.lives('lobby: a participant can''t pin', $$ insert into hackathon_lobby_messages (hackathon_id, user_id, body, is_pinned) values (tests.h1(), tests.u('alice'), 'look at me', true) $$);
select tests.eq('lobby: ...it went in unpinned', (select is_pinned::text from hackathon_lobby_messages where body = 'look at me'), 'false');
select tests.login('jude');
select tests.throws('lobby: a judge who hasn''t accepted can''t post', $$ insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h1(), tests.u('jude'), 'hello') $$, 'row-level security');
select tests.lives('judges: accepting the invite', $$ select hackathon_accept_judge_invite(tests.h1()) $$);
select tests.lives('lobby: an accepted judge posts', $$ insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h1(), tests.u('jude'), 'good luck!') $$);
select tests.login('oscar');
select tests.eq('lobby: closed to members outside the Sprint', tests.count($$ select 1 from hackathon_lobby_messages where hackathon_id = tests.h1() $$)::text, '0');
select tests.throws('lobby: ...who can''t post either', $$ insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h1(), tests.u('oscar'), 'hi') $$, 'row-level security');
select tests.login('admin');
select tests.lives('lobby: admins pin', $$ update hackathon_lobby_messages set is_pinned = true where body = 'hi all' $$);
select tests.eq('lobby: ...and it is pinned', (select is_pinned::text from hackathon_lobby_messages where body = 'hi all'), 'true');

-- A trial that lapses mid-Sprint keeps its access.
select tests.set_member('dave', false);
select tests.login('dave');
select tests.lives('lapsed mid-Sprint: still posts in the team room', $$ insert into hackathon_team_messages (team_id, user_id, body) values (tests.team('Rockets'), tests.u('dave'), 'still here') $$);
select tests.lives('lapsed mid-Sprint: still posts in the lobby', $$ insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h1(), tests.u('dave'), 'still here') $$);

-- ============================================================================
-- Live: submissions and screenshots
-- ============================================================================
select tests.login('alice');
select tests.lives('submit: a team member submits during the Sprint', $$
  insert into hackathon_submissions (team_id, hackathon_id, project_name, tagline, screenshots, built_with)
  values (tests.team('Rockets'), tests.h1(), 'NightOwl', 'For the 2am crowd',
          array[tests.path('Rockets', 'shot1.png')], array[' Next.js', 'supabase', 'next.js ']) $$);
select tests.eq('submit: built_with is tidied', (select array_to_string(built_with, ',') from hackathon_submissions where team_id = tests.team('Rockets')), 'next.js,supabase');
select tests.throws('submit: screenshots must be in the team''s folder', $$
  update hackathon_submissions set screenshots = array['somewhere/else.png'] where team_id = tests.team('Rockets') $$, 'team''s folder');
select tests.lives('storage: a team member uploads', $$ insert into storage.objects (bucket_id, name) values ('hackathon-submissions', tests.path('Rockets', 'shot1.png')) $$);
select tests.throws('storage: not outside the folder layout', $$ insert into storage.objects (bucket_id, name) values ('hackathon-submissions', 'loose-file.png') $$, 'row-level security');
select tests.login('bob');
select tests.lives('submit: a teammate edits it', $$ update hackathon_submissions set tagline = 'For night owls' where team_id = tests.team('Rockets') $$);
select tests.service();
select tests.lives('audit: the admin console edits a submission before the deadline', $$ update hackathon_submissions set problem = 'Night owls lack tools' where team_id = tests.team('Rockets') $$);
select tests.eq('audit: ...which isn''t logged', tests.audit_count('hackathon_submissions')::text, '0');
select tests.login('carol');
select tests.lives('submit: Comets submits', $$ insert into hackathon_submissions (team_id, hackathon_id, project_name) values (tests.team('Comets'), tests.h1(), 'Comet Chat') $$);
select tests.throws('submit: not for another team', $$ insert into hackathon_submissions (team_id, hackathon_id, project_name) values (tests.team('Rockets'), tests.h1(), 'Hijack') $$, 'row-level security');
select tests.eq('SEALED: another team can''t read the submission', tests.count($$ select 1 from hackathon_submissions where team_id = tests.team('Rockets') $$)::text, '0');
select tests.eq('SEALED: ...or its screenshots', tests.count($$ select 1 from storage.objects where name = tests.path('Rockets', 'shot1.png') $$)::text, '0');
select tests.throws('storage: another team can''t upload into it', $$ insert into storage.objects (bucket_id, name) values ('hackathon-submissions', tests.path('Rockets', 'evil.png')) $$, 'row-level security');
select tests.login('jude');
select tests.eq('SEALED: judges can''t read submissions before the deadline', tests.count($$ select 1 from hackathon_submissions where hackathon_id = tests.h1() $$)::text, '0');
select tests.eq('SEALED: judges never read team rooms', tests.count($$ select 1 from hackathon_team_messages where team_id = tests.team('Rockets') $$)::text, '0');
select tests.throws('scores: not before the deadline', $$
  insert into hackathon_scores (submission_id, hackathon_id, judge_id, score_problem, score_shipped, score_collaboration, score_potential)
  values (tests.submission('Rockets'), tests.h1(), tests.u('jude'), 4, 4, 4, 4) $$, 'Scoring is closed');
select tests.anon();
select tests.eq('SEALED: signed out can''t read submissions before the reveal', tests.count($$ select 1 from hackathon_submissions where hackathon_id = tests.h1() $$)::text, '0');
select tests.eq('SEALED: ...or screenshots', tests.count($$ select 1 from storage.objects where bucket_id = 'hackathon-submissions' $$)::text, '0');

-- ============================================================================
-- Live: the arena's activity pulse
-- ============================================================================
select tests.login('oscar');
select tests.eq('activity: one row per team', tests.count($$ select 1 from get_team_activity(tests.h1()) $$)::text, '2');
select tests.ok('activity: counts and a submitted flag, no content',
  (select message_count >= 2 and doc_count = 1 and link_count = 1 and has_submitted and last_active_at is not null
   from get_team_activity(tests.h1()) where team_id = tests.team('Rockets')));
select tests.login('erin');
select tests.eq('activity: nothing for a lapsed non-participant', tests.count($$ select 1 from get_team_activity(tests.h1()) $$)::text, '0');
select tests.anon();
select tests.throws('activity: signed out can''t call it', $$ select * from get_team_activity(tests.h1()) $$, 'permission denied');

-- ============================================================================
-- Pause and resume
-- ============================================================================
select tests.pause(tests.h1(), now());
select tests.ok('pause: announced in the lobby', tests.lobby_has('The Sprint is paused'));
select tests.login('alice');
select tests.throws('pause: team rooms freeze', $$ insert into hackathon_team_messages (team_id, user_id, body) values (tests.team('Rockets'), tests.u('alice'), 'frozen?') $$, 'row-level security');
select tests.throws('pause: submissions freeze', $$ update hackathon_submissions set tagline = 'x' where team_id = tests.team('Rockets') $$, 'paused');
select tests.lives('pause: the lobby stays open', $$ insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h1(), tests.u('alice'), 'what happened?') $$);
select tests.login('dave');
select tests.lives('lapsed mid-Sprint: posts in the lobby during a pause', $$ insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h1(), tests.u('dave'), 'still here, paused') $$);
select tests.login('alice');
select tests.eq('pause: state paused, clock stopped mid-Sprint', (select state || '/' || phase from hackathon_overview where id = tests.h1()), 'paused/live');
select tests.ok('pause: paused after kickoff keeps the theme', (select theme is not null from hackathon_overview where id = tests.h1()));
select tests.throws('resume: members can''t resume', $$ select hackathon_resume(tests.h1(), true) $$, 'permission denied');
select tests.as_db();
select tests.lives('resume: the admin console resumes', $$ select hackathon_resume(tests.h1(), false) $$);
select tests.ok('resume: announced in the lobby', tests.lobby_has('The Sprint has resumed.'));

-- Paused 30 minutes ago; resume and give the time back.
create temporary table before_resume as select starts_at, ends_at, reveal_at from public.hackathons where id = tests.h1();
select tests.pause(tests.h1(), now() - interval '30 minutes');
select tests.lives('resume: the admin console resumes with the time back', $$ select hackathon_resume(tests.h1(), true) $$);
select tests.ok('resume: the deadline and everything after moved 30 minutes',
  (select h.ends_at = b.ends_at + interval '30 minutes' and h.reveal_at = b.reveal_at + interval '30 minutes'
   from public.hackathons h, before_resume b where h.id = tests.h1()));
select tests.ok('resume: kickoff, already past when it paused, didn''t move',
  (select h.starts_at = b.starts_at from public.hackathons h, before_resume b where h.id = tests.h1()));
select tests.ok('resume: the lobby says by how much', tests.lobby_has('moved 30 min later'));

-- ============================================================================
-- After the deadline: judging
-- ============================================================================
select tests.set_phase(tests.h1(), 'judging');
select tests.login('alice');
select tests.throws('DEADLINE: a late update is refused', $$ update hackathon_submissions set tagline = 'one more thing' where team_id = tests.team('Rockets') $$, 'deadline has passed');
select tests.throws('storage: no uploads after the deadline', $$ insert into storage.objects (bucket_id, name) values ('hackathon-submissions', tests.path('Rockets', 'late.png')) $$, 'row-level security');
select tests.lives('rooms: still writable until the reveal', $$ insert into hackathon_team_messages (team_id, user_id, body) values (tests.team('Rockets'), tests.u('alice'), 'we did it') $$);
select tests.login('dave');
select tests.lives('lapsed mid-Sprint: still posts in the team room after the deadline', $$ insert into hackathon_team_messages (team_id, user_id, body) values (tests.team('Rockets'), tests.u('dave'), 'judging now') $$);
select tests.lives('lapsed mid-Sprint: still posts in the lobby after the deadline', $$ insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h1(), tests.u('dave'), 'fingers crossed') $$);
select tests.login('carol');
select tests.throws('DEADLINE: another team''s late edit is refused too', $$
  update hackathon_submissions set project_name = 'Comet Chat 2' where team_id = tests.team('Comets') $$, 'deadline has passed');
select tests.eq('SEALED: still only your own team''s submission', tests.count($$ select 1 from hackathon_submissions where hackathon_id = tests.h1() $$)::text, '1');
select tests.login('jude');
select tests.eq('judges: read every submission after the deadline', tests.count($$ select 1 from hackathon_submissions where hackathon_id = tests.h1() $$)::text, '2');
select tests.eq('judges: ...and the screenshots', tests.count($$ select 1 from storage.objects where name = tests.path('Rockets', 'shot1.png') $$)::text, '1');
select tests.eq('judges: ...but still not the rooms', tests.count($$ select 1 from hackathon_team_messages where team_id = tests.team('Rockets') $$)::text, '0');

-- Admin fixes after the deadline are allowed, and logged.
select tests.eq('audit: a member''s refused late edit leaves no entry', tests.audit_count('hackathon_submissions')::text, '0');
select tests.service();
select tests.lives('audit: the admin console fixes a submission after the deadline', $$ update hackathon_submissions set tagline = 'For night owls, fixed' where team_id = tests.team('Rockets') $$);
select tests.ok('audit: ...logged as old → new, with who and when',
  (select a.action = 'update' and a.actor = 'admin console' and a.db_role = 'service_role'
          and a.subject = 'NightOwl (team Rockets)'
          and a.changes = '{"tagline": {"old": "For night owls", "new": "For night owls, fixed"}}'::jsonb
          and a.created_at = now() and a.deadline <= now()
   from tests.last_audit() a),
  (select 'last entry: ' || to_jsonb(a)::text from tests.last_audit() a));
select set_config('request.headers', '{"x-quorum-actor": "admin console · 203.0.113.9"}', true);
select tests.lives('audit: a server route names itself in a header', $$ update hackathon_submissions set video_url = 'https://video.example/nightowl' where team_id = tests.team('Rockets') $$);
select set_config('request.headers', '', true);
select tests.eq('audit: ...and the header is the actor', (select actor from tests.last_audit()), 'admin console · 203.0.113.9');
select tests.as_db();
select set_config('hackathon.actor', 'Keaton (SQL editor)', true);
select tests.lives('audit: a fix from the SQL editor', $$ update public.hackathon_submissions set demo_url = 'https://nightowl.example' where team_id = tests.team('Rockets') $$);
select set_config('hackathon.actor', '', true);
select tests.eq('audit: ...records the name it was given', (select actor || ' / ' || (changes -> 'demo_url' ->> 'new') from tests.last_audit()), 'Keaton (SQL editor) / https://nightowl.example');
select tests.eq('audit: three entries so far', tests.audit_count('hackathon_submissions')::text, '3');
select tests.login('alice');
select tests.eq('audit: members can''t read the log', tests.count($$ select 1 from hackathon_admin_audit $$)::text, '0');
select tests.anon();
select tests.eq('audit: ...nor can anyone signed out', tests.count($$ select 1 from hackathon_admin_audit $$)::text, '0');
select tests.login('admin');
select tests.eq('audit: admins can', tests.count($$ select 1 from hackathon_admin_audit where hackathon_id = tests.h1() $$)::text, '3');
select tests.service();
select tests.throws('audit: the admin console can''t rewrite an entry', $$ update hackathon_admin_audit set actor = 'nobody' $$, 'permission denied');
select tests.throws('audit: ...or delete one', $$ delete from hackathon_admin_audit $$, 'permission denied');
select tests.as_db();
select tests.throws('audit: even the database owner can''t rewrite it', $$ update public.hackathon_admin_audit set actor = 'nobody' $$, 'append-only');
select tests.throws('audit: ...or delete from it', $$ delete from public.hackathon_admin_audit $$, 'append-only');

select tests.as_db();
select tests.lives('judges: invite oscar', $$ insert into public.hackathon_judges (hackathon_id, user_id) values (tests.h1(), tests.u('oscar')) $$);
select tests.lives('judges: the admin judges too', $$ insert into public.hackathon_judges (hackathon_id, user_id, accepted_at) values (tests.h1(), tests.u('admin'), now()) $$);
select tests.login('oscar');
select tests.eq('judges: an invite not yet accepted gives no access', tests.count($$ select 1 from hackathon_submissions where hackathon_id = tests.h1() $$)::text, '0');
select tests.anon();
select tests.eq('SEALED: signed out still sees nothing while judging', tests.count($$ select 1 from hackathon_submissions where hackathon_id = tests.h1() $$)::text, '0');

select tests.login('jude');
select tests.lives('scores: a judge scores in the window', $$
  insert into hackathon_scores (submission_id, hackathon_id, judge_id, score_problem, score_shipped, score_collaboration, score_potential, notes)
  values (tests.submission('Rockets'), tests.h1(), tests.u('jude'), 4, 5, 4, 3, 'solid') $$);
select tests.throws('scores: 1 to 5 only', $$
  insert into hackathon_scores (submission_id, hackathon_id, judge_id, score_problem, score_shipped, score_collaboration, score_potential)
  values (tests.submission('Comets'), tests.h1(), tests.u('jude'), 6, 5, 4, 3) $$, 'check constraint');
select tests.lives('scores: a judge revises their own', $$ update hackathon_scores set notes = 'very solid' where judge_id = tests.u('jude') $$);
select tests.login('admin');
select tests.lives('scores: a second judge scores', $$
  insert into hackathon_scores (submission_id, hackathon_id, judge_id, score_problem, score_shipped, score_collaboration, score_potential)
  values (tests.submission('Rockets'), tests.h1(), tests.u('admin'), 3, 3, 3, 3) $$);
select tests.service();
select tests.lives('audit: the admin console edits a score while judging is open', $$ update hackathon_scores set notes = 'solid (admin)' where judge_id = tests.u('admin') $$);
select tests.eq('audit: ...which isn''t logged', tests.audit_count('hackathon_scores')::text, '0');
select tests.login('admin');
select tests.eq('scores: admins read them all', tests.count($$ select 1 from hackathon_scores where hackathon_id = tests.h1() $$)::text, '2');
select tests.login('jude');
select tests.eq('scores: a judge reads only their own', tests.count($$ select 1 from hackathon_scores where hackathon_id = tests.h1() $$)::text, '1');
select tests.eq('scores: ...and can''t change another''s', tests.affected($$ update hackathon_scores set notes = 'x' where judge_id = tests.u('admin') $$)::text, '0');
select tests.login('alice');
select tests.throws('scores: participants can''t score', $$
  insert into hackathon_scores (submission_id, hackathon_id, judge_id, score_problem, score_shipped, score_collaboration, score_potential)
  values (tests.submission('Rockets'), tests.h1(), tests.u('alice'), 5, 5, 5, 5) $$, 'row-level security');
select tests.eq('scores: ...or read them', tests.count($$ select 1 from hackathon_scores $$)::text, '0');

select tests.as_db();
select tests.lives('awards: the admin console gives one', $$ insert into public.hackathon_awards (hackathon_id, submission_id, award_type) values (tests.h1(), tests.submission('Rockets'), 'judges_pick') $$);
select tests.lives('awards: and a custom one', $$ insert into public.hackathon_awards (hackathon_id, submission_id, award_type, custom_label) values (tests.h1(), tests.submission('Comets'), 'custom', 'Best name') $$);
select tests.anon();
select tests.eq('awards: hidden before the reveal', tests.count($$ select 1 from hackathon_awards where hackathon_id = tests.h1() $$)::text, '0');

select tests.set_phase(tests.h1(), 'judging_closed');
select tests.login('jude');
select tests.throws('scores: closed after judging_ends_at', $$ update hackathon_scores set notes = 'changed my mind' where judge_id = tests.u('jude') $$, 'Scoring is closed');
select tests.service();
select tests.lives('audit: the admin console fixes a score after judging closes', $$ update hackathon_scores set score_potential = 4, notes = 'very solid, fixed' where judge_id = tests.u('jude') $$);
select tests.ok('audit: ...logged with every changed field',
  (select a.table_name = 'hackathon_scores' and a.subject = 'Jude Judge''s score for NightOwl'
          and a.changes = '{"notes": {"old": "very solid", "new": "very solid, fixed"}, "score_potential": {"old": 3, "new": 4}}'::jsonb
   from tests.last_audit() a),
  (select 'last entry: ' || to_jsonb(a)::text from tests.last_audit() a));

-- ============================================================================
-- The reveal
-- ============================================================================
select tests.set_phase(tests.h1(), 'revealed');
select tests.anon();
select tests.eq('REVEAL: signed out reads every submission', tests.count($$ select 1 from hackathon_submissions where hackathon_id = tests.h1() $$)::text, '2');
select tests.eq('REVEAL: ...and the screenshots', tests.count($$ select 1 from storage.objects where name = tests.path('Rockets', 'shot1.png') $$)::text, '1');
select tests.eq('REVEAL: ...and the awards', tests.count($$ select 1 from hackathon_awards where hackathon_id = tests.h1() $$)::text, '2');
select tests.eq('REVEAL: scores stay private', tests.count($$ select 1 from hackathon_scores $$)::text, '0');
select tests.eq('REVEAL: rooms stay sealed signed out', tests.count($$ select 1 from hackathon_team_messages where team_id = tests.team('Rockets') $$)::text, '0');
select tests.login('carol');
select tests.eq('REVEAL: rooms stay sealed to other teams', tests.count($$ select 1 from hackathon_team_docs where team_id = tests.team('Rockets') $$)::text, '0');
select tests.login('alice');
select tests.ok('REVEAL: a team keeps reading its room', tests.count($$ select 1 from hackathon_team_messages where team_id = tests.team('Rockets') $$) > 0);
select tests.throws('REVEAL: rooms become read-only', $$ insert into hackathon_team_messages (team_id, user_id, body) values (tests.team('Rockets'), tests.u('alice'), 'after') $$, 'row-level security');
select tests.lives('REVEAL: an active participant still posts in the lobby', $$ insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h1(), tests.u('alice'), 'congrats all') $$);
select tests.login('dave');
select tests.ok('REVEAL: a lapsed participant still reads the room', tests.count($$ select 1 from hackathon_team_messages where team_id = tests.team('Rockets') $$) > 0);
select tests.ok('REVEAL: ...and the lobby', tests.count($$ select 1 from hackathon_lobby_messages where hackathon_id = tests.h1() $$) > 0);
select tests.throws('REVEAL: ...but can''t post there any more', $$ insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h1(), tests.u('dave'), 'hi') $$, 'row-level security');

-- Paused before reveal_at: stays sealed even once reveal_at passes.
select tests.pause(tests.h1(), now() - interval '2 hours');
select tests.anon();
select tests.eq('pause: a Sprint paused before reveal_at stays sealed', tests.count($$ select 1 from hackathon_submissions where hackathon_id = tests.h1() $$)::text, '0');
select tests.eq('pause: ...awards too', tests.count($$ select 1 from hackathon_awards where hackathon_id = tests.h1() $$)::text, '0');
select tests.clear_override(tests.h1());
select tests.eq('resume: ...and reveals when it resumes', tests.count($$ select 1 from hackathon_submissions where hackathon_id = tests.h1() $$)::text, '2');

-- ============================================================================
-- The theme under a pause, and cancelling
-- ============================================================================
select tests.set_phase(tests.h1(), 'live');   -- kickoff was an hour ago
select tests.pause(tests.h1(), now() - interval '2 hours');   -- paused before kickoff
select tests.login('alice');
select tests.eq('theme: paused before kickoff keeps it hidden', (select theme from hackathon_overview where id = tests.h1()), null);
select tests.eq('theme: ...its clock stopped before kickoff', (select state || '/' || phase from hackathon_overview where id = tests.h1()), 'paused/teams_locked');
select tests.pause(tests.h1(), now() - interval '2 hours', 'cancelled');
select tests.eq('theme: cancelled before kickoff keeps it hidden', (select theme from hackathon_overview where id = tests.h1()), null);

select tests.pause(tests.h1(), now() - interval '10 minutes');
select tests.as_db();
select tests.lives('cancel: the admin console cancels', $$ update public.hackathons set status_override = 'cancelled' where id = tests.h1() $$);
select tests.eq('cancel: a paused Sprint keeps its original freeze time',
  (select status_override_at::text from public.hackathons where id = tests.h1()), (now() - interval '10 minutes')::text);
select tests.ok('cancel: announced in the lobby', tests.lobby_has('has been cancelled'));
select tests.login('alice');
select tests.eq('cancel: paused after kickoff, the theme stays visible', (select theme from hackathon_overview where id = tests.h1()), 'Build for night owls');
select tests.throws('cancel: the lobby is read-only', $$ insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h1(), tests.u('alice'), 'why?') $$, 'row-level security');
select tests.ok('cancel: ...but still readable', tests.count($$ select 1 from hackathon_lobby_messages where hackathon_id = tests.h1() $$) > 0);
select tests.throws('cancel: team rooms are frozen', $$ insert into hackathon_team_messages (team_id, user_id, body) values (tests.team('Rockets'), tests.u('alice'), 'hm') $$, 'row-level security');

select tests.clear_override(tests.h1());
select tests.set_phase(tests.h1(), 'judging');
select tests.service();
select tests.lives('audit: the admin console deletes a submission after the deadline', $$ delete from hackathon_submissions where team_id = tests.team('Comets') $$);
select tests.ok('audit: ...logged, with what was deleted',
  (select a.action = 'delete' and a.subject = 'Comet Chat (team Comets)' and a.changes -> 'project_name' = '{"old": "Comet Chat", "new": null}'::jsonb
   from tests.last_audit() a),
  (select 'last entry: ' || to_jsonb(a)::text from tests.last_audit() a));
select tests.as_db();
select tests.lives('audit: deleting a Sprint still works, and takes its log', $$ delete from public.hackathons where id = tests.h1() $$);
select tests.eq('audit: ...none left for it', tests.audit_count('hackathon_submissions')::text, '0');

select tests.finish();
