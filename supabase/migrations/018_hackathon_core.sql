-- ---------------------------------------------------------------------------
-- 018 — Hackathon ("Sprint") core
--
-- A Sprint is a network-wide 48-hour build. The admin creates each one by hand;
-- there can be none, one, or many, so nothing here is tied to a single event.
--
-- This file: access helpers, the Sprint itself and its derived state,
-- registrations, teams, team membership, join requests and judges.
-- 019 adds the team rooms and the lobby; 020 adds submissions, screenshots,
-- scores, awards and the arena's activity pulse.
--
-- Design rules every part follows:
--
--  * State is DERIVED from the timestamps and now(), never stored, so no job
--    has to run for a Sprint to move from registration to live to revealed.
--  * Pausing or cancelling freezes the Sprint's clock at the moment it
--    happened (status_override_at). Visibility is computed at that frozen
--    moment: a Sprint paused before kickoff keeps its theme hidden, one paused
--    before the reveal stays sealed. Writes stop entirely while frozen (the
--    lobby is the one exception, in 019).
--  * Helpers that take a user id live in the `private` schema. The API only
--    exposes `public`, so nobody can call is_active_member(someone_else) to
--    learn whether that person pays. Policies can still use them.
--  * Guard triggers tell a member's request from a server one by current_user:
--    requests from the app run as `anon` or `authenticated`; the service role
--    (admin console), the SQL editor and SECURITY DEFINER functions do not.
--    So the rules bind members, and the admin console can still correct data.
--    The guard functions are deliberately NOT security definer, since that
--    would change current_user.
--  * Team membership only changes through the SECURITY DEFINER functions at
--    the end of this file. There is no insert policy on team members, so
--    nobody can add themselves to a team the way project_members allows.
--
-- RUN BEFORE 019 and 020, and before deploying any code that reads these
-- tables. Idempotent: safe to run again.
-- ---------------------------------------------------------------------------

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- ============================================================================
-- Access helpers that don't depend on the hackathon tables
-- ============================================================================

create or replace function private.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = uid), false)
$$;

-- Mirrors computeEntitlement() in lib/entitlements.ts: an approved account
-- that is paid (active / trialing / past_due with a member or partner tier on
-- either row) or inside an open card-free trial. It can't ask Stripe the way
-- the app can when local state looks wrong, so it trusts what the webhook last
-- wrote to `subscriptions`.
create or replace function private.is_active_member(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.status = 'approved' and (
      (
        coalesce(s.status, 'trialing') in ('active', 'trialing', 'past_due')
        and (coalesce(s.tier, '') in ('member', 'partner') or coalesce(p.tier, '') in ('member', 'partner'))
      )
      or (
        coalesce(s.status, 'trialing') = 'trialing'
        and coalesce(coalesce(p.trial_ends_at, s.trial_ends_at) > now(), false)
      )
    )
    from public.profiles p
    left join public.subscriptions s on s.user_id = p.id
    where p.id = uid
  ), false)
$$;

-- ============================================================================
-- hackathons — one row per Sprint
-- ============================================================================
create table if not exists public.hackathons (
  id                    uuid primary key default gen_random_uuid(),
  number                integer not null unique,
  slug                  text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title                 text not null check (char_length(btrim(title)) between 1 and 120),
  tagline               text check (tagline is null or char_length(tagline) <= 200),
  -- The prompt. Never readable through the API directly: see the column
  -- grants below and private.hackathon_theme().
  theme_hidden          text,
  rules                 text,
  registration_opens_at timestamptz not null,
  team_lock_at          timestamptz not null,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  judging_ends_at       timestamptz not null,
  reveal_at             timestamptz not null,
  -- null = the lobby stays open after the event
  lobby_closes_at       timestamptz,
  max_team_size         integer not null default 4 check (max_team_size between 1 and 12),
  min_team_size         integer not null default 1 check (min_team_size >= 1),
  status_override       text check (status_override in ('paused', 'cancelled')),
  -- When the Sprint was frozen. Kept when a pause turns into a cancel, so the
  -- frozen moment is the first one.
  status_override_at    timestamptz,
  is_published          boolean not null default false,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint hackathons_timeline_order check (
    registration_opens_at <= team_lock_at
    and team_lock_at <= starts_at
    and starts_at < ends_at
    and ends_at <= judging_ends_at
    and judging_ends_at <= reveal_at
  ),
  constraint hackathons_lobby_after_open check (
    lobby_closes_at is null or lobby_closes_at >= registration_opens_at
  ),
  constraint hackathons_team_size_order check (min_team_size <= max_team_size),
  constraint hackathons_override_stamped check ((status_override is null) = (status_override_at is null))
);

