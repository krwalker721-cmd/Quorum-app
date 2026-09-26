-- ---------------------------------------------------------------------------
-- 022 — Admin controls for Sprints, and the countdowns
--
--  1. Draft Sprints may leave their dates empty ("Duplicate Sprint" clears
--     them). A Sprint can't be published until all six are set and in order.
--     Every access rule already checks is_published first, so a dateless draft
--     opens nothing. The slug defaults to sprint-<number>.
--  2. Per-Sprint countdown switches (in app / on landing) and an optional
--     headline. A Sprint countdown always counts to the Sprint's real
--     timestamps; there is deliberately no separate target to drift.
--  3. A per-team size override, so the admin can let one team go over
--     max_team_size on purpose. Members still can't.
--  4. Judges can be invited by email before they have an account (the
--     account is linked later).
--  5. site_countdowns: standalone countdowns such as the launch. Enabled rows
--     are public, signed out included, minus who last edited them. Only admins
--     write.
--  6. admin_change_log: every change an admin makes to Sprints, countdowns,
--     teams, members, registrations, judges and lobby messages, with who,
--     what (old → new) and when. Written by triggers, so the SQL editor is
--     caught too; changes that come from a member's own action are not
--     logged. Append-only.
--  7. Admin-only functions for the admin console: shift a Sprint's
--     timeline (extend the deadline, push a countdown back), move a member,
--     merge teams, create a team, duplicate a Sprint.
--
-- Who: admin routes send the signed-in admin's name and id in the
-- x-quorum-actor / x-quorum-actor-id headers and a note in x-quorum-action.
-- From the SQL editor, set hackathon.actor / hackathon.action instead:
--   select set_config('hackathon.actor', 'Keaton', true);
--
-- RUN AFTER 021. Idempotent.
-- ---------------------------------------------------------------------------

-- ============================================================================
-- 1. Draft Sprints without dates
-- ============================================================================
alter table public.hackathons alter column registration_opens_at drop not null;
alter table public.hackathons alter column team_lock_at drop not null;
alter table public.hackathons alter column starts_at drop not null;
alter table public.hackathons alter column ends_at drop not null;
alter table public.hackathons alter column judging_ends_at drop not null;
alter table public.hackathons alter column reveal_at drop not null;

