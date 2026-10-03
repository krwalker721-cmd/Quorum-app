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
--   Needs migrations 018-027.
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
create function tests.h2() returns uuid language sql immutable as $$
  select 'c2000000-0000-0000-0000-000000000002'::uuid  -- the admin controls (022)
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
  -- Like a real request: signed out and service-role calls carry no "sub"
  -- claim at all (an empty one is an error in Supabase's auth.uid()).
  perform set_config('request.jwt.claims',
    case when p_user is null then json_build_object('role', p_role)
         else json_build_object('sub', tests.u(p_user), 'role', p_role) end::text, true);
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

create function tests.team2(p_name text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.hackathon_teams where name = p_name and hackathon_id = tests.h2()
$$;

create function tests.last_change() returns public.admin_change_log
language sql stable security definer set search_path = public as $$
  select * from public.admin_change_log order by id desc limit 1
$$;

create function tests.changes_where(p_area text, p_hackathon uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) from public.admin_change_log
  where area = p_area and hackathon_id is not distinct from p_hackathon
$$;

-- What the admin console's server routes send with each request.
create function tests.admin_headers(p_action text) returns void language sql as $$
  select set_config('request.headers', json_build_object(
    'x-quorum-actor', 'Ada Admin (admin console)',
    'x-quorum-actor-id', tests.u('admin'),
    'x-quorum-action', p_action)::text, true)
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

-- 024: the Sprint page's "who's registered" list.
select tests.eq('registrants: an active member sees who''s in', tests.count($$ select 1 from hackathon_registrants(tests.h1()) $$)::text, '6');
select tests.ok('registrants: ...by name, oldest first',
  (select full_name = 'Alice Arden' from hackathon_registrants(tests.h1()) limit 1));
select tests.throws('registrants: ...and nothing about mode or team', $$ select mode from hackathon_registrants(tests.h1()) $$, 'does not exist');
select tests.login('erin');
select tests.eq('registrants: a lapsed non-participant sees no one', tests.count($$ select 1 from hackathon_registrants(tests.h1()) $$)::text, '0');
select tests.anon();
select tests.throws('registrants: signed out can''t call it', $$ select * from hackathon_registrants(tests.h1()) $$, 'permission denied');
select tests.login('oscar');

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
select tests.login('oscar');
select tests.ok('registrants: someone who withdrew drops off the list',
  tests.count($$ select 1 from hackathon_registrants(tests.h1()) $$) = 5
  and tests.count($$ select 1 from hackathon_registrants(tests.h1()) where user_id = tests.u('gus') $$) = 0);

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
create temporary table before_short as select ends_at from public.hackathons where id = tests.h1();
select tests.pause(tests.h1(), now() - interval '40 seconds');
select tests.lives('resume (023): after a 40-second pause', $$ select hackathon_resume(tests.h1(), true) $$);
select tests.ok('resume (023): gives back a whole minute, so times stay on the minute',
  (select h.ends_at = b.ends_at + interval '1 minute' from public.hackathons h, before_short b where h.id = tests.h1()));

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
select tests.service();
select set_config('request.headers', json_build_object('x-quorum-actor-id', tests.u('admin'), 'x-quorum-via', 'admin console, 203.0.113.9')::text, true);
select tests.lives('audit (023): a server route sends the admin''s account id', $$ update hackathon_submissions set repo_url = 'https://github.com/example/nightowl' where team_id = tests.team('Rockets') $$);
select set_config('request.headers', '', true);
select tests.eq('audit (023): ...and the entry names them', (select actor from tests.last_audit()), 'Ada Admin (admin console, 203.0.113.9)');

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

-- ============================================================================
-- Admin controls (022)
-- ============================================================================
select tests.as_db();
select tests.lives('drafts: a Sprint can start with no dates', $$
  insert into public.hackathons (id, title, max_team_size) values (tests.h2(), 'Night Owls', 2) $$);
select tests.ok('log (023): a new row''s empty fields aren''t listed',
  not exists (select 1 from public.admin_change_log c, jsonb_each(c.changes) e
              where c.area = 'sprint' and c.action = 'insert' and c.hackathon_id = tests.h2()
                and e.value = '{"old": null, "new": null}'::jsonb));
select tests.eq('drafts: the slug defaults to sprint-<number>',
  (select slug from public.hackathons where id = tests.h2()),
  (select 'sprint-' || number from public.hackathons where id = tests.h2()));
select tests.eq('drafts: a dateless draft reads as draft', hackathon_state(tests.h2()), 'draft');
select tests.throws('publish: not without every date', $$ update public.hackathons set is_published = true where id = tests.h2() $$, 'hackathons_published_has_dates');
select tests.throws('drafts: dates that are set must still be in order', $$
  update public.hackathons set starts_at = now() + interval '2 days', ends_at = now() + interval '1 day' where id = tests.h2() $$, 'hackathons_timeline_order');
select tests.set_phase(tests.h2(), 'registration');
select tests.lives('publish: once every date is set', $$ update public.hackathons set is_published = true where id = tests.h2() $$);

select tests.service();
select tests.admin_headers('Renamed the Sprint');
select tests.lives('log: the admin console renames a Sprint', $$ update hackathons set title = 'Night Owls II' where id = tests.h2() $$);
select set_config('request.headers', '', true);
select tests.ok('log: ...recorded with who, why, and old → new',
  (select c.area = 'sprint' and c.action = 'update' and c.actor = 'Ada Admin (admin console)'
          and c.actor_id = tests.u('admin') and c.summary = 'Renamed the Sprint' and c.db_role = 'service_role'
          and c.changes = '{"title": {"old": "Night Owls", "new": "Night Owls II"}}'::jsonb
   from tests.last_change() c),
  (select 'last entry: ' || to_jsonb(c)::text from tests.last_change() c));

select set_config('request.headers', json_build_object(
  'x-quorum-actor-id', tests.u('admin'), 'x-quorum-via', 'admin console, 203.0.113.9',
  'x-quorum-action-b64', encode(convert_to('Tagline for the Café crowd', 'UTF8'), 'base64'))::text, true);
select tests.lives('log (023): a server route sends the admin''s account id and a note', $$ update hackathons set tagline = 'For the café crowd' where id = tests.h2() $$);
select set_config('request.headers', '', true);
select tests.ok('log (023): ...named from the account, with the note decoded',
  (select c.actor = 'Ada Admin (admin console, 203.0.113.9)' and c.actor_id = tests.u('admin')
          and c.summary = 'Tagline for the Café crowd' from tests.last_change() c),
  (select 'last entry: ' || to_jsonb(c)::text from tests.last_change() c));

select tests.login('alice');
select tests.lives('log: members register for Sprint 2', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h2(), tests.u('alice')) $$);
select tests.lives('log: ...and create a team', $$ select hackathon_create_team(tests.h2(), 'Owls') $$);
select tests.login('bob');
select tests.lives('log: bob registers', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h2(), tests.u('bob')) $$);
select tests.login('carol');
select tests.lives('log: carol registers', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h2(), tests.u('carol')) $$);
select tests.as_db();
select tests.set_member('dave', true);   -- as the database: a member can't extend their own trial
select tests.login('dave');
select tests.lives('log: dave registers', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h2(), tests.u('dave')) $$);
select tests.login('fay');
select tests.lives('log: fay registers', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h2(), tests.u('fay')) $$);
select tests.login('gus');
select tests.lives('log: gus registers', $$ insert into hackathon_registrations (hackathon_id, user_id) values (tests.h2(), tests.u('gus')) $$);
select tests.ok('log: members'' own actions aren''t logged as admin changes',
  tests.changes_where('registration', tests.h2()) = 0 and tests.changes_where('team', tests.h2()) = 0
  and tests.changes_where('member', tests.h2()) = 0);

select tests.service();
select tests.admin_headers('Created team Larks');
select tests.lives('teams (admin): create a team by hand', $$ select hackathon_admin_create_team(tests.h2(), 'Larks', array[tests.u('bob')]) $$);
select tests.ok('teams (admin): ...the first member owns it',
  (select role = 'owner' from hackathon_team_members where team_id = tests.team2('Larks') and user_id = tests.u('bob')));
select tests.ok('log: ...and the team and its member are logged',
  tests.changes_where('team', tests.h2()) = 1 and tests.changes_where('member', tests.h2()) = 1);
select tests.throws('teams (admin): someone already on a team must be moved instead', $$ select hackathon_admin_create_team(tests.h2(), 'Dupes', array[tests.u('alice')]) $$, 'Move them instead');