-- Numbers come from max + 1 under a lock rather than a sequence: a sequence
-- skips a number on every rolled-back insert (the test run is exactly that),
-- and "Sprint #3" as the first event would be wrong. The unique constraint is
-- the final guard.
create or replace function private.hackathons_before_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.number is null then
      perform pg_advisory_xact_lock(hashtext('public.hackathons.number'));
      select coalesce(max(h.number), 0) + 1 into new.number from public.hackathons h;
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

drop trigger if exists hackathons_before_write_trigger on public.hackathons;
create trigger hackathons_before_write_trigger
  before insert or update on public.hackathons
  for each row execute function private.hackathons_before_write();

alter table public.hackathons enable row level security;

-- Column-level read access: everything except theme_hidden. RLS can only hide
-- rows, so the theme is protected by privileges instead: a query that names
-- theme_hidden (or selects *) is refused outright for anon and authenticated.
-- The app reads Sprints through public.hackathon_overview. Writes come only
-- from the admin console (service role), so nothing else is granted.
revoke all on public.hackathons from anon, authenticated;
grant select (
  id, number, slug, title, tagline, rules,
  registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at,
  lobby_closes_at, max_team_size, min_team_size, status_override, status_override_at,
  is_published, created_by, created_at, updated_at
) on public.hackathons to anon, authenticated;

-- Published Sprints are public: the landing-page countdown reads them signed
-- out. Hiding them from signed-in lapsed members would protect nothing, since
-- they could read them signed out.
drop policy if exists "hackathons_read_published" on public.hackathons;
create policy "hackathons_read_published"
  on public.hackathons for select to anon, authenticated
  using (is_published or private.is_admin(auth.uid()));

-- ============================================================================
-- Derived state
-- ============================================================================

-- The phase at a given moment, from the timestamps alone.
create or replace function private.hackathon_phase_at(
  p_registration_opens_at timestamptz,
  p_team_lock_at timestamptz,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reveal_at timestamptz,
  p_at timestamptz
)
returns text language sql immutable as $$
  select case
    when p_at < p_registration_opens_at then 'upcoming'
    when p_at < p_team_lock_at then 'registration'
    when p_at < p_starts_at then 'teams_locked'
    when p_at < p_ends_at then 'live'
    when p_at < p_reveal_at then 'judging'
    else 'revealed'
  end
$$;

-- A frozen Sprint's clock stops at the moment it was frozen.
create or replace function private.hackathon_clock(p_status_override_at timestamptz, p_at timestamptz)
returns timestamptz language sql immutable as $$
  select case when p_status_override_at is null then p_at else least(p_at, p_status_override_at) end
$$;

-- The state a person sees: draft / paused / cancelled, or the phase at p_at.
-- Security invoker, so it only answers for Sprints the caller can see (a
-- draft reads as NULL to anyone but an admin). From the SQL editor, fake any
-- moment with:  select hackathon_state_at('<id>', '2026-10-10 12:00Z');
create or replace function public.hackathon_state_at(p_hackathon_id uuid, p_at timestamptz)
returns text language sql stable set search_path = public as $$
  select case
    when not h.is_published then 'draft'
    when h.status_override is not null then h.status_override
    else private.hackathon_phase_at(
      h.registration_opens_at, h.team_lock_at, h.starts_at, h.ends_at, h.reveal_at, p_at)
  end
  from public.hackathons h
  where h.id = p_hackathon_id
$$;

create or replace function public.hackathon_state(p_hackathon_id uuid)
returns text language sql stable set search_path = public as $$
  select public.hackathon_state_at(p_hackathon_id, now())
$$;

-- The effective phase the access rules use: the phase on the Sprint's own
-- (possibly frozen) clock, or 'draft'. NULL for a Sprint that doesn't exist.
create or replace function private.hackathon_phase(p_hackathon_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when not h.is_published then 'draft'
    else private.hackathon_phase_at(
      h.registration_opens_at, h.team_lock_at, h.starts_at, h.ends_at, h.reveal_at,
      private.hackathon_clock(h.status_override_at, now()))
  end
  from public.hackathons h
  where h.id = p_hackathon_id
$$;

-- Published and neither paused nor cancelled: member writes may happen.
create or replace function private.hackathon_writable(p_hackathon_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select h.is_published and h.status_override is null
    from public.hackathons h where h.id = p_hackathon_id
  ), false)
$$;