-- The ordering check already lets missing dates through (a comparison with
-- NULL isn't false) while still rejecting dates that are set and out of order.
alter table public.hackathons drop constraint if exists hackathons_published_has_dates;
alter table public.hackathons add constraint hackathons_published_has_dates check (
  not is_published or (
    registration_opens_at is not null and team_lock_at is not null and starts_at is not null
    and ends_at is not null and judging_ends_at is not null and reveal_at is not null
  )
);

create or replace function private.hackathons_before_write()
returns trigger language plpgsql set search_path = public as $$
declare
  n integer := 1;
begin
  if tg_op = 'INSERT' then
    if new.number is null then
      perform pg_advisory_xact_lock(hashtext('public.hackathons.number'));
      select coalesce(max(h.number), 0) + 1 into new.number from public.hackathons h;
    end if;
    if nullif(btrim(new.slug), '') is null then
      new.slug := 'sprint-' || new.number::text;
      while exists (select 1 from public.hackathons h where h.slug = new.slug) loop
        n := n + 1;
        new.slug := 'sprint-' || new.number::text || '-' || n::text;
      end loop;
    end if;
  else
    new.id := old.id;
    new.number := coalesce(new.number, old.number);
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  if new.status_override is null then
    new.status_override_at := null;
  elsif tg_op = 'INSERT' or old.status_override is null then
    new.status_override_at := coalesce(new.status_override_at, now());
  else
    new.status_override_at := old.status_override_at;
  end if;
  return new;
end $$;

-- ============================================================================
-- 2. Per-Sprint countdown switches
-- ============================================================================
alter table public.hackathons add column if not exists show_countdown_in_app boolean not null default true;
alter table public.hackathons add column if not exists show_countdown_on_landing boolean not null default true;
alter table public.hackathons add column if not exists countdown_headline_override text
  check (countdown_headline_override is null or char_length(countdown_headline_override) <= 120);

grant select (show_countdown_in_app, show_countdown_on_landing, countdown_headline_override)
  on public.hackathons to anon, authenticated;

-- Same view as 018, with the three new columns appended.
create or replace view public.hackathon_overview with (security_invoker = true) as
select
  h.id, h.number, h.slug, h.title, h.tagline, h.rules,
  h.registration_opens_at, h.team_lock_at, h.starts_at, h.ends_at,
  h.judging_ends_at, h.reveal_at, h.lobby_closes_at,
  h.max_team_size, h.min_team_size,
  h.status_override, h.status_override_at, h.is_published,
  h.created_at, h.updated_at,
  case
    when not h.is_published then 'draft'
    when h.status_override is not null then h.status_override
    else private.hackathon_phase_at(
      h.registration_opens_at, h.team_lock_at, h.starts_at, h.ends_at, h.reveal_at, now())
  end as state,
  case
    when not h.is_published then 'draft'
    else private.hackathon_phase_at(
      h.registration_opens_at, h.team_lock_at, h.starts_at, h.ends_at, h.reveal_at,
      private.hackathon_clock(h.status_override_at, now()))
  end as phase,
  private.hackathon_theme(h.id) as theme,
  h.show_countdown_in_app,
  h.show_countdown_on_landing,
  h.countdown_headline_override
from public.hackathons h;

-- ============================================================================
-- 3. Per-team size override
-- ============================================================================
alter table public.hackathon_teams add column if not exists max_size_override integer
  check (max_size_override is null or max_size_override between 1 and 50);

create or replace function private.hackathon_team_members_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_hackathon uuid;
  v_max integer;
  v_count integer;
begin
  if tg_op = 'UPDATE' then
    if new.team_id is distinct from old.team_id
      or new.user_id is distinct from old.user_id
      or new.hackathon_id is distinct from old.hackathon_id then
      raise exception 'Move people between teams by leaving and joining.';
    end if;
    new.joined_at := old.joined_at;
    return new;
  end if;

  select t.hackathon_id, coalesce(t.max_size_override, h.max_team_size) into v_hackathon, v_max
  from public.hackathon_teams t
  join public.hackathons h on h.id = t.hackathon_id
  where t.id = new.team_id
  for update of t;

  if v_hackathon is null then
    raise exception 'That team doesn''t exist.';
  end if;
  new.hackathon_id := v_hackathon;
  new.joined_at := now();

  if not private.is_participant(v_hackathon, new.user_id) then
    raise exception 'Only people registered for this Sprint can join a team.' using hint = 'not_registered';
  end if;

  select count(*) into v_count from public.hackathon_team_members m where m.team_id = new.team_id;
  if v_count >= v_max then
    raise exception 'This team is full (% of %).', v_count, v_max using hint = 'team_full';
  end if;
  return new;
end $$;

-- ============================================================================
-- 4. Judges invited by email
-- ============================================================================
alter table public.hackathon_judges alter column user_id drop not null;
alter table public.hackathon_judges add column if not exists invite_email text
  check (invite_email is null or invite_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
alter table public.hackathon_judges drop constraint if exists hackathon_judges_who;
alter table public.hackathon_judges add constraint hackathon_judges_who
  check (user_id is not null or invite_email is not null);
create unique index if not exists hackathon_judges_email_unique
  on public.hackathon_judges (hackathon_id, lower(invite_email)) where invite_email is not null;

create or replace function private.hackathon_judges_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.hackathon_id := old.hackathon_id;
    new.invited_at := old.invited_at;
    -- An email invite may be linked to an account later; an account can't
    -- be swapped for another.
    if old.user_id is not null then
      new.user_id := old.user_id;
    end if;
  end if;
  new.invite_email := lower(nullif(btrim(new.invite_email), ''));
  if new.user_id is not null and private.is_participant(new.hackathon_id, new.user_id) then
    raise exception 'This person is registered for this Sprint. Remove their registration before making them a judge.'
      using errcode = 'check_violation', hint = 'participant_cannot_judge';
  end if;
  return new;
end $$;

-- ============================================================================
-- 5. site_countdowns
-- ============================================================================
create table if not exists public.site_countdowns (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(key) <= 40),
  label           text not null check (char_length(btrim(label)) between 1 and 120),
  subtext         text check (subtext is null or char_length(subtext) <= 300),
  target_at       timestamptz not null,
  is_enabled      boolean not null default false,
  show_on_landing boolean not null default true,
  show_in_app     boolean not null default false,
  zero_behavior   text not null default 'hide' check (zero_behavior in ('hide', 'show_message')),
  zero_message    text check (zero_message is null or char_length(zero_message) <= 200),
  cta_label       text check (cta_label is null or char_length(btrim(cta_label)) between 1 and 40),
  cta_url         text check (cta_url is null or (cta_url ~* '^(https?://|/)[^[:space:]]*$' and char_length(cta_url) <= 500)),
  -- The countdown to opening the doors. Reaching zero changes nothing by
  -- itself; the admin panel warns if its time has passed while signups are
  -- still waitlist-only.
  is_launch       boolean not null default false,
  updated_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint site_countdowns_zero_message check (zero_behavior <> 'show_message' or zero_message is not null),
  constraint site_countdowns_cta_pair check ((cta_label is null) = (cta_url is null))
);

create or replace function private.site_countdowns_before_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  -- A signed-in admin writing directly is the editor; a server route passes
  -- its admin in x-quorum-actor-id.
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists site_countdowns_before_write_trigger on public.site_countdowns;
create trigger site_countdowns_before_write_trigger
  before insert or update on public.site_countdowns
  for each row execute function private.site_countdowns_before_write();

alter table public.site_countdowns enable row level security;

-- Anyone may read the public fields of an enabled countdown; admins see all.
revoke all on public.site_countdowns from anon, authenticated;
grant select (
  id, key, label, subtext, target_at, is_enabled, show_on_landing, show_in_app,
  zero_behavior, zero_message, cta_label, cta_url, is_launch, created_at, updated_at
) on public.site_countdowns to anon, authenticated;
grant insert, update, delete on public.site_countdowns to authenticated;

drop policy if exists "site_countdowns_read_enabled" on public.site_countdowns;
create policy "site_countdowns_read_enabled"
  on public.site_countdowns for select to anon, authenticated
  using (is_enabled or private.is_admin(auth.uid()));

drop policy if exists "site_countdowns_admin_insert" on public.site_countdowns;
create policy "site_countdowns_admin_insert"
  on public.site_countdowns for insert to authenticated
  with check (private.is_admin(auth.uid()));

drop policy if exists "site_countdowns_admin_update" on public.site_countdowns;
create policy "site_countdowns_admin_update"
  on public.site_countdowns for update to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "site_countdowns_admin_delete" on public.site_countdowns;
create policy "site_countdowns_admin_delete"
  on public.site_countdowns for delete to authenticated
  using (private.is_admin(auth.uid()));

-- ============================================================================
-- 6. admin_change_log
-- ============================================================================
create table if not exists public.admin_change_log (
  id           bigint generated always as identity primary key,
  area         text not null check (area in ('sprint', 'countdown', 'team', 'member', 'registration', 'judge', 'lobby')),
  table_name   text not null,
  row_id       text not null,
  -- No foreign key: the history outlives a deleted Sprint.
  hackathon_id uuid,
  action       text not null check (action in ('insert', 'update', 'delete')),
  -- What the admin set out to do, e.g. "Merged Comets into Rockets".
  summary      text,
  -- What changed, in words: "Sprint #2 · Night Owls", "Team Rockets".
  subject      text not null,
  -- {"field": {"old": …, "new": …}} for every field that changed.
  changes      jsonb not null,
  actor        text not null,
  actor_id     uuid,
  db_role      text not null,
  created_at   timestamptz not null default now()
);
create index if not exists admin_change_log_created_idx on public.admin_change_log (created_at desc);
create index if not exists admin_change_log_hackathon_idx on public.admin_change_log (hackathon_id, created_at desc);
create index if not exists admin_change_log_area_idx on public.admin_change_log (area, created_at desc);

alter table public.admin_change_log enable row level security;
revoke insert, update, delete, truncate on public.admin_change_log from anon, authenticated, service_role;

drop policy if exists "admin_change_log_read_admins" on public.admin_change_log;
create policy "admin_change_log_read_admins"
  on public.admin_change_log for select to authenticated
  using (private.is_admin(auth.uid()));

create or replace function private.admin_change_log_append_only()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'The admin change log is append-only.';
end $$;

drop trigger if exists admin_change_log_append_only_trigger on public.admin_change_log;
create trigger admin_change_log_append_only_trigger
  before update or delete on public.admin_change_log
  for each row execute function private.admin_change_log_append_only();

-- The caller's claimed headers (PostgREST puts request headers here). Only
-- ever consulted for requests that aren't a member's own, i.e. from the
-- service role, which never runs in a browser.
create or replace function private.request_header(p_name text)
returns text language plpgsql stable as $$
begin
  return nullif(btrim(nullif(current_setting('request.headers', true), '')::jsonb ->> p_name), '');
exception when others then
  return null;
end $$;

create or replace function private.write_admin_change(
  p_table text,
  p_action text,
  p_old jsonb,
  p_new jsonb,
  p_role text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  r jsonb := coalesce(p_new, p_old);
  v_area text;
  v_subject text;
  v_hackathon uuid;
  v_changes jsonb;
  v_actor_id uuid;
  v_actor text;
  v_name text;
begin
  select coalesce(jsonb_object_agg(k, jsonb_build_object('old', p_old -> k, 'new', p_new -> k)), '{}'::jsonb)
  into v_changes
  from jsonb_object_keys(r) as k
  where k not in ('updated_at', 'created_at')
    and (p_old -> k) is distinct from (p_new -> k);

  if p_action = 'update' and v_changes = '{}'::jsonb then
    return;
  end if;

  if p_table = 'hackathons' then
    v_area := 'sprint';
    v_hackathon := (r ->> 'id')::uuid;
    v_subject := 'Sprint #' || coalesce(r ->> 'number', '?') || ' · ' || coalesce(r ->> 'title', '');
  elsif p_table = 'site_countdowns' then
    v_area := 'countdown';
    v_subject := 'Countdown "' || coalesce(r ->> 'key', '?') || '"';
  else
    v_hackathon := (r ->> 'hackathon_id')::uuid;
    if p_table = 'hackathon_teams' then
      v_area := 'team';
      v_subject := 'Team ' || coalesce(r ->> 'name', '?');
    elsif p_table = 'hackathon_team_members' then
      v_area := 'member';
      select coalesce(nullif(btrim(p.full_name), ''), p.username, 'Someone') into v_name
      from public.profiles p where p.id = (r ->> 'user_id')::uuid;
      v_subject := coalesce(v_name, 'Someone') || ' on team '
        || coalesce((select t.name from public.hackathon_teams t where t.id = (r ->> 'team_id')::uuid), '(deleted team)');
    elsif p_table = 'hackathon_registrations' then
      v_area := 'registration';
      select coalesce(nullif(btrim(p.full_name), ''), p.username, 'Someone') into v_name
      from public.profiles p where p.id = (r ->> 'user_id')::uuid;
      v_subject := coalesce(v_name, 'Someone') || '''s registration';
    elsif p_table = 'hackathon_judges' then
      v_area := 'judge';
      select coalesce(nullif(btrim(p.full_name), ''), p.username) into v_name
      from public.profiles p where p.id = (r ->> 'user_id')::uuid;
      v_subject := 'Judge ' || coalesce(v_name, r ->> 'invite_email', '?');
    else
      v_area := 'lobby';
      select coalesce(nullif(btrim(p.full_name), ''), p.username) into v_name
      from public.profiles p where p.id = (r ->> 'user_id')::uuid;
      v_subject := 'Lobby message from ' || coalesce(v_name, 'the system');
    end if;
  end if;

  if v_hackathon is not null then
    v_subject := v_subject || coalesce(
      (select ' (Sprint #' || h.number || ')' from public.hackathons h where h.id = v_hackathon and p_table <> 'hackathons'),
      '');
  end if;

  begin
    v_actor_id := private.request_header('x-quorum-actor-id')::uuid;
  exception when others then
    v_actor_id := null;
  end;
  -- An admin signed in to the app and writing directly is who they are.
  v_actor_id := coalesce(v_actor_id, auth.uid());
  v_actor := coalesce(
    nullif(btrim(current_setting('hackathon.actor', true)), ''),
    private.request_header('x-quorum-actor'),
    (select coalesce(nullif(btrim(p.full_name), ''), p.username) from public.profiles p where p.id = auth.uid()),
    case p_role when 'service_role' then 'admin console' else 'database (' || p_role || ')' end
  );

  insert into public.admin_change_log
    (area, table_name, row_id, hackathon_id, action, summary, subject, changes, actor, actor_id, db_role)
  values (
    v_area, p_table, coalesce(r ->> 'id', '?'), v_hackathon, p_action,
    left(coalesce(nullif(btrim(current_setting('hackathon.action', true)), ''), private.request_header('x-quorum-action')), 300),
    left(v_subject, 300), v_changes, left(v_actor, 200), v_actor_id, p_role
  );
end $$;

-- Not SECURITY DEFINER, so current_user is the real caller. A member's own
-- request (anon / authenticated), including everything the database does on
-- its behalf, isn't an admin change and isn't logged. The exception is
-- site_countdowns: only admins can write it, so every change is an admin's.
create or replace function private.log_admin_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name <> 'site_countdowns'
    and (coalesce(auth.role(), '') in ('anon', 'authenticated')
         or current_user in ('anon', 'authenticated')) then
    return null;
  end if;
  -- Lobby: only moderation (edits, pins, deletions), not system notices.
  if tg_table_name = 'hackathon_lobby_messages' and tg_op = 'INSERT' then
    return null;
  end if;
  perform private.write_admin_change(
    tg_table_name,
    lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    current_user::text
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'hackathons', 'site_countdowns', 'hackathon_teams', 'hackathon_team_members',
    'hackathon_registrations', 'hackathon_judges', 'hackathon_lobby_messages'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_admin_log_trigger', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function private.log_admin_change()',
      t || '_admin_log_trigger', t);
  end loop;
end $$;

-- ============================================================================
-- Ballots: an admin merge moves ballots between teams even on closed votes
-- ============================================================================
create or replace function private.hackathon_team_ballots_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v public.hackathon_team_votes%rowtype;
  member_request boolean := coalesce(auth.role(), '') in ('anon', 'authenticated');
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.vote_id := old.vote_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  new.updated_at := now();

  select * into v from public.hackathon_team_votes where id = new.vote_id;
  if not found then
    raise exception 'That vote doesn''t exist.';
  end if;
  new.team_id := v.team_id;
  if not member_request then
    return new;
  end if;
  if v.status <> 'open' then
    raise exception 'This vote is closed.' using hint = 'vote_closed';
  end if;
  if not jsonb_exists(v.options, new.option_chosen) then
    raise exception 'That isn''t one of the options.' using hint = 'bad_option';
  end if;
  return new;
end $$;

-- Docs: a member can't move a doc to another team, but an admin merge can.
create or replace function private.hackathon_team_docs_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if current_user in ('anon', 'authenticated') then
      new.team_id := old.team_id;
    end if;
  end if;
  new.updated_at := now();
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
      new.created_at := now();
    end if;
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

-- ============================================================================
-- 7. Admin functions (service role only: the admin console's server routes)
-- ============================================================================

-- Move a milestone and every later one by p_minutes (> 0), so the order
-- always holds. The deadline extension is shift from 'ends_at'; "push this
-- countdown back" is shift from whichever milestone it counts to. The lobby's
-- closing time moves too if it falls at or after the milestone. Refused once
-- the Sprint has been revealed.
create or replace function public.hackathon_admin_shift(
  p_hackathon_id uuid,
  p_from text,
  p_minutes integer
)
returns public.hackathons language plpgsql security definer set search_path = public as $$
declare
  h public.hackathons%rowtype;
  milestones constant text[] := array['registration_opens_at', 'team_lock_at', 'starts_at', 'ends_at', 'judging_ends_at', 'reveal_at'];
  i integer := array_position(milestones, p_from);
  d interval := make_interval(mins => p_minutes);
  pivot timestamptz;
begin
  if i is null then
    raise exception 'Unknown milestone "%".', p_from;
  end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 60 * 24 * 60 then
    raise exception 'Shift by between 1 minute and 60 days.';
  end if;

  select * into h from public.hackathons where id = p_hackathon_id for update;
  if not found then
    raise exception 'That Sprint doesn''t exist.';
  end if;
  if h.reveal_at is not null and now() >= h.reveal_at then
    raise exception 'This Sprint has already been revealed; its times can''t move.';
  end if;

  pivot := case p_from
    when 'registration_opens_at' then h.registration_opens_at
    when 'team_lock_at' then h.team_lock_at
    when 'starts_at' then h.starts_at
    when 'ends_at' then h.ends_at
    when 'judging_ends_at' then h.judging_ends_at
    else h.reveal_at
  end;
  if pivot is null then
    raise exception 'This Sprint has no % yet.', replace(p_from, '_', ' ');
  end if;

  update public.hackathons set
    registration_opens_at = case when i <= 1 then registration_opens_at + d else registration_opens_at end,
    team_lock_at          = case when i <= 2 then team_lock_at + d else team_lock_at end,
    starts_at             = case when i <= 3 then starts_at + d else starts_at end,
    ends_at               = case when i <= 4 then ends_at + d else ends_at end,
    judging_ends_at       = case when i <= 5 then judging_ends_at + d else judging_ends_at end,
    reveal_at             = reveal_at + d,
    lobby_closes_at       = case when lobby_closes_at >= pivot then lobby_closes_at + d else lobby_closes_at end
  where id = p_hackathon_id
  returning * into h;
  return h;
end $$;

-- Move someone onto another team in the same Sprint (off their current one,
-- if any). p_raise_limit lets the destination go over its size limit on
-- purpose, by setting that team's override to fit.
create or replace function public.hackathon_admin_move_member(
  p_user_id uuid,
  p_to_team uuid,
  p_raise_limit boolean default false
)
returns void language plpgsql security definer set search_path = public as $$
declare
  t public.hackathon_teams%rowtype;
  v_limit integer;
  v_count integer;
begin
  select * into t from public.hackathon_teams where id = p_to_team for update;
  if not found then
    raise exception 'That team doesn''t exist.';
  end if;
  if exists (select 1 from public.hackathon_team_members m where m.team_id = p_to_team and m.user_id = p_user_id) then
    raise exception 'They''re already on that team.';
  end if;

  select coalesce(t.max_size_override, h.max_team_size) into v_limit from public.hackathons h where h.id = t.hackathon_id;
  select count(*) into v_count from public.hackathon_team_members m where m.team_id = p_to_team;
  if v_count >= v_limit then
    if not coalesce(p_raise_limit, false) then
      raise exception 'Team % is full (% of %). Override the limit to add them anyway.', t.name, v_count, v_limit
        using hint = 'team_full';
    end if;
    update public.hackathon_teams set max_size_override = v_count + 1 where id = p_to_team;
  end if;

  delete from public.hackathon_team_members m where m.hackathon_id = t.hackathon_id and m.user_id = p_user_id;
  insert into public.hackathon_team_members (team_id, user_id, role)
  values (p_to_team, p_user_id, case when v_count = 0 then 'owner' else 'member' end);
end $$;

-- Fold p_source into p_target: its room (thread, docs, links, votes) and its
-- members move, then the source team is deleted. Refused if the source has a
-- submission (merge the other way round instead), since its screenshots live
-- in the source team's storage folder.
create or replace function public.hackathon_admin_merge_teams(
  p_source uuid,
  p_target uuid,
  p_raise_limit boolean default false
)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.hackathon_teams%rowtype;
  t public.hackathon_teams%rowtype;
  v_limit integer;
  v_total integer;
  m record;
begin
  if p_source = p_target then
    raise exception 'Pick two different teams.';
  end if;
  select * into s from public.hackathon_teams where id = p_source for update;
  select * into t from public.hackathon_teams where id = p_target for update;
  if s.id is null or t.id is null then
    raise exception 'That team doesn''t exist.';
  end if;
  if s.hackathon_id <> t.hackathon_id then
    raise exception 'Both teams must be in the same Sprint.';
  end if;
  if exists (select 1 from public.hackathon_submissions x where x.team_id = p_source) then
    raise exception 'Team % has a submission. Merge % into % instead.', s.name, t.name, s.name
      using hint = 'source_has_submission';
  end if;

  select coalesce(t.max_size_override, h.max_team_size) into v_limit from public.hackathons h where h.id = t.hackathon_id;
  select count(*) into v_total from public.hackathon_team_members x where x.team_id in (p_source, p_target);
  if v_total > v_limit then
    if not coalesce(p_raise_limit, false) then
      raise exception 'Together they''d have % members; the limit is %. Override the limit to merge anyway.', v_total, v_limit
        using hint = 'team_full';
    end if;
    update public.hackathon_teams set max_size_override = v_total where id = p_target;
  end if;

  update public.hackathon_team_messages set team_id = p_target where team_id = p_source;
  update public.hackathon_team_docs set team_id = p_target where team_id = p_source;
  update public.hackathon_team_links set team_id = p_target where team_id = p_source;
  update public.hackathon_team_votes set team_id = p_target where team_id = p_source;
  update public.hackathon_team_ballots set team_id = p_target where team_id = p_source;

  for m in
    select user_id from public.hackathon_team_members where team_id = p_source order by joined_at
  loop
    delete from public.hackathon_team_members where team_id = p_source and user_id = m.user_id;
    insert into public.hackathon_team_members (team_id, user_id, role) values (p_target, m.user_id, 'member');
  end loop;

  delete from public.hackathon_teams where id = p_source;
end $$;

-- Create a team by hand. The first member listed becomes its owner. Members
-- must be registered and not already on a team (move them instead).
create or replace function public.hackathon_admin_create_team(
  p_hackathon_id uuid,
  p_name text,
  p_member_ids uuid[] default '{}',
  p_raise_limit boolean default false
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_team uuid;
  v_limit integer;
  u uuid;
  n integer := 0;
begin
  select max_team_size into v_limit from public.hackathons where id = p_hackathon_id;
  if v_limit is null then
    raise exception 'That Sprint doesn''t exist.';
  end if;
  if cardinality(p_member_ids) > v_limit and not coalesce(p_raise_limit, false) then
    raise exception '% members is over the limit of %. Override the limit to create it anyway.', cardinality(p_member_ids), v_limit
      using hint = 'team_full';
  end if;

  begin
    insert into public.hackathon_teams (hackathon_id, name, max_size_override)
    values (p_hackathon_id, p_name, case when cardinality(p_member_ids) > v_limit then cardinality(p_member_ids) end)
    returning id into v_team;
  exception when unique_violation then
    raise exception 'A team called "%" already exists in this Sprint.', btrim(p_name) using hint = 'name_taken';
  end;

  foreach u in array coalesce(p_member_ids, '{}') loop
    n := n + 1;
    begin
      insert into public.hackathon_team_members (team_id, user_id, role)
      values (v_team, u, case when n = 1 then 'owner' else 'member' end);
    exception when unique_violation then
      raise exception 'One of them is already on a team. Move them instead.' using hint = 'on_a_team';
    end;
  end loop;
  return v_team;
end $$;

-- A new draft from an earlier Sprint's settings: next number, no dates, no
-- theme (each Sprint needs its own), unpublished.
create or replace function public.hackathon_admin_duplicate(p_hackathon_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  h public.hackathons%rowtype;
  v_id uuid;
begin
  select * into h from public.hackathons where id = p_hackathon_id;
  if not found then
    raise exception 'That Sprint doesn''t exist.';
  end if;
  insert into public.hackathons (
    title, tagline, rules, max_team_size, min_team_size,
    show_countdown_in_app, show_countdown_on_landing, countdown_headline_override
  ) values (
    h.title, h.tagline, h.rules, h.max_team_size, h.min_team_size,
    h.show_countdown_in_app, h.show_countdown_on_landing, h.countdown_headline_override
  )
  returning id into v_id;
  return v_id;
end $$;

-- ============================================================================
-- Grants
-- ============================================================================
grant execute on all functions in schema private to anon, authenticated, service_role;

revoke execute on function public.hackathon_admin_shift(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.hackathon_admin_move_member(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.hackathon_admin_merge_teams(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.hackathon_admin_create_team(uuid, text, uuid[], boolean) from public, anon, authenticated;
revoke execute on function public.hackathon_admin_duplicate(uuid) from public, anon, authenticated;
grant execute on function public.hackathon_admin_shift(uuid, text, integer) to service_role;
grant execute on function public.hackathon_admin_move_member(uuid, uuid, boolean) to service_role;
grant execute on function public.hackathon_admin_merge_teams(uuid, uuid, boolean) to service_role;
grant execute on function public.hackathon_admin_create_team(uuid, text, uuid[], boolean) to service_role;
grant execute on function public.hackathon_admin_duplicate(uuid) to service_role;