select tests.lives('teams (admin): move carol onto Owls', $$ select hackathon_admin_move_member(tests.u('carol'), tests.team2('Owls')) $$);
select tests.throws('teams (admin): a full team refuses without an override', $$ select hackathon_admin_move_member(tests.u('dave'), tests.team2('Owls')) $$, 'full');
select tests.lives('teams (admin): ...and takes them with one', $$ select hackathon_admin_move_member(tests.u('dave'), tests.team2('Owls'), true) $$);
select tests.eq('teams (admin): the override is recorded on the team', (select max_size_override::text from hackathon_teams where id = tests.team2('Owls')), '3');
select tests.lives('teams (admin): move fay onto Larks', $$ select hackathon_admin_move_member(tests.u('fay'), tests.team2('Larks')) $$);
select tests.eq('teams (admin): ...and her registration follows',
  (select (team_id = tests.team2('Larks'))::text from hackathon_registrations where hackathon_id = tests.h2() and user_id = tests.u('fay')), 'true');
select tests.login('alice');
select tests.throws('teams (admin): members can''t call the admin functions', $$ select hackathon_admin_move_member(tests.u('gus'), tests.team2('Owls'), true) $$, 'permission denied');

select tests.login('bob');
select tests.lives('merge: Larks has a thread', $$ insert into hackathon_team_messages (team_id, user_id, body) values (tests.team2('Larks'), tests.u('bob'), 'larks unite') $$);
select tests.lives('merge: ...and a doc', $$ insert into hackathon_team_docs (team_id, title, created_by) values (tests.team2('Larks'), 'Larks plan', tests.u('bob')) $$);
select tests.service();
select tests.throws('merge: refused when it would go over the limit', $$ select hackathon_admin_merge_teams(tests.team2('Larks'), tests.team2('Owls')) $$, 'Override the limit');
select tests.lives('merge: allowed with an override', $$ select hackathon_admin_merge_teams(tests.team2('Larks'), tests.team2('Owls'), true) $$);
select tests.as_db();
select tests.ok('merge: the source team is gone', tests.team2('Larks') is null);
select tests.eq('merge: everyone is on the target', (select count(*)::text from public.hackathon_team_members where team_id = tests.team2('Owls')), '5');
select tests.ok('merge: the room came along',
  exists (select 1 from public.hackathon_team_messages where team_id = tests.team2('Owls') and body = 'larks unite')
  and exists (select 1 from public.hackathon_team_docs where team_id = tests.team2('Owls') and title = 'Larks plan'));
select tests.login('alice');
select tests.ok('merge: the target''s members can read what moved', tests.count($$ select 1 from hackathon_team_docs where title = 'Larks plan' $$) = 1);

select tests.service();
select tests.lives('teams (admin): gus gets his own team', $$ select hackathon_admin_create_team(tests.h2(), 'Wrens', array[tests.u('gus')]) $$);
select tests.set_phase(tests.h2(), 'live');
select tests.login('gus');
select tests.lives('merge: Wrens submits', $$ insert into hackathon_submissions (team_id, hackathon_id, project_name) values (tests.team2('Wrens'), tests.h2(), 'Birdsong') $$);
select tests.service();
select tests.throws('merge: never away from a team that has submitted', $$ select hackathon_admin_merge_teams(tests.team2('Wrens'), tests.team2('Owls'), true) $$, 'has a submission');

create temporary table before_shift as select team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at from public.hackathons where id = tests.h2();
select tests.lives('extend: the deadline by 30 minutes', $$ select hackathon_admin_shift(tests.h2(), 'ends_at', 30) $$);
select tests.ok('extend: the deadline, judging end and reveal moved; kickoff didn''t',
  (select h.ends_at = b.ends_at + interval '30 minutes' and h.judging_ends_at = b.judging_ends_at + interval '30 minutes'
          and h.reveal_at = b.reveal_at + interval '30 minutes' and h.starts_at = b.starts_at
   from public.hackathons h, before_shift b where h.id = tests.h2()));
select tests.lives('push back: kickoff by an hour, and everything after it', $$ select hackathon_admin_shift(tests.h2(), 'starts_at', 60) $$);
select tests.ok('push back: team lock stayed put',
  (select h.team_lock_at = b.team_lock_at and h.starts_at = b.starts_at + interval '60 minutes'
          and h.ends_at = b.ends_at + interval '90 minutes'
   from public.hackathons h, before_shift b where h.id = tests.h2()));
select tests.throws('extend: whole minutes, forwards only', $$ select hackathon_admin_shift(tests.h2(), 'ends_at', -5) $$, 'between 1 minute');
select tests.login('alice');
select tests.throws('extend: members can''t', $$ select hackathon_admin_shift(tests.h2(), 'ends_at', 30) $$, 'permission denied');
select tests.set_phase(tests.h2(), 'revealed');
select tests.service();
select tests.throws('extend: not after the reveal', $$ select hackathon_admin_shift(tests.h2(), 'ends_at', 30) $$, 'already been revealed');

select tests.lives('duplicate: the next Sprint from this one', $$ select hackathon_admin_duplicate(tests.h2()) $$);
select tests.as_db();
select tests.ok('duplicate: next number, same settings, no dates, no theme, unpublished',
  (select d.number = o.number + 1 and d.slug = 'sprint-' || d.number and d.title = o.title and d.max_team_size = o.max_team_size
          and d.starts_at is null and d.reveal_at is null and d.theme_hidden is null and not d.is_published
   from public.hackathons d, public.hackathons o
   where o.id = tests.h2() and d.number = (select max(number) from public.hackathons)));

select tests.service();
select tests.lives('judges: invite someone by email', $$ insert into hackathon_judges (hackathon_id, invite_email) values (tests.h2(), '  Guest@Example.com ') $$);
select tests.eq('judges: ...stored tidy', (select invite_email from hackathon_judges where hackathon_id = tests.h2() and user_id is null), 'guest@example.com');
select tests.throws('judges: one invite per email', $$ insert into hackathon_judges (hackathon_id, invite_email) values (tests.h2(), 'guest@EXAMPLE.com') $$, 'duplicate key');
select tests.throws('judges: an account or an email', $$ insert into hackathon_judges (hackathon_id) values (tests.h2()) $$, 'hackathon_judges_who');

select tests.lives('countdowns: the admin console creates the launch countdown, off', $$
  insert into site_countdowns (key, label, subtext, target_at, is_launch, zero_behavior, zero_message, cta_label, cta_url, updated_by)
  values ('test-launch', 'Founding seats open', 'Twelve seats per cohort.', now() + interval '7 days', true,
          'show_message', 'Doors are open', 'Request an invite', '/signup', tests.u('admin')) $$);
select tests.anon();
select tests.eq('countdowns: a disabled one is invisible signed out', tests.count($$ select 1 from site_countdowns where key = 'test-launch' $$)::text, '0');
select tests.service();
select tests.admin_headers('Turned on the launch countdown');
select tests.lives('countdowns: switched on', $$ update site_countdowns set is_enabled = true where key = 'test-launch' $$);
select set_config('request.headers', '', true);
select tests.anon();
select tests.eq('countdowns: an enabled one is public', tests.count($$ select key, label, target_at, zero_message, cta_url from site_countdowns where key = 'test-launch' $$)::text, '1');
select tests.throws('countdowns: who edited it stays private', $$ select updated_by from site_countdowns $$, 'permission denied');
select tests.throws('countdowns: signed out can''t write', $$ update site_countdowns set label = 'x' $$, 'permission denied');
select tests.login('alice');
select tests.eq('countdowns: members can''t change one', tests.affected($$ update site_countdowns set label = 'hacked' where key = 'test-launch' $$)::text, '0');
select tests.throws('countdowns: ...or make one', $$ insert into site_countdowns (key, label, target_at) values ('mine', 'Mine', now()) $$, 'row-level security');
select tests.login('admin');
select tests.lives('countdowns: a signed-in admin moves the target', $$ update site_countdowns set target_at = target_at + interval '1 day' where key = 'test-launch' $$);
select tests.as_db();
select tests.eq('log: a signed-in admin''s own edit is logged under their name', (select actor from tests.last_change()), 'Ada Admin');
select tests.eq('countdowns: ...and is recorded as its editor', (select (updated_by = tests.u('admin'))::text from public.site_countdowns where key = 'test-launch'), 'true');
select tests.ok('log: every countdown change, with old → new',
  (select count(*) from public.admin_change_log where subject = 'Countdown "test-launch"') = 3
  and (select (c.changes -> 'is_enabled') = '{"old": false, "new": true}'::jsonb and c.summary = 'Turned on the launch countdown'
       from public.admin_change_log c where c.subject = 'Countdown "test-launch"' and c.action = 'update' order by c.id limit 1));
select tests.throws('countdowns: a message is needed to show one at zero', $$
  insert into public.site_countdowns (key, label, target_at, zero_behavior) values ('test-teaser', 'Soon', now(), 'show_message') $$, 'site_countdowns_zero_message');

select tests.login('alice');
select tests.eq('log: members can''t read it', tests.count($$ select 1 from admin_change_log $$)::text, '0');
select tests.login('admin');
select tests.ok('log: admins can', tests.count($$ select 1 from admin_change_log $$) > 0);
select tests.service();
select tests.throws('log: the admin console can''t rewrite it', $$ update admin_change_log set actor = 'nobody' $$, 'permission denied');
select tests.as_db();
select tests.throws('log: even the database owner can''t', $$ delete from public.admin_change_log $$, 'append-only');