-- The theme, once the Sprint has (on its own clock) kicked off. A Sprint
-- paused or cancelled before kickoff keeps it hidden; one paused mid-event
-- keeps showing it. Admins always see it.
create or replace function private.hackathon_theme(p_hackathon_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when private.is_admin(auth.uid()) then h.theme_hidden
    when h.is_published
      and private.hackathon_phase_at(
        h.registration_opens_at, h.team_lock_at, h.starts_at, h.ends_at, h.reveal_at,
        private.hackathon_clock(h.status_override_at, now())) in ('live', 'judging', 'revealed')
      then h.theme_hidden
  end
  from public.hackathons h
  where h.id = p_hackathon_id
$$;

-- What the app reads. security_invoker, so the table's RLS and column grants
-- still apply to whoever is asking. `state` is what to show; `phase` is where
-- the (possibly frozen) clock stands, e.g. 'live' for a Sprint paused mid-event.
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
  private.hackathon_theme(h.id) as theme
from public.hackathons h;

revoke all on public.hackathon_overview from anon, authenticated;
grant select on public.hackathon_overview to anon, authenticated;

-- The database clock, for the countdowns' client-server offset. The database
-- is what enforces every deadline, so its clock is the one to match.
create or replace function public.server_now()
returns timestamptz language sql stable as $$ select now() $$;

-- ============================================================================
-- Teams, registrations, membership, join requests, judges
-- ============================================================================
create table if not exists public.hackathon_teams (
  id                  uuid primary key default gen_random_uuid(),
  hackathon_id        uuid not null references public.hackathons(id) on delete cascade,
  name                text not null check (char_length(btrim(name)) between 2 and 40),
  slug                text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- For the arena graphic: a short glyph or icon key, and a hex colour.
  emblem              text check (emblem is null or char_length(emblem) <= 16),
  color               text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  created_by          uuid references public.profiles(id) on delete set null,
  is_random_matched   boolean not null default false,
  is_open_to_requests boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (hackathon_id, slug),
  -- Target for the composite foreign keys that pin a row to its team's Sprint.
  unique (id, hackathon_id)
);

create unique index if not exists hackathon_teams_name_unique
  on public.hackathon_teams (hackathon_id, lower(btrim(name)));

create table if not exists public.hackathon_registrations (
  id            uuid primary key default gen_random_uuid(),
  hackathon_id  uuid not null references public.hackathons(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  mode          text not null default 'random' check (mode in ('random', 'team')),
  -- Kept in step with hackathon_team_members by trigger; not client-writable.
  team_id       uuid references public.hackathon_teams(id) on delete set null,
  checked_in_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  withdrawn_at  timestamptz,
  unique (hackathon_id, user_id)
);

create index if not exists hackathon_registrations_user_idx
  on public.hackathon_registrations (user_id);

create table if not exists public.hackathon_team_members (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null,
  -- Copied from the team (by trigger) so "one team per Sprint" can be a plain
  -- unique constraint. The composite key keeps it honest.
  hackathon_id uuid not null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  foreign key (team_id, hackathon_id)
    references public.hackathon_teams (id, hackathon_id) on delete cascade,
  unique (hackathon_id, user_id),
  unique (team_id, user_id)
);

create unique index if not exists hackathon_team_members_one_owner
  on public.hackathon_team_members (team_id) where role = 'owner';
create index if not exists hackathon_team_members_user_idx
  on public.hackathon_team_members (user_id);

create table if not exists public.hackathon_team_join_requests (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null,
  hackathon_id uuid not null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  message      text check (message is null or char_length(message) <= 500),
  -- 'cancelled': withdrawn by the requester, or closed because they joined a
  -- team or withdrew from the Sprint. A cancelled request can be sent again;
  -- a declined one can't.
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  foreign key (team_id, hackathon_id)
    references public.hackathon_teams (id, hackathon_id) on delete cascade,
  unique (team_id, user_id)
);

create index if not exists hackathon_join_requests_user_idx
  on public.hackathon_team_join_requests (user_id);

create table if not exists public.hackathon_judges (
  id           uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  invited_at   timestamptz not null default now(),
  -- Only a judge who has accepted gets a judge's access.
  accepted_at  timestamptz,
  unique (hackathon_id, user_id)
);

-- ============================================================================
-- Membership helpers (private: they take a user id)
-- ============================================================================

create or replace function private.is_participant(p_hackathon_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hackathon_registrations r
    where r.hackathon_id = p_hackathon_id and r.user_id = uid and r.withdrawn_at is null
  )
$$;

create or replace function private.is_team_member(p_team_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hackathon_team_members m
    where m.team_id = p_team_id and m.user_id = uid
  )
$$;

create or replace function private.is_team_owner(p_team_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hackathon_team_members m
    where m.team_id = p_team_id and m.user_id = uid and m.role = 'owner'
  )
$$;

-- An accepted judge: the judge's access.
create or replace function private.is_judge(p_hackathon_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hackathon_judges j
    where j.hackathon_id = p_hackathon_id and j.user_id = uid and j.accepted_at is not null
  )
$$;

-- Any judge row, accepted or not: enough to rule out competing.
create or replace function private.is_invited_judge(p_hackathon_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hackathon_judges j
    where j.hackathon_id = p_hackathon_id and j.user_id = uid
  )
$$;

create or replace function private.team_hackathon_id(p_team_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select t.hackathon_id from public.hackathon_teams t where t.id = p_team_id
$$;

-- Who may look at the arena (teams, rosters, activity). Not secret, but not
-- public either: members, this Sprint's participants and judges, and admins.
-- Participants and judges are listed separately so a trial that lapses
-- mid-Sprint doesn't lock anyone out of their own event.
create or replace function private.can_view_arena(p_hackathon_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select private.is_admin(uid)
    or (
      coalesce((select h.is_published from public.hackathons h where h.id = p_hackathon_id), false)
      and (
        private.is_active_member(uid)
        or private.is_participant(p_hackathon_id, uid)
        or private.is_judge(p_hackathon_id, uid)
      )
    )
$$;

-- Raises unless teams may change right now (registration is open and the
-- Sprint isn't frozen). Used by every team function below.
create or replace function private.require_team_window(p_hackathon_id uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not private.hackathon_writable(p_hackathon_id) then
    raise exception 'This Sprint is paused or not open.' using hint = 'sprint_frozen';
  end if;
  if private.hackathon_phase(p_hackathon_id) is distinct from 'registration' then
    raise exception 'Teams can only change while registration is open.' using hint = 'teams_locked';
  end if;
end $$;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Registrations: members register and withdraw themselves; the rest of the
-- row is the system's.
create or replace function private.hackathon_registrations_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  self_service boolean := current_user in ('anon', 'authenticated');
  v_phase text;
  v_writable boolean;
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.hackathon_id := old.hackathon_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();

  -- Judges can't compete. Binds everyone, the admin console included.
  if new.withdrawn_at is null and private.is_invited_judge(new.hackathon_id, new.user_id) then
    raise exception 'A judge of this Sprint can''t also register for it.'
      using errcode = 'check_violation', hint = 'judge_cannot_register';
  end if;

  if not self_service then
    return new;
  end if;

  v_phase := private.hackathon_phase(new.hackathon_id);
  v_writable := private.hackathon_writable(new.hackathon_id);

  if tg_op = 'INSERT' then
    new.team_id := null;
    new.checked_in_at := null;
    new.withdrawn_at := null;
    new.created_at := now();
    if not (v_writable and v_phase = 'registration') then
      raise exception 'Registration for this Sprint isn''t open.' using hint = 'registration_closed';
    end if;
    if not private.is_active_member(new.user_id) then
      raise exception 'Only active members (free trials included) can register.' using hint = 'not_active_member';
    end if;
    return new;
  end if;

  -- UPDATE by the member: mode and withdrawn_at are theirs; the rest isn't.
  new.team_id := old.team_id;
  new.checked_in_at := old.checked_in_at;

  if old.withdrawn_at is not null and new.withdrawn_at is null then
    -- Coming back: the same rules as registering.
    if not (v_writable and v_phase = 'registration') then
      raise exception 'Registration for this Sprint isn''t open.' using hint = 'registration_closed';
    end if;
    if not private.is_active_member(new.user_id) then
      raise exception 'Only active members (free trials included) can register.' using hint = 'not_active_member';
    end if;
  elsif old.withdrawn_at is null and new.withdrawn_at is not null then
    if not (v_writable and v_phase in ('registration', 'teams_locked')) then
      raise exception 'You can withdraw until kickoff.' using hint = 'withdraw_closed';
    end if;
    new.withdrawn_at := now();
  elsif old.withdrawn_at is not null then
    raise exception 'You''ve withdrawn from this Sprint. Register again first.' using hint = 'withdrawn';
  end if;

  if new.mode is distinct from old.mode then
    if not (v_writable and v_phase = 'registration') then
      raise exception 'You can only switch between the random pool and a team while registration is open.'
        using hint = 'registration_closed';
    end if;
    if new.mode = 'random' and old.team_id is not null then
      raise exception 'Leave your team before joining the random pool.' using hint = 'on_a_team';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists hackathon_registrations_guard_trigger on public.hackathon_registrations;
create trigger hackathon_registrations_guard_trigger
  before insert or update on public.hackathon_registrations
  for each row execute function private.hackathon_registrations_guard();

-- Leaving the Sprint (withdrawing, or an admin deleting the registration)
-- takes the person off their team and closes their open join requests.
create or replace function private.hackathon_registrations_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r public.hackathon_registrations%rowtype;
begin
  if tg_op = 'DELETE' then
    r := old;
  elsif old.withdrawn_at is null and new.withdrawn_at is not null then
    r := new;
  else
    return null;
  end if;

  delete from public.hackathon_team_members m
  where m.hackathon_id = r.hackathon_id and m.user_id = r.user_id;

  update public.hackathon_team_join_requests q
  set status = 'cancelled', responded_at = now()
  where q.hackathon_id = r.hackathon_id and q.user_id = r.user_id and q.status = 'pending';
  return null;
end $$;

drop trigger if exists hackathon_registrations_after_trigger on public.hackathon_registrations;
create trigger hackathon_registrations_after_trigger
  after update or delete on public.hackathon_registrations
  for each row execute function private.hackathon_registrations_after();

-- Teams: the slug comes from the name, unique within the Sprint.
create or replace function private.hackathon_teams_before_write()
returns trigger language plpgsql set search_path = public as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  new.name := btrim(new.name);
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.hackathon_id := old.hackathon_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  if tg_op = 'INSERT' or new.name is distinct from old.name then
    base := trim(both '-' from lower(regexp_replace(new.name, '[^a-zA-Z0-9]+', '-', 'g')));
    if base = '' then base := 'team'; end if;
    base := left(base, 40);
    candidate := base;
    while exists (
      select 1 from public.hackathon_teams t
      where t.hackathon_id = new.hackathon_id and t.slug = candidate and t.id <> new.id
    ) loop
      n := n + 1;
      candidate := base || '-' || n::text;
    end loop;
    new.slug := candidate;
  else
    new.slug := old.slug;
  end if;
  return new;
end $$;

drop trigger if exists hackathon_teams_before_write_trigger on public.hackathon_teams;
create trigger hackathon_teams_before_write_trigger
  before insert or update on public.hackathon_teams
  for each row execute function private.hackathon_teams_before_write();

-- Team members: the invariants that hold for every caller, admin included.
--  * the person is registered for this Sprint (and so is not one of its judges)
--  * the team isn't full. The team row is locked first, so two people taking
--    the last seat at the same moment are served one after the other and the
--    second is refused.
--  * one team per Sprint is the unique (hackathon_id, user_id) constraint.
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

  select t.hackathon_id, h.max_team_size into v_hackathon, v_max
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

drop trigger if exists hackathon_team_members_before_write_trigger on public.hackathon_team_members;
create trigger hackathon_team_members_before_write_trigger
  before insert or update on public.hackathon_team_members
  for each row execute function private.hackathon_team_members_before_write();

create or replace function private.hackathon_team_members_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_next uuid;
begin
  if tg_op = 'INSERT' then
    update public.hackathon_registrations r
    set team_id = new.team_id
    where r.hackathon_id = new.hackathon_id and r.user_id = new.user_id;

    -- Joined a team: any other open requests are moot.
    update public.hackathon_team_join_requests q
    set status = 'cancelled', responded_at = now()
    where q.hackathon_id = new.hackathon_id and q.user_id = new.user_id
      and q.status = 'pending' and q.team_id <> new.team_id;
    return null;
  end if;

  -- DELETE
  update public.hackathon_registrations r
  set team_id = null
  where r.hackathon_id = old.hackathon_id and r.user_id = old.user_id and r.team_id = old.team_id;

  -- The team itself is being deleted: nothing left to tidy.
  if not exists (select 1 from public.hackathon_teams t where t.id = old.team_id) then
    return null;
  end if;

  if old.role = 'owner' then
    select m.id into v_next
    from public.hackathon_team_members m
    where m.team_id = old.team_id
    order by m.joined_at, m.id
    limit 1;
    if v_next is not null then
      update public.hackathon_team_members set role = 'owner' where id = v_next;
    end if;
  end if;

  -- An empty team disappears, but only before kickoff; after that its room
  -- and submission are part of the record and an admin decides.
  if not exists (select 1 from public.hackathon_team_members m where m.team_id = old.team_id)
    and private.hackathon_phase(old.hackathon_id) in ('draft', 'upcoming', 'registration', 'teams_locked') then
    delete from public.hackathon_teams t where t.id = old.team_id;
  end if;
  return null;
end $$;

drop trigger if exists hackathon_team_members_after_trigger on public.hackathon_team_members;
create trigger hackathon_team_members_after_trigger
  after insert or delete on public.hackathon_team_members
  for each row execute function private.hackathon_team_members_after();

-- Judges: the other half of "judges can't compete". Binds the admin console
-- too, which shows the message and asks for the registration to go first.
create or replace function private.hackathon_judges_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.hackathon_id := old.hackathon_id;
    new.user_id := old.user_id;
    new.invited_at := old.invited_at;
  end if;
  if private.is_participant(new.hackathon_id, new.user_id) then
    raise exception 'This person is registered for this Sprint. Remove their registration before making them a judge.'
      using errcode = 'check_violation', hint = 'participant_cannot_judge';
  end if;
  return new;
end $$;

drop trigger if exists hackathon_judges_before_write_trigger on public.hackathon_judges;
create trigger hackathon_judges_before_write_trigger
  before insert or update on public.hackathon_judges
  for each row execute function private.hackathon_judges_before_write();

-- ============================================================================
-- Row level security
-- ============================================================================
alter table public.hackathon_teams enable row level security;
alter table public.hackathon_registrations enable row level security;
alter table public.hackathon_team_members enable row level security;
alter table public.hackathon_team_join_requests enable row level security;
alter table public.hackathon_judges enable row level security;

-- Teams and rosters are what the arena draws. Not secret; not public either.
drop policy if exists "hackathon_teams_read_arena" on public.hackathon_teams;
create policy "hackathon_teams_read_arena"
  on public.hackathon_teams for select to authenticated
  using (private.can_view_arena(hackathon_id, auth.uid()));

drop policy if exists "hackathon_team_members_read_arena" on public.hackathon_team_members;
create policy "hackathon_team_members_read_arena"
  on public.hackathon_team_members for select to authenticated
  using (private.can_view_arena(hackathon_id, auth.uid()));
-- No insert / update / delete policies: membership changes only through the
-- functions below.

-- Participants see who else is in; everyone sees their own row, withdrawn or not.
drop policy if exists "hackathon_registrations_read" on public.hackathon_registrations;
create policy "hackathon_registrations_read"
  on public.hackathon_registrations for select to authenticated
  using (
    user_id = auth.uid()
    or private.is_participant(hackathon_id, auth.uid())
    or private.is_admin(auth.uid())
  );

-- Registering, switching mode and withdrawing are the member's own; the guard
-- trigger enforces when each is allowed.
drop policy if exists "hackathon_registrations_insert_own" on public.hackathon_registrations;
create policy "hackathon_registrations_insert_own"
  on public.hackathon_registrations for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "hackathon_registrations_update_own" on public.hackathon_registrations;
create policy "hackathon_registrations_update_own"
  on public.hackathon_registrations for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "hackathon_join_requests_read" on public.hackathon_team_join_requests;
create policy "hackathon_join_requests_read"
  on public.hackathon_team_join_requests for select to authenticated
  using (
    user_id = auth.uid()
    or private.is_team_member(team_id, auth.uid())
    or private.is_admin(auth.uid())
  );

drop policy if exists "hackathon_judges_read_own" on public.hackathon_judges;
create policy "hackathon_judges_read_own"
  on public.hackathon_judges for select to authenticated
  using (user_id = auth.uid() or private.is_admin(auth.uid()));

-- ============================================================================
-- Team functions — the only way membership changes
-- ============================================================================

create or replace function public.hackathon_create_team(
  p_hackathon_id uuid,
  p_name text,
  p_emblem text default null,
  p_color text default null,
  p_open_to_requests boolean default true
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_team uuid;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  perform private.require_team_window(p_hackathon_id);
  if not private.is_participant(p_hackathon_id, uid) then
    raise exception 'Register for this Sprint first.' using hint = 'not_registered';
  end if;
  if exists (
    select 1 from public.hackathon_team_members m
    where m.hackathon_id = p_hackathon_id and m.user_id = uid
  ) then
    raise exception 'You''re already on a team for this Sprint.' using hint = 'on_a_team';
  end if;

  begin
    insert into public.hackathon_teams (hackathon_id, name, emblem, color, created_by, is_open_to_requests)
    values (p_hackathon_id, p_name, p_emblem, p_color, uid, coalesce(p_open_to_requests, true))
    returning id into v_team;
  exception when unique_violation then
    raise exception 'A team called "%" already exists in this Sprint.', btrim(p_name) using hint = 'name_taken';
  end;

  insert into public.hackathon_team_members (team_id, user_id, role) values (v_team, uid, 'owner');
  update public.hackathon_registrations r
  set mode = 'team'
  where r.hackathon_id = p_hackathon_id and r.user_id = uid;
  return v_team;
end $$;

-- Owner only. Null arguments leave a field as it is. Allowed until kickoff.
create or replace function public.hackathon_update_team(
  p_team_id uuid,
  p_name text default null,
  p_emblem text default null,
  p_color text default null,
  p_open_to_requests boolean default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_hackathon uuid := private.team_hackathon_id(p_team_id);
begin
  if not private.is_team_owner(p_team_id, uid) then
    raise exception 'Only the team owner can change the team.' using errcode = '42501';
  end if;
  if not private.hackathon_writable(v_hackathon)
    or private.hackathon_phase(v_hackathon) not in ('registration', 'teams_locked') then
    raise exception 'Teams can be edited until kickoff.' using hint = 'teams_locked';
  end if;
  begin
    update public.hackathon_teams t set
      name = coalesce(p_name, t.name),
      emblem = coalesce(p_emblem, t.emblem),
      color = coalesce(p_color, t.color),
      is_open_to_requests = coalesce(p_open_to_requests, t.is_open_to_requests)
    where t.id = p_team_id;
  exception when unique_violation then
    raise exception 'A team called "%" already exists in this Sprint.', btrim(p_name) using hint = 'name_taken';
  end;
end $$;

create or replace function public.hackathon_request_to_join(p_team_id uuid, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_hackathon uuid := private.team_hackathon_id(p_team_id);
  v_request uuid;
begin
  if v_hackathon is null then
    raise exception 'That team doesn''t exist.';
  end if;
  perform private.require_team_window(v_hackathon);
  if not private.is_participant(v_hackathon, uid) then
    raise exception 'Register for this Sprint first.' using hint = 'not_registered';
  end if;
  if exists (
    select 1 from public.hackathon_team_members m
    where m.hackathon_id = v_hackathon and m.user_id = uid
  ) then
    raise exception 'You''re already on a team for this Sprint.' using hint = 'on_a_team';
  end if;
  if not (select t.is_open_to_requests from public.hackathon_teams t where t.id = p_team_id) then
    raise exception 'This team isn''t taking requests.' using hint = 'team_closed';
  end if;

  insert into public.hackathon_team_join_requests (team_id, hackathon_id, user_id, message)
  values (p_team_id, v_hackathon, uid, nullif(btrim(p_message), ''))
  on conflict (team_id, user_id) do update
    set status = 'pending', message = excluded.message, created_at = now(), responded_at = null
    where hackathon_team_join_requests.status = 'cancelled'
  returning id into v_request;

  if v_request is null then
    raise exception 'You''ve already asked to join this team.' using hint = 'already_requested';
  end if;
  return v_request;
end $$;

create or replace function public.hackathon_cancel_join_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.hackathon_team_join_requests q
  set status = 'cancelled', responded_at = now()
  where q.id = p_request_id and q.user_id = auth.uid() and q.status = 'pending';
  if not found then
    raise exception 'No open request to cancel.';
  end if;
end $$;

-- The team owner answers. Accepting adds the person, subject to the same
-- invariants as any other join (registered, one team, not full).
create or replace function public.hackathon_respond_to_join_request(p_request_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q public.hackathon_team_join_requests%rowtype;
begin
  select * into q from public.hackathon_team_join_requests where id = p_request_id for update;
  if not found then
    raise exception 'That request doesn''t exist.';
  end if;
  if not private.is_team_owner(q.team_id, uid) then
    raise exception 'Only the team owner can answer requests.' using errcode = '42501';
  end if;
  perform private.require_team_window(q.hackathon_id);
  if q.status <> 'pending' then
    raise exception 'This request has already been answered.' using hint = 'already_answered';
  end if;

  if not p_accept then
    update public.hackathon_team_join_requests
    set status = 'declined', responded_at = now()
    where id = q.id;
    return;
  end if;

  if exists (
    select 1 from public.hackathon_team_members m
    where m.hackathon_id = q.hackathon_id and m.user_id = q.user_id
  ) then
    raise exception 'They''ve already joined another team.' using hint = 'on_a_team';
  end if;

  update public.hackathon_team_join_requests
  set status = 'accepted', responded_at = now()
  where id = q.id;
  insert into public.hackathon_team_members (team_id, user_id, role) values (q.team_id, q.user_id, 'member');
end $$;

-- The owner leaving hands the team to its longest-standing member; the last
-- one out before kickoff dissolves it (see hackathon_team_members_after).
create or replace function public.hackathon_leave_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if not private.is_team_member(p_team_id, uid) then
    raise exception 'You''re not on this team.';
  end if;
  perform private.require_team_window(private.team_hackathon_id(p_team_id));
  delete from public.hackathon_team_members m where m.team_id = p_team_id and m.user_id = uid;
end $$;

create or replace function public.hackathon_remove_member(p_team_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if not private.is_team_owner(p_team_id, uid) then
    raise exception 'Only the team owner can remove people.' using errcode = '42501';
  end if;
  if p_user_id = uid then
    raise exception 'To leave your own team, use leave.';
  end if;
  perform private.require_team_window(private.team_hackathon_id(p_team_id));
  delete from public.hackathon_team_members m where m.team_id = p_team_id and m.user_id = p_user_id;
  if not found then
    raise exception 'They''re not on this team.';
  end if;
end $$;

create or replace function public.hackathon_accept_judge_invite(p_hackathon_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.hackathon_judges j
  set accepted_at = coalesce(j.accepted_at, now())
  where j.hackathon_id = p_hackathon_id and j.user_id = auth.uid();
  if not found then
    raise exception 'You don''t have a judging invite for this Sprint.';
  end if;
end $$;

-- ============================================================================
-- Admin: resume a paused Sprint
-- ============================================================================
-- Pausing doesn't stop real time. Resuming with p_extend moves every
-- timestamp that hadn't yet passed when the Sprint was paused later by the
-- length of the pause, so teams get back the time they lost. Timestamps are
-- ordered, so the moved ones are always a tail of the timeline and the order
-- constraint still holds. The lobby message (019) says how far they moved.
-- Service role only (the admin console); pausing is a plain update.
create or replace function public.hackathon_resume(p_hackathon_id uuid, p_extend boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  h public.hackathons%rowtype;
  shift interval;
begin
  select * into h from public.hackathons where id = p_hackathon_id for update;
  if not found then
    raise exception 'That Sprint doesn''t exist.';
  end if;
  if h.status_override is distinct from 'paused' then
    raise exception 'Only a paused Sprint can be resumed.';
  end if;

  shift := greatest(now() - h.status_override_at, interval '0');
  perform set_config('hackathon.resume_shift', case when p_extend then shift::text else '' end, true);

  if p_extend and shift > interval '0' then
    update public.hackathons set
      registration_opens_at = case when registration_opens_at > h.status_override_at then registration_opens_at + shift else registration_opens_at end,
      team_lock_at          = case when team_lock_at          > h.status_override_at then team_lock_at          + shift else team_lock_at end,
      starts_at             = case when starts_at             > h.status_override_at then starts_at             + shift else starts_at end,
      ends_at               = case when ends_at               > h.status_override_at then ends_at               + shift else ends_at end,
      judging_ends_at       = case when judging_ends_at       > h.status_override_at then judging_ends_at       + shift else judging_ends_at end,
      reveal_at             = case when reveal_at             > h.status_override_at then reveal_at             + shift else reveal_at end,
      lobby_closes_at       = case when lobby_closes_at       > h.status_override_at then lobby_closes_at       + shift else lobby_closes_at end,
      status_override       = null
    where id = p_hackathon_id;
  else
    update public.hackathons set status_override = null where id = p_hackathon_id;
  end if;
end $$;

-- ============================================================================
-- Grants and realtime
-- ============================================================================
grant execute on all functions in schema private to anon, authenticated, service_role;

revoke execute on function public.hackathon_create_team(uuid, text, text, text, boolean) from public, anon;
revoke execute on function public.hackathon_update_team(uuid, text, text, text, boolean) from public, anon;
revoke execute on function public.hackathon_request_to_join(uuid, text) from public, anon;
revoke execute on function public.hackathon_cancel_join_request(uuid) from public, anon;
revoke execute on function public.hackathon_respond_to_join_request(uuid, boolean) from public, anon;
revoke execute on function public.hackathon_leave_team(uuid) from public, anon;
revoke execute on function public.hackathon_remove_member(uuid, uuid) from public, anon;
revoke execute on function public.hackathon_accept_judge_invite(uuid) from public, anon;
grant execute on function public.hackathon_create_team(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.hackathon_update_team(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.hackathon_request_to_join(uuid, text) to authenticated;
grant execute on function public.hackathon_cancel_join_request(uuid) to authenticated;
grant execute on function public.hackathon_respond_to_join_request(uuid, boolean) to authenticated;
grant execute on function public.hackathon_leave_team(uuid) to authenticated;
grant execute on function public.hackathon_remove_member(uuid, uuid) to authenticated;
grant execute on function public.hackathon_accept_judge_invite(uuid) to authenticated;

revoke execute on function public.hackathon_resume(uuid, boolean) from public, anon, authenticated;
grant execute on function public.hackathon_resume(uuid, boolean) to service_role;

grant execute on function public.hackathon_state(uuid) to anon, authenticated;
grant execute on function public.hackathon_state_at(uuid, timestamptz) to anon, authenticated;
grant execute on function public.server_now() to anon, authenticated;

-- Realtime delivers a change only to subscribers whose RLS lets them read the
-- row. `hackathons` is deliberately left out: its column grants hide the
-- theme, and the lobby's system messages (019) announce pauses instead.
alter table public.hackathon_team_members replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.hackathon_teams;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.hackathon_team_members;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.hackathon_registrations;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.hackathon_team_join_requests;
exception when duplicate_object then null;
end $$;