-- ============================================================================
-- Phase 4 (025): invite links, personal invites, counts, check-in, renaming
-- ============================================================================
select tests.as_db();
create function tests.h4() returns uuid language sql immutable as $$ select 'c4000000-0000-0000-0000-000000000004'::uuid $$;
create function tests.team4(p_name text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.hackathon_teams where name = p_name and hackathon_id = tests.h4()
$$;
create function tests.code4(p_name text) returns text
language sql stable security definer set search_path = public as $$
  select code from public.hackathon_team_invite_codes where team_id = tests.team4(p_name)
$$;
create function tests.invite4(p_team text, p_user text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.hackathon_team_invitations where team_id = tests.team4(p_team) and user_id = tests.u(p_user)
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

insert into public.hackathons (id, slug, title, theme_hidden, max_team_size, is_published,
  registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at)
values (tests.h4(), 'test-join-queue', 'Join Queue Sprint', 'Queues', 3, true,
  now(), now(), now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', now() + interval '4 days');
select tests.set_phase(tests.h4(), 'registration');
select tests.set_member('dave', true);
select tests.set_member('gus', true);

-- Invite links.
select tests.login('alice');
select tests.lives('code: alice registers and starts Links', $$
  insert into hackathon_registrations (hackathon_id, user_id, mode) values (tests.h4(), tests.u('alice'), 'random');
  select hackathon_create_team(tests.h4(), 'Links') $$);
select tests.ok('code: the owner gets an eight-character code', hackathon_team_invite_code(tests.team4('Links')) ~ '^[A-HJKMNP-Z2-9]{8}$');
select tests.eq('code: ...the same one each time', hackathon_team_invite_code(tests.team4('Links')), tests.code4('Links'));
select tests.login('bob');
select tests.eq('code: others can''t read a team''s code', tests.count($$ select 1 from hackathon_team_invite_codes $$)::text, '0');
select tests.throws('code: ...or ask for it', $$ select hackathon_team_invite_code(tests.team4('Links')) $$, 'Only the team owner');
select tests.throws('code: nobody writes codes directly', $$
  insert into hackathon_team_invite_codes (team_id, code) values (tests.team4('Links'), 'ABCDEFGH') $$, 'permission denied');
select tests.ok('code: the link previews the team',
  (select team_name = 'Links' and member_count = 1 and max_size = 3 from hackathon_team_by_code(tests.code4('Links'))));
select tests.lives('code: bob, not registered yet, joins with the link', $$ select hackathon_join_with_code(tests.code4('Links')) $$);
select tests.ok('code: ...which registered him, on the team',
  (select r.mode = 'team' and r.team_id = tests.team4('Links') from hackathon_registrations r where r.hackathon_id = tests.h4() and r.user_id = tests.u('bob')));
select tests.throws('code: one team per Sprint', $$ select hackathon_join_with_code(tests.code4('Links')) $$, 'already on a team');
select tests.login('erin');
select tests.throws('code: a lapsed member can''t join', $$ select hackathon_join_with_code(tests.code4('Links')) $$, 'active members');
select tests.service();
select tests.lives('code: jude judges this Sprint', $$ insert into hackathon_judges (hackathon_id, user_id, accepted_at) values (tests.h4(), tests.u('jude'), now()) $$);
select tests.set_member('jude', true);
select tests.login('jude');
select tests.throws('code: ...so can''t join a team in it', $$ select hackathon_join_with_code(tests.code4('Links')) $$, 'judge');
select tests.set_member('jude', false);
select tests.login('carol');
select tests.throws('code: a made-up code', $$ select hackathon_join_with_code('ZZZZZZZZ') $$, 'isn''t valid');
select tests.lives('code: lower case and spaces are fine', $$ select hackathon_join_with_code('  ' || lower(tests.code4('Links')) || ' ') $$);
select tests.login('dave');
select tests.throws('code: a full team refuses the next', $$ select hackathon_join_with_code(tests.code4('Links')) $$, 'full');
select tests.login('alice');
select tests.lives('code: the owner resets it', $$ select hackathon_reset_invite_code(tests.team4('Links')) $$);
select tests.as_db();
select tests.ok('code: ...and it changed', tests.code4('Links') is not null);

-- Personal invites.
select tests.login('dave');
select tests.lives('invite: dave starts Invites', $$
  insert into hackathon_registrations (hackathon_id, user_id) values (tests.h4(), tests.u('dave'));
  select hackathon_create_team(tests.h4(), 'Invites') $$);
select tests.lives('invite: dave invites fay, who hasn''t registered', $$ select hackathon_invite_member(tests.team4('Invites'), tests.u('fay')) $$);
select tests.throws('invite: not someone already on a team', $$ select hackathon_invite_member(tests.team4('Invites'), tests.u('alice')) $$, 'already on a team');
select tests.throws('invite: one invite at a time', $$ select hackathon_invite_member(tests.team4('Invites'), tests.u('fay')) $$, 'already invited');
select tests.throws('invite: nobody writes invitations directly', $$
  insert into hackathon_team_invitations (team_id, hackathon_id, user_id) values (tests.team4('Invites'), tests.h4(), tests.u('oscar')) $$, 'permission denied');
select tests.login('bob');
select tests.throws('invite: only the owner invites', $$ select hackathon_invite_member(tests.team4('Links'), tests.u('oscar')) $$, 'Only the team owner');
select tests.eq('invite: other people can''t see it', tests.count($$ select 1 from hackathon_team_invitations $$)::text, '0');
select tests.login('fay');
select tests.eq('invite: the invitee sees it', tests.count($$ select 1 from hackathon_team_invitations $$)::text, '1');
select tests.lives('invite: fay accepts', $$ select hackathon_respond_to_invitation(tests.invite4('Invites', 'fay'), true) $$);
select tests.ok('invite: ...registered and on the team',
  (select r.mode = 'team' and r.team_id = tests.team4('Invites') and r.withdrawn_at is null
   from hackathon_registrations r where r.hackathon_id = tests.h4() and r.user_id = tests.u('fay')));
select tests.throws('invite: an answered invite stays answered', $$ select hackathon_respond_to_invitation(tests.invite4('Invites', 'fay'), true) $$, 'already been answered');
select tests.login('oscar');
select tests.throws('invite: nobody answers someone else''s', $$ select hackathon_respond_to_invitation(tests.invite4('Invites', 'fay'), false) $$, 'doesn''t exist');

select tests.login('dave');
select tests.lives('invite: dave invites gus', $$ select hackathon_invite_member(tests.team4('Invites'), tests.u('gus')) $$);
select tests.login('gus');
select tests.lives('invite: gus declines', $$ select hackathon_respond_to_invitation(tests.invite4('Invites', 'gus'), false) $$);
select tests.login('dave');
select tests.lives('invite: asking again after a no', $$ select hackathon_invite_member(tests.team4('Invites'), tests.u('gus')) $$);
select tests.lives('invite: the owner can take it back', $$ select hackathon_cancel_invitation(tests.invite4('Invites', 'gus')) $$);
select tests.lives('invite: inviting a lapsed member reveals nothing', $$ select hackathon_invite_member(tests.team4('Invites'), tests.u('erin')) $$);
select tests.login('erin');
select tests.throws('invite: ...they find out when they accept', $$ select hackathon_respond_to_invitation(tests.invite4('Invites', 'erin'), true) $$, 'active members');
select tests.login('dave');
select tests.lives('invite: dave invites oscar', $$ select hackathon_invite_member(tests.team4('Invites'), tests.u('oscar')) $$);
select tests.login('oscar');
select tests.lives('invite: oscar makes his own team instead', $$
  insert into hackathon_registrations (hackathon_id, user_id) values (tests.h4(), tests.u('oscar'));
  select hackathon_create_team(tests.h4(), 'Solo') $$);
select tests.as_db();
select tests.eq('invite: ...which closed the invite he had', (select status from public.hackathon_team_invitations where id = tests.invite4('Invites', 'oscar')), 'cancelled');
select tests.login('oscar');
select tests.throws('invite: ...so he can''t accept it', $$ select hackathon_respond_to_invitation(tests.invite4('Invites', 'oscar'), true) $$, 'already been answered');
select tests.login('gus');
select tests.lives('invite: gus takes the last seat on Invites by request', $$
  insert into hackathon_registrations (hackathon_id, user_id) values (tests.h4(), tests.u('gus'));
  select hackathon_request_to_join(tests.team4('Invites')) $$);
select tests.throws('invite: nobody adds themselves to a team directly', $$
  insert into hackathon_team_members (team_id, user_id) values (tests.team4('Invites'), tests.u('gus')) $$, 'row-level security');
select tests.login('dave');
select tests.lives('invite: ...dave accepts', $$
  select hackathon_respond_to_join_request((select id from hackathon_team_join_requests where team_id = tests.team4('Invites') and user_id = tests.u('gus')), true) $$);
select tests.eq('invite: accepting a request records the team mode',
  (select mode from hackathon_registrations where hackathon_id = tests.h4() and user_id = tests.u('gus')), 'team');
select tests.login('oscar');
select tests.lives('invite: oscar leaves Solo (it dissolves)', $$ select hackathon_leave_team(tests.team4('Solo')) $$);
select tests.login('dave');
select tests.throws('invite: a full team can''t invite', $$ select hackathon_invite_member(tests.team4('Invites'), tests.u('oscar')) $$, 'full');

-- Counts.
select tests.login('oscar');
select tests.ok('counts: numbers for the arena''s audience',
  (select registered = 7 and random_pool = 0 and looking = 1 and on_teams = 6 and teams = 2 from hackathon_registration_counts(tests.h4())));
select tests.login('erin');
select tests.ok('counts: nothing for a lapsed non-participant',
  (select registered = 0 and teams = 0 from hackathon_registration_counts(tests.h4())));
select tests.anon();
select tests.throws('counts: signed out can''t call it', $$ select * from hackathon_registration_counts(tests.h4()) $$, 'permission denied');

-- Team lock.
select tests.login('dave');
select tests.lives('lock: dave opens Invites to requests before lock', $$
  select hackathon_update_team(tests.team4('Invites'), p_open_to_requests => true) $$);
select tests.set_phase(tests.h4(), 'teams_locked');
select tests.login('admin');
select tests.throws('lock: no joining by link after team lock', $$ select hackathon_join_with_code(tests.code4('Links')) $$, 'registration is open');
select tests.login('alice');
select tests.throws('lock: no inviting after team lock', $$ select hackathon_invite_member(tests.team4('Links'), tests.u('oscar')) $$, 'registration is open');
select tests.lives('lock: the owner can still rename', $$ select hackathon_update_team(tests.team4('Links'), 'Chain Links') $$);
select tests.throws('lock: ...but not open to requests', $$ select hackathon_update_team(tests.team4('Chain Links'), p_open_to_requests => true) $$, 'locked');
select tests.login('bob');
select tests.throws('lock: a member of a team they formed can''t rename it', $$ select hackathon_update_team(tests.team4('Chain Links'), 'Mine') $$, 'Only the team owner');
select tests.service();
select tests.lives('lock: admins still can (admin console)', $$ select hackathon_admin_move_member(tests.u('oscar'), tests.team4('Invites'), true) $$);

-- Check-in.
select tests.login('alice');
select tests.throws('check-in: not before kickoff', $$ select hackathon_check_in(tests.h4()) $$, 'while the Sprint is live');
select tests.set_phase(tests.h4(), 'live');
select tests.lives('check-in: alice checks in', $$ select hackathon_check_in(tests.h4()) $$);
select tests.ok('check-in: ...once; pressing again keeps the first time',
  hackathon_check_in(tests.h4()) = (select checked_in_at from hackathon_registrations where hackathon_id = tests.h4() and user_id = tests.u('alice')));
select tests.login('erin');
select tests.throws('check-in: only participants', $$ select hackathon_check_in(tests.h4()) $$, 'Only people taking part');
select tests.pause(tests.h4(), now() - interval '5 minutes');
select tests.login('bob');
select tests.throws('check-in: not while paused', $$ select hackathon_check_in(tests.h4()) $$, 'while the Sprint is live');
select tests.clear_override(tests.h4());
select tests.login('alice');
select tests.lives('rename: during the Sprint', $$ select hackathon_update_team(tests.team4('Chain Links'), 'Links', '◆', '#38bdf8') $$);
select tests.set_phase(tests.h4(), 'judging');
select tests.throws('rename: not after the deadline', $$ select hackathon_update_team(tests.team4('Links'), 'Late') $$, 'until the submission deadline');

-- ============================================================================
-- Phase 4 (026): the team matcher
-- ============================================================================
select tests.as_db();
create function tests.m(i integer) returns uuid language sql immutable as $$
  select ('b0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid
$$;
create function tests.h5() returns uuid language sql immutable as $$ select 'c5000000-0000-0000-0000-000000000005'::uuid $$;
create function tests.h6() returns uuid language sql immutable as $$ select 'c6000000-0000-0000-0000-000000000006'::uuid $$;
create function tests.h7() returns uuid language sql immutable as $$ select 'c7000000-0000-0000-0000-000000000007'::uuid $$;
create function tests.cohort(i integer) returns uuid language sql immutable as $$
  select ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid
$$;
-- Every team in a Sprint with its members, as one string: equal strings mean
-- identical teams.
create function tests.teams_snapshot(p_hackathon uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(string_agg(t.name || ':' || m.user_id::text || ':' || m.role, ',' order by t.name, m.user_id), '')
  from public.hackathon_teams t join public.hackathon_team_members m on m.team_id = t.id
  where t.hackathon_id = p_hackathon
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

insert into auth.users (id, email, raw_user_meta_data)
select tests.m(i), 'm' || i || '@hackathon.test', json_build_object('full_name', 'Member ' || i)::jsonb
from generate_series(1, 14) i;
update public.profiles set status = 'approved', trial_ends_at = now() + interval '20 days'
where id in (select tests.m(i) from generate_series(1, 14) i);
update public.profiles set skills = array['backend engineer'] where id in (tests.m(1), tests.m(5), tests.m(8));
update public.profiles set skills = array['product design', 'figma'] where id in (tests.m(2), tests.m(6));
update public.profiles set skills = array['sales'] where id in (tests.m(3), tests.m(7));
insert into public.cohorts (id, name) values (tests.cohort(1), 'Cohort 1'), (tests.cohort(2), 'Cohort 2'), (tests.cohort(3), 'Cohort 3');
insert into public.cohort_members (user_id, cohort_id)
select tests.m(i), tests.cohort(case when i <= 4 then 1 when i <= 7 then 2 else 3 end) from generate_series(1, 10) i;

select tests.ok('skills: sorted into kinds',
  private.skill_bucket(array['Backend engineer']) = 'technical' and private.skill_bucket(array['Figma']) = 'design'
  and private.skill_bucket(array['sales']) = 'business' and private.skill_bucket('{}') is null);

-- Sprint 5: max 4, so teams of 3. Eight in the pool across three cohorts
-- (four, three and one), one team open to requests (m9, cohort 3) and one
-- closed (m10).
insert into public.hackathons (id, slug, title, max_team_size, is_published,
  registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at)
values (tests.h5(), 'test-matcher', 'Matcher Sprint', 4, true,
  now(), now(), now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', now() + interval '4 days');
select tests.set_phase(tests.h5(), 'registration');
insert into public.hackathon_registrations (hackathon_id, user_id, mode)
select tests.h5(), tests.m(i), 'random' from generate_series(1, 10) i;
select hackathon_admin_create_team(tests.h5(), 'Open Door', array[tests.m(9)]);
select hackathon_admin_create_team(tests.h5(), 'Closed Shop', array[tests.m(10)]);
update public.hackathon_teams set is_open_to_requests = true where hackathon_id = tests.h5() and name = 'Open Door';
update public.hackathon_teams set is_open_to_requests = false where hackathon_id = tests.h5() and name = 'Closed Shop';

select tests.service();
select tests.throws('matcher: not before team lock', $$ select hackathon_run_matcher(tests.h5()) $$, 'haven''t locked');
select tests.set_phase(tests.h5(), 'teams_locked');
select tests.login('alice');
select tests.throws('matcher: members can''t run it', $$ select hackathon_run_matcher(tests.h5()) $$, 'permission denied');
select tests.pause(tests.h5(), now() - interval '1 minute');
select tests.service();
select tests.throws('matcher: not while paused', $$ select hackathon_run_matcher(tests.h5()) $$, 'paused');
select tests.clear_override(tests.h5());

select tests.lives('matcher: runs at team lock', $$ select hackathon_run_matcher(tests.h5()) $$);
select tests.as_db();
create temp table matcher_first as select tests.teams_snapshot(tests.h5()) as snap,
  (select matched_at from public.hackathons where id = tests.h5()) as at,
  (select match_report from public.hackathons where id = tests.h5()) as report;
select tests.eq('matcher: everyone in the pool is on a team',
  tests.count($$ select 1 from hackathon_registrations r where r.hackathon_id = tests.h5() and r.withdrawn_at is null and r.team_id is null $$)::text, '0');
select tests.eq('matcher: two new teams of three', tests.count($$
  select 1 from hackathon_teams t where t.hackathon_id = tests.h5() and t.is_random_matched
  and (select count(*) from hackathon_team_members m where m.team_id = t.id) = 3 $$)::text, '2');
select tests.eq('matcher: the two left over filled the open team', tests.count($$
  select 1 from hackathon_team_members m where m.team_id = (select id from hackathon_teams where hackathon_id = tests.h5() and name = 'Open Door') $$)::text, '3');
select tests.eq('matcher: a closed team is left alone', tests.count($$
  select 1 from hackathon_team_members m where m.team_id = (select id from hackathon_teams where hackathon_id = tests.h5() and name = 'Closed Shop') $$)::text, '1');
select tests.eq('matcher: no team over the limit', tests.count($$
  select 1 from hackathon_teams t where t.hackathon_id = tests.h5()
  and (select count(*) from hackathon_team_members m where m.team_id = t.id) > 4 $$)::text, '0');
select tests.eq('matcher: every new team has exactly one owner', tests.count($$
  select 1 from hackathon_teams t where t.hackathon_id = tests.h5() and t.is_random_matched
  and (select count(*) from hackathon_team_members m where m.team_id = t.id and m.role = 'owner') = 1 $$)::text, '2');
select tests.ok('matcher: new teams get distinct names, closed to requests',
  (select count(distinct name) = 2 and bool_and(not is_open_to_requests and emblem is not null and color is not null)
   from hackathon_teams where hackathon_id = tests.h5() and is_random_matched));
-- Four people from cohort 1 across three teams must share once; the best mix
-- has exactly one same-cohort pair.
select tests.eq('matcher: cohorts are mixed as far as possible', (select report ->> 'same_cohort_pairs' from matcher_first), '1');
select tests.eq('matcher: ...counting the real teams too', (
  select count(*) from public.hackathon_team_members a
  join public.hackathon_team_members b on a.team_id = b.team_id and a.user_id < b.user_id
  join public.cohort_members ca on ca.user_id = a.user_id
  join public.cohort_members cb on cb.user_id = b.user_id and cb.cohort_id = ca.cohort_id
  where a.hackathon_id = tests.h5())::text, '1');
select tests.eq('matcher: nobody flagged', (select jsonb_array_length(report -> 'flagged') from matcher_first)::text, '0');

select tests.service();
select tests.ok('matcher: a second run says it already ran', (hackathon_run_matcher(tests.h5()) ->> 'already_matched')::boolean);
select tests.as_db();
select tests.ok('matcher: ...and changed nothing',
  tests.teams_snapshot(tests.h5()) = (select snap from matcher_first)
  and (select matched_at from public.hackathons where id = tests.h5()) = (select at from matcher_first));
select tests.ok('matcher: the admin log shows its teams',
  exists (select 1 from public.admin_change_log where hackathon_id = tests.h5() and area = 'team'));

create temp table matched_member as
select m.user_id, m.team_id from public.hackathon_team_members m
join public.hackathon_teams t on t.id = m.team_id
where t.hackathon_id = tests.h5() and t.is_random_matched and m.role = 'member'
order by m.user_id limit 1;
grant select on matched_member to authenticated;
select tests.become('authenticated', null);
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from matched_member), 'role', 'authenticated')::text, true);
select tests.lives('matcher: any member of a matched team can rename it', $$
  select hackathon_update_team((select team_id from matched_member), 'Our Pick') $$);
select tests.as_db();
select tests.eq('matcher: ...renamed', (select name from public.hackathon_teams where id = (select team_id from matched_member)), 'Our Pick');

-- Sprint 6: max 2, three in the pool, nowhere with room: one is flagged.
select tests.as_db();
insert into public.hackathons (id, slug, title, max_team_size, is_published,
  registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at)
values (tests.h6(), 'test-matcher-odd', 'Odd Sprint', 2, true,
  now(), now(), now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', now() + interval '4 days');
select tests.set_phase(tests.h6(), 'teams_locked');
insert into public.hackathon_registrations (hackathon_id, user_id, mode)
select tests.h6(), tests.m(i), 'random' from generate_series(11, 13) i;
select tests.service();
select tests.lives('matcher: an odd one out', $$ select hackathon_run_matcher(tests.h6()) $$);
select tests.as_db();
select tests.eq('matcher: ...is flagged, never a team of one',
  (select jsonb_array_length(match_report -> 'flagged') from public.hackathons where id = tests.h6())::text, '1');
select tests.eq('matcher: ...and stays unassigned for an admin',
  tests.count($$ select 1 from hackathon_registrations where hackathon_id = tests.h6() and team_id is null $$)::text, '1');
select tests.eq('matcher: ...while the other two are a team',
  tests.count($$ select 1 from hackathon_teams where hackathon_id = tests.h6() $$)::text, '1');

-- Sprint 7: nobody ran it before the deadline. It records that and stops.
insert into public.hackathons (id, slug, title, max_team_size, is_published,
  registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at)
values (tests.h7(), 'test-matcher-late', 'Late Sprint', 3, true,
  now(), now(), now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', now() + interval '4 days');
select tests.set_phase(tests.h7(), 'registration');
insert into public.hackathon_registrations (hackathon_id, user_id, mode) values (tests.h7(), tests.m(14), 'random');
select tests.set_phase(tests.h7(), 'judging');
select tests.service();
select tests.ok('matcher: too late, it says so', hackathon_run_matcher(tests.h7()) ? 'skipped');
select tests.as_db();
select tests.ok('matcher: ...and matched nobody',
  tests.count($$ select 1 from hackathon_teams where hackathon_id = tests.h7() $$) = 0
  and (select matched_at is not null from public.hackathons where id = tests.h7()));



-- ============================================================================
-- Phase 5 (027): the arena's pulse and members' cohorts
-- ============================================================================
select tests.as_db();
create function tests.pulse(p_team uuid) returns public.hackathon_team_pulse
language sql stable security definer set search_path = public as $$
  select * from public.hackathon_team_pulse where team_id = p_team
$$;
create function tests.team5(p_name text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.hackathon_teams where name = p_name and hackathon_id = tests.h5()
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

select tests.eq('pulse: nothing in it but counts and times', (
  select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns
  where table_schema = 'public' and table_name = 'hackathon_team_pulse'),
  'team_id,hackathon_id,activity_count,last_active_at,has_submitted,submitted_at,updated_at');
select tests.ok('pulse: in realtime, like the join queue''s tables', (
  select count(*) = 2 from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public'
    and tablename in ('hackathon_team_pulse', 'hackathon_team_join_requests')));
select tests.ok('pulse: every team has one', not exists (
  select 1 from public.hackathon_teams t where not exists (select 1 from public.hackathon_team_pulse p where p.team_id = t.id)));
select tests.ok('pulse: a new team starts quiet',
  (select activity_count = 0 and last_active_at is null and not has_submitted from tests.pulse(tests.team5('Open Door'))));

select tests.login('oscar');
select tests.eq('pulse: the arena''s audience reads it', tests.count($$ select 1 from hackathon_team_pulse where hackathon_id = tests.h5() $$)::text, '4');
select tests.throws('pulse: nobody writes it directly', $$ update hackathon_team_pulse set activity_count = 999 $$, 'permission denied');
select tests.throws('pulse: ...or adds to it', $$ insert into hackathon_team_pulse (team_id, hackathon_id) values (gen_random_uuid(), tests.h5()) $$, 'permission denied');
select tests.login('erin');
select tests.eq('pulse: a lapsed non-participant gets nothing', tests.count($$ select 1 from hackathon_team_pulse $$)::text, '0');
select tests.anon();
select tests.throws('pulse: signed out gets nothing', $$ select * from hackathon_team_pulse $$, 'permission denied');

select tests.as_db();
create temp table pulse_before as select * from public.hackathon_team_pulse where team_id = tests.team5('Open Door');
insert into public.hackathon_team_messages (team_id, user_id, body, created_at)
values (tests.team5('Open Door'), tests.m(9), 'secret plan', now() + interval '1 minute');
select tests.ok('pulse: a message moves it',
  (select p.activity_count = b.activity_count + 1 and p.last_active_at = now() + interval '1 minute'
   from tests.pulse(tests.team5('Open Door')) p, pulse_before b));
insert into public.hackathon_team_messages (team_id, user_id, body, is_system)
values (tests.team5('Open Door'), null, 'Carol added a doc', true);
update public.hackathon_team_messages set deleted_at = now() where team_id = tests.team5('Open Door') and body = 'secret plan';
select tests.eq('pulse: system lines and deletions don''t',
  (select activity_count - (select activity_count from pulse_before) from tests.pulse(tests.team5('Open Door')))::text, '1');
insert into public.hackathon_submissions (team_id, hackathon_id, project_name) values (tests.team5('Open Door'), tests.h5(), 'Secret project');
select tests.ok('pulse: a submission marks it submitted (and nothing more)',
  (select has_submitted and submitted_at is not null from tests.pulse(tests.team5('Open Door'))));

-- Members' cohorts: Sprint 5's teams are all in cohorts.
select tests.login('oscar');
select tests.eq('cohorts: the arena''s audience sees each team member''s cohort',
  tests.count($$ select 1 from hackathon_arena_cohorts(tests.h5()) $$)::text, '10');
select tests.ok('cohorts: ...by name', (select bool_and(cohort_name like 'Cohort %') from hackathon_arena_cohorts(tests.h5())));
select tests.eq('cohorts: ...and still not the cohort rosters', tests.count($$ select 1 from cohort_members where user_id = tests.m(1) $$)::text, '0');
select tests.login('erin');
select tests.eq('cohorts: nothing for a lapsed non-participant', tests.count($$ select 1 from hackathon_arena_cohorts(tests.h5()) $$)::text, '0');
select tests.anon();
select tests.throws('cohorts: signed out can''t call it', $$ select * from hackathon_arena_cohorts(tests.h5()) $$, 'permission denied');

-- ============================================================================
-- Phase 6 (028): the team room's member activity, seen and asleep
-- ============================================================================
select tests.as_db();
create function tests.h8() returns uuid language sql immutable as $$ select 'c8000000-0000-0000-0000-000000000008'::uuid $$;
create function tests.team8(p_name text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.hackathon_teams where name = p_name and hackathon_id = tests.h8()
$$;
create function tests.activity(p_team text, i integer) returns public.hackathon_team_member_activity
language sql stable security definer set search_path = public as $$
  select * from public.hackathon_team_member_activity where team_id = tests.team8(p_team) and user_id = tests.m(i)
$$;
-- Members 11–13 have no name in tests.u(), so they sign in by id.
create function tests.login_m(i integer) returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', tests.m(i), 'role', 'authenticated')::text, true);
end $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Sprint 8, live: Night Shift (m11 owns, m12) and Day Shift (m13).
insert into public.hackathons (id, slug, title, is_published,
  registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at)
values (tests.h8(), 'test-room', 'Room Sprint', true,
  now(), now(), now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', now() + interval '4 days');
select tests.set_phase(tests.h8(), 'registration');
insert into public.hackathon_registrations (hackathon_id, user_id, mode)
select tests.h8(), tests.m(i), 'team' from generate_series(11, 13) i;
select hackathon_admin_create_team(tests.h8(), 'Night Shift', array[tests.m(11), tests.m(12)]);
select hackathon_admin_create_team(tests.h8(), 'Day Shift', array[tests.m(13)]);
select tests.set_phase(tests.h8(), 'live');

select tests.eq('room activity: every team member gets a row',
  (select count(*) from public.hackathon_team_member_activity where hackathon_id = tests.h8())::text, '3');
select tests.ok('room activity: in realtime', exists (
  select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'hackathon_team_member_activity'));
select tests.ok('room activity: a new row starts quiet',
  (select last_active_at is null and last_seen_at is null and sleeping_until is null from tests.activity('Night Shift', 11)));

-- Who reads it: the team and admins only.
select tests.login_m(11);
select tests.eq('room activity: a member reads their own team''s rows',
  tests.count($$ select 1 from hackathon_team_member_activity where hackathon_id = tests.h8() $$)::text, '2');
select tests.throws('room activity: nobody writes it directly',
  $$ update hackathon_team_member_activity set last_active_at = now() $$, 'permission denied');
select tests.throws('room activity: ...or adds to it',
  $$ insert into hackathon_team_member_activity (team_id, user_id, hackathon_id) values (tests.team8('Night Shift'), tests.m(11), tests.h8()) $$, 'permission denied');
select tests.login_m(13);
select tests.eq('room activity: another team in the same Sprint sees none of it',
  tests.count($$ select 1 from hackathon_team_member_activity where team_id = tests.team8('Night Shift') $$)::text, '0');
select tests.login('oscar');
select tests.eq('room activity: a spectator sees none of it',
  tests.count($$ select 1 from hackathon_team_member_activity where hackathon_id = tests.h8() $$)::text, '0');
select tests.login('admin');
select tests.eq('room activity: an admin sees it all',
  tests.count($$ select 1 from hackathon_team_member_activity where hackathon_id = tests.h8() $$)::text, '3');
select tests.anon();
select tests.throws('room activity: signed out gets nothing',
  $$ select * from hackathon_team_member_activity $$, 'permission denied');

-- What counts as activity, and for whom.
select tests.login_m(11);
select tests.lives('room activity: a member posts', $$
  insert into hackathon_team_messages (team_id, user_id, body) values (tests.team8('Night Shift'), tests.m(11), 'kicking off') $$);
select tests.ok('room activity: a message moves the author''s row',
  (select last_active_at = now() from tests.activity('Night Shift', 11)));
select tests.ok('room activity: ...and nobody else''s',
  (select last_active_at is null from tests.activity('Night Shift', 12)));
select tests.as_db();
update public.hackathon_team_member_activity set last_active_at = now() - interval '5 hours'
where team_id = tests.team8('Night Shift') and user_id = tests.m(11);
insert into public.hackathon_team_messages (team_id, user_id, body, is_system)
values (tests.team8('Night Shift'), tests.m(11), 'Member 11 added a doc', true);
update public.hackathon_team_messages set body = 'kicking off!' where team_id = tests.team8('Night Shift') and body = 'kicking off';
select tests.ok('room activity: system lines and edits don''t count',
  (select last_active_at = now() - interval '5 hours' from tests.activity('Night Shift', 11)));

select tests.login_m(12);
select tests.lives('room activity: a member adds a doc', $$
  insert into hackathon_team_docs (team_id, title) values (tests.team8('Night Shift'), 'Plan') $$);
select tests.ok('room activity: a new doc counts for its author',
  (select last_active_at = now() from tests.activity('Night Shift', 12)));
select tests.login_m(11);
select tests.lives('room activity: a teammate edits that doc', $$
  update hackathon_team_docs set content = '{"type":"doc"}' where team_id = tests.team8('Night Shift') and title = 'Plan' $$);
select tests.ok('room activity: an edit counts for the editor',
  (select last_active_at = now() from tests.activity('Night Shift', 11)));
select tests.as_db();
update public.hackathon_team_member_activity set last_active_at = null where hackathon_id = tests.h8();
select tests.login_m(12);
select tests.lives('room activity: links, votes and ballots', $$
  insert into hackathon_team_links (team_id, url) values (tests.team8('Night Shift'), 'https://example.com') $$);
select tests.ok('room activity: a link counts', (select last_active_at = now() from tests.activity('Night Shift', 12)));
select tests.login_m(11);
insert into public.hackathon_team_votes (team_id, title, options) values (tests.team8('Night Shift'), 'Stack?', '["Next", "Rails"]');
select tests.ok('room activity: opening a vote counts', (select last_active_at = now() from tests.activity('Night Shift', 11)));
select tests.as_db();
update public.hackathon_team_member_activity set last_active_at = null where hackathon_id = tests.h8();
select tests.login_m(12);
insert into public.hackathon_team_ballots (vote_id, team_id, user_id, option_chosen)
select id, team_id, tests.m(12), 'Next' from public.hackathon_team_votes where team_id = tests.team8('Night Shift');
select tests.ok('room activity: a ballot counts', (select last_active_at = now() from tests.activity('Night Shift', 12)));

-- Seen: the room reports it, at most once a minute, with the browser's time zone.
select tests.login_m(11);
select tests.lives('seen: a member reports opening the room', $$
  select hackathon_room_seen(tests.team8('Night Shift'), 'America/New_York') $$);
select tests.ok('seen: stores when and the time zone',
  (select last_seen_at = now() and time_zone = 'America/New_York' from tests.activity('Night Shift', 11)));
select tests.lives('seen: an unknown time zone is ignored', $$
  select hackathon_room_seen(tests.team8('Night Shift'), 'Mars/Olympus_Mons') $$);
select tests.eq('seen: ...and the known one kept', (select time_zone from tests.activity('Night Shift', 11)), 'America/New_York');
select tests.as_db();
update public.hackathon_team_member_activity set last_seen_at = now() - interval '30 seconds'
where team_id = tests.team8('Night Shift') and user_id = tests.m(11);
select tests.login_m(11);
select hackathon_room_seen(tests.team8('Night Shift'));
select tests.ok('seen: not rewritten within a minute',
  (select last_seen_at = now() - interval '30 seconds' from tests.activity('Night Shift', 11)));
select tests.as_db();
update public.hackathon_team_member_activity set last_seen_at = now() - interval '2 minutes'
where team_id = tests.team8('Night Shift') and user_id = tests.m(11);
select tests.login_m(11);
select hackathon_room_seen(tests.team8('Night Shift'));
select tests.ok('seen: rewritten after a minute', (select last_seen_at = now() from tests.activity('Night Shift', 11)));
select tests.login_m(13);
select tests.throws('seen: not for another team''s room', $$ select hackathon_room_seen(tests.team8('Night Shift')) $$, 'team''s members');
select tests.login('admin');
select tests.throws('seen: not for an admin reading the room', $$ select hackathon_room_seen(tests.team8('Night Shift')) $$, 'team''s members');
select tests.anon();
select tests.throws('seen: signed out can''t call it', $$ select hackathon_room_seen(tests.team8('Night Shift')) $$, 'permission denied');

-- Asleep: "Sleeping until…", up to 12 hours; doing something wakes them.
select tests.login_m(12);
select tests.lives('sleep: a member says they''re sleeping', $$
  select hackathon_room_sleep(tests.team8('Night Shift'), now() + interval '8 hours') $$);
select tests.ok('sleep: stored', (select sleeping_until = now() + interval '8 hours' from tests.activity('Night Shift', 12)));
select tests.throws('sleep: not more than 12 hours', $$
  select hackathon_room_sleep(tests.team8('Night Shift'), now() + interval '13 hours') $$, '12 hours');
select tests.throws('sleep: not in the past', $$
  select hackathon_room_sleep(tests.team8('Night Shift'), now() - interval '1 hour') $$, '12 hours');
insert into public.hackathon_team_messages (team_id, user_id, body) values (tests.team8('Night Shift'), tests.m(12), 'up early');
select tests.ok('sleep: posting wakes them', (select sleeping_until is null from tests.activity('Night Shift', 12)));
select hackathon_room_sleep(tests.team8('Night Shift'), now() + interval '2 hours');
select hackathon_room_sleep(tests.team8('Night Shift'), null);
select tests.ok('sleep: waking early keeps when they woke',
  (select sleeping_until = now() from tests.activity('Night Shift', 12)));
select tests.login_m(13);
select tests.throws('sleep: not on another team', $$
  select hackathon_room_sleep(tests.team8('Night Shift'), now() + interval '1 hour') $$, 'team''s members');

-- Rows follow membership.
select tests.service();
select hackathon_admin_move_member(tests.m(12), tests.team8('Day Shift'));
select tests.as_db();
select tests.ok('room activity: moving teams moves the row',
  (select count(*) = 0 from public.hackathon_team_member_activity where team_id = tests.team8('Night Shift') and user_id = tests.m(12))
  and (select count(*) = 1 from public.hackathon_team_member_activity where team_id = tests.team8('Day Shift') and user_id = tests.m(12)));
select tests.login_m(13);
select tests.eq('room activity: the new team sees the newcomer',
  tests.count($$ select 1 from hackathon_team_member_activity where team_id = tests.team8('Day Shift') $$)::text, '2');
select tests.login_m(12);
select tests.eq('room activity: ...who no longer sees the old team''s',
  tests.count($$ select 1 from hackathon_team_member_activity where team_id = tests.team8('Night Shift') $$)::text, '0');

-- After the reveal: the room is read-only, so no more sleeping; reading stays.
select tests.set_phase(tests.h8(), 'judging');
select tests.login_m(11);
select tests.lives('room: still writable while judging (decision 12, kept in Phase 6)', $$
  insert into hackathon_team_messages (team_id, user_id, body) values (tests.team8('Night Shift'), tests.m(11), 'waiting on results') $$);
select tests.set_phase(tests.h8(), 'revealed');
select tests.login_m(11);
select tests.throws('room: read-only after the reveal', $$
  insert into hackathon_team_messages (team_id, user_id, body) values (tests.team8('Night Shift'), tests.m(11), 'too late') $$, 'row-level security');
select tests.throws('sleep: not once the room is read-only', $$
  select hackathon_room_sleep(tests.team8('Night Shift'), now() + interval '1 hour') $$, 'read-only');
select tests.ok('room: members still read it after the reveal',
  tests.count($$ select 1 from hackathon_team_messages where team_id = tests.team8('Night Shift') $$) >= 2
  and tests.count($$ select 1 from hackathon_team_member_activity where team_id = tests.team8('Night Shift') $$) = 1);


-- ============================================================================
-- Phase 7 (029): the lobby's welcome note, milestones, limits, moderation log
-- ============================================================================
select tests.as_db();
create function tests.h9() returns uuid language sql immutable as $$ select 'c9000000-0000-0000-0000-000000000009'::uuid $$;
create function tests.h10() returns uuid language sql immutable as $$ select 'ca000000-0000-0000-0000-00000000000a'::uuid $$;
create function tests.milestones(p_hackathon uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(string_agg(system_key, ',' order by created_at), '')
  from public.hackathon_lobby_messages where hackathon_id = p_hackathon and system_key is not null
$$;
create function tests.lobby9(p_body text) returns public.hackathon_lobby_messages
language sql stable security definer set search_path = public as $$
  select * from public.hackathon_lobby_messages where hackathon_id = tests.h9() and body = p_body
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Sprint 9: m11 and m12 registered (no teams needed for the lobby).
insert into public.hackathons (id, slug, title, theme_hidden, is_published,
  registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at)
values (tests.h9(), 'test-lobby', 'Lobby Sprint', 'Tools for night owls', true,
  now(), now(), now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', now() + interval '4 days');
select tests.set_phase(tests.h9(), 'registration');
insert into public.hackathon_registrations (hackathon_id, user_id, mode)
select tests.h9(), tests.m(i), 'random' from generate_series(11, 12) i;

-- The welcome note.
select tests.ok('welcome: every new Sprint gets the default note',
  (select lobby_welcome like 'This is the lobby for everyone in the Sprint%' from public.hackathons where id = tests.h9()));
select tests.login_m(11);
select tests.ok('welcome: a participant reads it', hackathon_lobby_welcome(tests.h9()) like 'This is the lobby%');
select tests.throws('welcome: not on the public columns', $$ select lobby_welcome from public.hackathons $$, 'permission denied');
select tests.login('oscar');
select tests.ok('welcome: a spectator gets nothing', hackathon_lobby_welcome(tests.h9()) is null);
select tests.anon();
select tests.throws('welcome: signed out can''t call it', $$ select hackathon_lobby_welcome(tests.h9()) $$, 'permission denied');
select tests.as_db();
update public.hackathons set lobby_welcome = 'Be kind. No spoilers.' where id = tests.h9();
select tests.service();
create temp table dup9 as select hackathon_admin_duplicate(tests.h9()) as id;
select tests.as_db();
select tests.eq('welcome: Duplicate copies it',
  (select lobby_welcome from public.hackathons where id = (select id from dup9)), 'Be kind. No spoilers.');
select tests.throws('welcome: at most 1,000 characters',
  $$ update public.hackathons set lobby_welcome = repeat('x', 1001) where id = tests.h9() $$, 'hackathons_lobby_welcome_length');

-- Milestones: each once, on the Sprint's own clock.
select tests.service();
select tests.eq('milestones: nothing during registration', hackathon_post_lobby_milestones(tests.h9())::text, '0');
select tests.set_phase(tests.h9(), 'teams_locked');
select tests.service();
select tests.eq('milestones: teams locked', hackathon_post_lobby_milestones(tests.h9())::text, '1');
select tests.eq('milestones: ...exactly once', hackathon_post_lobby_milestones(tests.h9())::text, '0');
select tests.ok('milestones: dated at the milestone, not when posted', (
  select m.created_at = h.team_lock_at from public.hackathon_lobby_messages m join public.hackathons h on h.id = m.hackathon_id
  where m.hackathon_id = tests.h9() and m.system_key = 'teams_locked'));
select tests.ok('milestones: posted as the system', (
  select is_system and user_id is null from public.hackathon_lobby_messages where hackathon_id = tests.h9() and system_key = 'teams_locked'));
select tests.set_phase(tests.h9(), 'live');
select tests.service();
select hackathon_post_lobby_milestones(tests.h9());
select tests.ok('milestones: kickoff names the theme', exists (
  select 1 from public.hackathon_lobby_messages where hackathon_id = tests.h9() and system_key = 'live'
    and body = 'Sprint is LIVE — the theme is: Tools for night owls. Go build!'));
select tests.eq('milestones: no "1 hour left" with 47 hours to go', tests.milestones(tests.h9()), 'teams_locked,live');
select tests.as_db();
update public.hackathons set ends_at = now() + interval '40 minutes' where id = tests.h9();
select tests.service();
select hackathon_post_lobby_milestones(tests.h9());
select tests.eq('milestones: 1 hour left', tests.milestones(tests.h9()), 'teams_locked,live,one_hour_left');

-- Paused: the Sprint's clock stops, so nothing new is due.
select tests.as_db();
select tests.pause(tests.h9(), now() - interval '1 minute');
update public.hackathons set ends_at = now() - interval '30 seconds', judging_ends_at = now() + interval '1 day',
  reveal_at = now() + interval '2 days' where id = tests.h9();
select tests.service();
select tests.eq('milestones: nothing while paused (its clock stopped before the deadline)',
  hackathon_post_lobby_milestones(tests.h9())::text, '0');
select tests.as_db();
select tests.clear_override(tests.h9());
select tests.service();
select hackathon_post_lobby_milestones(tests.h9());
select tests.eq('milestones: submissions locked once it resumes', tests.milestones(tests.h9()),
  'teams_locked,live,one_hour_left,submissions_locked');
-- An admin extends the deadline: the announcements that aren't true any more go.
select tests.service();
update public.hackathons set ends_at = now() + interval '3 hours' where id = tests.h9();
select tests.eq('milestones: extending the deadline withdraws "locked" and "1 hour left"', tests.milestones(tests.h9()), 'teams_locked,live');
select tests.as_db();
select tests.ok('milestones: the withdrawal is in the change log, saying why', exists (
  select 1 from public.admin_change_log where hackathon_id = tests.h9() and action = 'delete'
    and actor = 'Sprint times moved' and summary = 'Withdrew a milestone message whose time moved'));
select set_config('hackathon.actor', 'Keaton in the SQL editor', true);
update public.hackathons set ends_at = ends_at + interval '1 minute' where id = tests.h9();
select tests.eq('milestones: ...and an admin''s own SQL-editor name is put back', current_setting('hackathon.actor', true), 'Keaton in the SQL editor');
select set_config('hackathon.actor', '', true);
select tests.as_db();
update public.hackathons set ends_at = now() - interval '1 minute' where id = tests.h9();
select tests.service();
select hackathon_post_lobby_milestones(tests.h9());
select tests.eq('milestones: ...and "locked" posts again at the new deadline', tests.milestones(tests.h9()),
  'teams_locked,live,submissions_locked');
select tests.set_phase(tests.h9(), 'revealed');
select tests.service();
select hackathon_post_lobby_milestones(tests.h9());
select tests.ok('milestones: results are in, and still one of each', (
  select count(*) = 4 and count(distinct system_key) = 4 from public.hackathon_lobby_messages
  where hackathon_id = tests.h9() and system_key is not null));
select tests.eq('milestones: the redone timeline, one of each', (
  select string_agg(system_key, ',' order by system_key) from public.hackathon_lobby_messages
  where hackathon_id = tests.h9() and system_key is not null), 'live,results,submissions_locked,teams_locked');

-- A Sprint first looked at after its deadline: no late "1 hour left".
select tests.as_db();
insert into public.hackathons (id, slug, title, is_published,
  registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at)
values (tests.h10(), 'test-lobby-late', 'Late Sprint', true,
  now(), now(), now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', now() + interval '4 days');
select tests.set_phase(tests.h10(), 'judging');
select tests.service();
select hackathon_post_lobby_milestones(tests.h10());
select tests.eq('milestones: "1 hour left" is skipped when it''s too late', tests.milestones(tests.h10()),
  'teams_locked,live,submissions_locked');
select tests.as_db();
select tests.pause(tests.h10(), now(), 'cancelled');
update public.hackathons set reveal_at = now() - interval '1 second', judging_ends_at = now() - interval '2 seconds' where id = tests.h10();
select tests.service();
select tests.eq('milestones: none once cancelled', hackathon_post_lobby_milestones(tests.h10())::text, '0');
select tests.login_m(11);
select tests.throws('milestones: members can''t post them', $$ select hackathon_post_lobby_milestones(tests.h9()) $$, 'permission denied');

-- Members' posts: keys, length, pace.
select tests.set_phase(tests.h9(), 'live');
select tests.login_m(11);
select tests.lives('lobby: a participant posts', $$
  insert into hackathon_lobby_messages (hackathon_id, user_id, body, system_key, is_system)
  values (tests.h9(), tests.m(11), 'hello lobby', 'results', true) $$);
select tests.ok('lobby: ...and can''t make it a system or milestone message',
  (select not is_system and system_key is null from tests.lobby9('hello lobby')));
select tests.lives('lobby: 1,000 characters is fine', $$
  insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h9(), tests.m(11), repeat('a', 1000)) $$);
select tests.throws('lobby: 1,001 is too long', $$
  insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h9(), tests.m(11), repeat('a', 1001)) $$, '1,000 characters');
select tests.lives('lobby: three more quick ones', $$
  insert into hackathon_lobby_messages (hackathon_id, user_id, body) values
    (tests.h9(), tests.m(11), 'two'), (tests.h9(), tests.m(11), 'three'), (tests.h9(), tests.m(11), 'four') $$);
select tests.throws('lobby: a sixth inside 15 seconds is refused', $$
  insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h9(), tests.m(11), 'six') $$, 'posting fast');
select tests.login_m(12);
select tests.lives('lobby: the limit is per person', $$
  insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h9(), tests.m(12), 'hi from m12') $$);
select tests.as_db();
update public.hackathon_lobby_messages set created_at = now() - interval '1 minute'
where hackathon_id = tests.h9() and user_id = tests.m(11);
select tests.login_m(11);
select tests.lives('lobby: fine again once it has calmed down', $$
  insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h9(), tests.m(11), 'later') $$);
select tests.as_db();
insert into public.hackathon_lobby_messages (hackathon_id, user_id, body, created_at)
select tests.h9(), tests.m(12), 'old ' || i, now() - interval '2 minutes' from generate_series(1, 29) i;
select tests.login_m(12);
select tests.throws('lobby: 30 in 5 minutes is the ceiling', $$
  insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h9(), tests.m(12), 'one too many') $$, 'posting fast');
select tests.login('admin');
select tests.lives('lobby: admins aren''t limited', $$
  insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h9(), tests.u('admin'), repeat('!', 1500)) $$);

-- Who reads and writes: unchanged from 019, checked again here.
select tests.login('oscar');
select tests.eq('lobby: a spectator reads nothing', tests.count($$ select 1 from hackathon_lobby_messages where hackathon_id = tests.h9() $$)::text, '0');
select tests.throws('lobby: ...and can''t post', $$
  insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h9(), tests.u('oscar'), 'let me in') $$, 'row-level security');
select tests.as_db();
select tests.pause(tests.h9(), now());
select tests.login_m(12);
select tests.as_db();
update public.hackathon_lobby_messages set created_at = now() - interval '10 minutes' where hackathon_id = tests.h9() and user_id = tests.m(12);
select tests.login_m(12);
select tests.lives('lobby: still open while paused (decision 9, kept in Phase 7)', $$
  insert into hackathon_lobby_messages (hackathon_id, user_id, body) values (tests.h9(), tests.m(12), 'paused chat') $$);
select tests.as_db();
select tests.clear_override(tests.h9());

-- Moderation from the lobby page is logged.
select set_config('request.headers', '{}', true);
select tests.login('admin');
select tests.eq('moderation: an admin pins from the lobby', tests.affected($$
  update hackathon_lobby_messages set is_pinned = true where hackathon_id = tests.h9() and body = 'hello lobby' $$)::text, '1');
select tests.as_db();
select tests.ok('moderation: ...and it''s in the change log, naming them', exists (
  select 1 from public.admin_change_log
  where area = 'lobby' and hackathon_id = tests.h9() and summary = 'Pinned a lobby message' and actor like '% (in the lobby)'));
select tests.login('admin');
select tests.lives('moderation: an admin deletes someone''s message', $$
  update hackathon_lobby_messages set deleted_at = now() where hackathon_id = tests.h9() and body = 'hi from m12' $$);
select tests.as_db();
select tests.ok('moderation: the deletion is logged too', exists (
  select 1 from public.admin_change_log where hackathon_id = tests.h9() and summary = 'Deleted a lobby message'));
select tests.login_m(12);
update hackathon_lobby_messages set is_pinned = true where hackathon_id = tests.h9() and body = 'paused chat';
select tests.ok('moderation: a member can''t pin', (select not is_pinned from tests.lobby9('paused chat')));
select tests.as_db();
select tests.eq('moderation: members'' own actions aren''t logged',
  (select count(*) from public.admin_change_log where hackathon_id = tests.h9() and actor like '% (in the lobby)')::text, '2');


-- Who's who: the tag beside each name.
select tests.as_db();
select hackathon_admin_create_team(tests.h9(), 'Lobby Larks', array[tests.m(11)]);
select tests.login_m(12);
select tests.eq('people: a participant sees a teammate''s team',
  (select team_name from hackathon_lobby_people(tests.h9()) where user_id = tests.m(11)), 'Lobby Larks');
select tests.eq('people: someone without a team has none',
  (select coalesce(team_name, '-') || '/' || role from hackathon_lobby_people(tests.h9()) where user_id = tests.m(12)), '-/participant');
select tests.eq('people: an admin who posted is tagged admin',
  (select role from hackathon_lobby_people(tests.h9()) where user_id = tests.u('admin')), 'admin');
select tests.login('oscar');
select tests.eq('people: a spectator gets nobody', tests.count($$ select 1 from hackathon_lobby_people(tests.h9()) $$)::text, '0');
select tests.anon();
select tests.throws('people: signed out can''t call it', $$ select * from hackathon_lobby_people(tests.h9()) $$, 'permission denied');

select tests.finish();
