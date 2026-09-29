-- ---------------------------------------------------------------------------
-- 025 — The join queue: invite links, personal invites, counts, check-in
--
-- Phase 1 (018) already enforces the core rules for every caller: one team
-- per person per Sprint (a unique key), team size (a trigger that locks the
-- team row), membership only through functions (no insert policy), and team
-- changes only while registration is open (private.require_team_window).
-- This adds the ways in that Prompt 4 asks for, on top of those same rules:
--
--  * Invite links. Each team can have one code (hackathon_team_invite_codes).
--    Only the team's members can read it; the owner can get or reset it.
--    hackathon_team_by_code previews the team; hackathon_join_with_code
--    registers the caller if needed (active members only, never a judge) and
--    adds them. The code IS the invitation, so the team needn't be open to
--    requests.
--  * Personal invites (hackathon_team_invitations). The owner invites any
--    member; only the invitee, the team and admins can see it. Whether the
--    invitee can take part is checked when they accept, so inviting someone
--    reveals nothing about whether they pay.
--  * Registration counts: numbers only, for the arena's audience.
--  * Kickoff check-in (checked_in_at), participants only, while live.
--  * Team details (name, emblem, colour) can change until the submission
--    deadline, by the owner, or by any member of a team the matcher made.
--    Who is on a team still locks at team lock.
--  * Joining a team by any route sets the registration's mode to 'team', and
--    closes the joiner's other pending invitations.
--
-- RUN AFTER 024. Idempotent.
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Joining a team: the one path every way in shares
-- ============================================================================
-- Registers the person if they aren't (the same rules as registering
-- yourself: registration open, active member, not a judge), then adds them.
-- The team-size trigger and the one-team unique key still apply.
create or replace function private.join_team(p_team_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_hackathon uuid := private.team_hackathon_id(p_team_id);
  r public.hackathon_registrations%rowtype;
  v_registered boolean;
begin
  if v_hackathon is null then
    raise exception 'That team doesn''t exist.';
  end if;
  perform private.require_team_window(v_hackathon);
  if private.is_invited_judge(v_hackathon, p_user_id) then
    raise exception 'A judge of this Sprint can''t also compete in it.' using hint = 'judge_cannot_register';
  end if;
  if exists (
    select 1 from public.hackathon_team_members m
    where m.hackathon_id = v_hackathon and m.user_id = p_user_id
  ) then
    raise exception 'You''re already on a team for this Sprint. Leave it first.' using hint = 'on_a_team';
  end if;

  select * into r from public.hackathon_registrations
  where hackathon_id = v_hackathon and user_id = p_user_id
  for update;
  v_registered := found;

  if not v_registered or r.withdrawn_at is not null then
    if not private.is_active_member(p_user_id) then
      raise exception 'Only active members (free trials included) can take part.' using hint = 'not_active_member';
    end if;
  end if;

  if not v_registered then
    insert into public.hackathon_registrations (hackathon_id, user_id, mode)
    values (v_hackathon, p_user_id, 'team');
  else
    update public.hackathon_registrations
    set mode = 'team', withdrawn_at = null
    where id = r.id;
  end if;

  insert into public.hackathon_team_members (team_id, user_id, role) values (p_team_id, p_user_id, 'member');
end $$;

-- Accepting a join request now also records that the person is on a team.
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
  update public.hackathon_registrations
  set mode = 'team'
  where hackathon_id = q.hackathon_id and user_id = q.user_id;
end $$;

-- ============================================================================
-- Invite links
-- ============================================================================
create table if not exists public.hackathon_team_invite_codes (
  team_id    uuid primary key references public.hackathon_teams(id) on delete cascade,
  code       text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  created_at timestamptz not null default now()
);

alter table public.hackathon_team_invite_codes enable row level security;
revoke all on public.hackathon_team_invite_codes from anon, authenticated;
grant select on public.hackathon_team_invite_codes to authenticated;

drop policy if exists "hackathon_team_invite_codes_read_team" on public.hackathon_team_invite_codes;
create policy "hackathon_team_invite_codes_read_team"
  on public.hackathon_team_invite_codes for select to authenticated
  using (private.is_team_member(team_id, auth.uid()) or private.is_admin(auth.uid()));
-- No write policies: codes are made and reset only by the functions below.

-- Eight characters from 31 that can't be misread (no 0/O, 1/I/L).
create or replace function private.new_invite_code()
returns text language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text := '';
begin
  for i in 1..8 loop
    c := c || substr(alphabet, 1 + floor(random() * 31)::integer, 1);
  end loop;
  return c;
end $$;

create or replace function private.issue_invite_code(p_team_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  loop
    begin
      insert into public.hackathon_team_invite_codes (team_id, code)
      values (p_team_id, private.new_invite_code())
      returning code into v_code;
      return v_code;
    exception when unique_violation then
      -- Another code for this team already exists: use it. Otherwise the
      -- random code collided with another team's; draw again.
      select code into v_code from public.hackathon_team_invite_codes where team_id = p_team_id;
      if v_code is not null then
        return v_code;
      end if;
    end;
  end loop;
end $$;

-- The team's code, made the first time the owner asks.
create or replace function public.hackathon_team_invite_code(p_team_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not private.is_team_owner(p_team_id, auth.uid()) then
    raise exception 'Only the team owner can share the invite link.' using errcode = '42501';
  end if;
  select code into v_code from public.hackathon_team_invite_codes where team_id = p_team_id;
  return coalesce(v_code, private.issue_invite_code(p_team_id));
end $$;

-- A new code; the old link stops working.
create or replace function public.hackathon_reset_invite_code(p_team_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not private.is_team_owner(p_team_id, auth.uid()) then
    raise exception 'Only the team owner can reset the invite link.' using errcode = '42501';
  end if;
  delete from public.hackathon_team_invite_codes where team_id = p_team_id;
  return private.issue_invite_code(p_team_id);
end $$;

-- What an invite link shows before joining. Anyone signed in with the code.
create or replace function public.hackathon_team_by_code(p_code text)
returns table (
  team_id          uuid,
  team_name        text,
  emblem           text,
  color            text,
  hackathon_id     uuid,
  hackathon_number integer,
  hackathon_title  text,
  member_count     integer,
  max_size         integer
)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.emblem, t.color, h.id, h.number, h.title,
    (select count(*)::integer from public.hackathon_team_members m where m.team_id = t.id),
    coalesce(t.max_size_override, h.max_team_size)
  from public.hackathon_team_invite_codes c
  join public.hackathon_teams t on t.id = c.team_id
  join public.hackathons h on h.id = t.hackathon_id
  where c.code = upper(btrim(p_code))
    and h.is_published
    and auth.uid() is not null
$$;

create or replace function public.hackathon_join_with_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_team uuid;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select c.team_id into v_team
  from public.hackathon_team_invite_codes c
  join public.hackathon_teams t on t.id = c.team_id
  join public.hackathons h on h.id = t.hackathon_id
  where c.code = upper(btrim(p_code)) and h.is_published;
  if v_team is null then
    raise exception 'That invite link isn''t valid any more. Ask the team for a new one.' using hint = 'bad_code';
  end if;
  perform private.join_team(v_team, uid);
  return v_team;
end $$;

-- ============================================================================
-- Personal invites
-- ============================================================================
create table if not exists public.hackathon_team_invitations (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null,
  hackathon_id uuid not null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  invited_by   uuid references public.profiles(id) on delete set null,
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  foreign key (team_id, hackathon_id)
    references public.hackathon_teams (id, hackathon_id) on delete cascade,
  unique (team_id, user_id)
);
create index if not exists hackathon_team_invitations_user_idx
  on public.hackathon_team_invitations (user_id);

alter table public.hackathon_team_invitations enable row level security;
revoke all on public.hackathon_team_invitations from anon, authenticated;
grant select on public.hackathon_team_invitations to authenticated;

drop policy if exists "hackathon_team_invitations_read" on public.hackathon_team_invitations;
create policy "hackathon_team_invitations_read"
  on public.hackathon_team_invitations for select to authenticated
  using (
    user_id = auth.uid()
    or private.is_team_member(team_id, auth.uid())
    or private.is_admin(auth.uid())
  );
-- No write policies: the functions below are the only way.

create or replace function public.hackathon_invite_member(p_team_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_hackathon uuid := private.team_hackathon_id(p_team_id);
  v_id uuid;
  v_max integer;
begin
  if not private.is_team_owner(p_team_id, uid) then
    raise exception 'Only the team owner can invite people.' using errcode = '42501';
  end if;
  perform private.require_team_window(v_hackathon);
  if p_user_id = uid then
    raise exception 'You''re already on this team.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.status = 'approved') then
    raise exception 'That member doesn''t exist.';
  end if;
  if exists (
    select 1 from public.hackathon_team_members m
    where m.hackathon_id = v_hackathon and m.user_id = p_user_id
  ) then
    raise exception 'They''re already on a team for this Sprint.' using hint = 'on_a_team';
  end if;
  select coalesce(t.max_size_override, h.max_team_size) into v_max
  from public.hackathon_teams t join public.hackathons h on h.id = t.hackathon_id
  where t.id = p_team_id;
  if (select count(*) from public.hackathon_team_members m where m.team_id = p_team_id) >= v_max then
    raise exception 'Your team is full.' using hint = 'team_full';
  end if;

  insert into public.hackathon_team_invitations (team_id, hackathon_id, user_id, invited_by)
  values (p_team_id, v_hackathon, p_user_id, uid)
  on conflict (team_id, user_id) do update
    set status = 'pending', invited_by = excluded.invited_by, created_at = now(), responded_at = null
    where hackathon_team_invitations.status in ('cancelled', 'declined')
  returning id into v_id;

  if v_id is null then
    raise exception 'You''ve already invited them.' using hint = 'already_invited';
  end if;
  return v_id;
end $$;

create or replace function public.hackathon_respond_to_invitation(p_invitation_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  i public.hackathon_team_invitations%rowtype;
begin
  select * into i from public.hackathon_team_invitations where id = p_invitation_id for update;
  if not found or i.user_id is distinct from uid then
    raise exception 'That invitation doesn''t exist.';
  end if;
  if i.status <> 'pending' then
    raise exception 'This invitation has already been answered.' using hint = 'already_answered';
  end if;
  perform private.require_team_window(i.hackathon_id);

  if p_accept then
    perform private.join_team(i.team_id, uid);
  end if;
  update public.hackathon_team_invitations
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = i.id;
end $$;

create or replace function public.hackathon_cancel_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  i public.hackathon_team_invitations%rowtype;
begin
  select * into i from public.hackathon_team_invitations where id = p_invitation_id for update;
  if not found or not private.is_team_owner(i.team_id, auth.uid()) then
    raise exception 'That invitation doesn''t exist.';
  end if;
  if i.status <> 'pending' then
    raise exception 'This invitation has already been answered.' using hint = 'already_answered';
  end if;
  update public.hackathon_team_invitations
  set status = 'cancelled', responded_at = now()
  where id = i.id;
end $$;

-- Same as 018, plus: joining a team closes the joiner's other invitations.
create or replace function private.hackathon_team_members_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_next uuid;
begin
  if tg_op = 'INSERT' then
    update public.hackathon_registrations r
    set team_id = new.team_id
    where r.hackathon_id = new.hackathon_id and r.user_id = new.user_id;

    -- Joined a team: any other open requests and invitations are moot.
    update public.hackathon_team_join_requests q
    set status = 'cancelled', responded_at = now()
    where q.hackathon_id = new.hackathon_id and q.user_id = new.user_id
      and q.status = 'pending' and q.team_id <> new.team_id;
    update public.hackathon_team_invitations i
    set status = 'cancelled', responded_at = now()
    where i.hackathon_id = new.hackathon_id and i.user_id = new.user_id
      and i.status = 'pending' and i.team_id <> new.team_id;
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

-- ============================================================================
-- Team details until the deadline
-- ============================================================================
-- Name, emblem and colour: until the submission deadline, by the owner, or by
-- any member of a team the matcher made (nobody chose its owner). Whether it
-- takes requests only matters while registration is open.
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
  v_matched boolean;
begin
  select t.is_random_matched into v_matched from public.hackathon_teams t where t.id = p_team_id;
  if not (
    private.is_team_owner(p_team_id, uid)
    or (coalesce(v_matched, false) and private.is_team_member(p_team_id, uid))
  ) then
    raise exception 'Only the team owner can change the team.' using errcode = '42501';
  end if;
  if not private.hackathon_writable(v_hackathon)
    or private.hackathon_phase(v_hackathon) not in ('registration', 'teams_locked', 'live') then
    raise exception 'Teams can be renamed until the submission deadline.' using hint = 'teams_locked';
  end if;
  if p_open_to_requests is not null and private.hackathon_phase(v_hackathon) <> 'registration' then
    raise exception 'Teams are locked, so requests are closed.' using hint = 'teams_locked';
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

-- ============================================================================
-- Counts and check-in
-- ============================================================================
-- Numbers only, for the arena's audience: the join queue's live tally.
create or replace function public.hackathon_registration_counts(p_hackathon_id uuid)
returns table (registered integer, random_pool integer, looking integer, on_teams integer, teams integer)
language sql stable security definer set search_path = public as $$
  select
    count(*)::integer,
    count(*) filter (where r.team_id is null and r.mode = 'random')::integer,
    count(*) filter (where r.team_id is null and r.mode = 'team')::integer,
    count(*) filter (where r.team_id is not null)::integer,
    (select count(*)::integer from public.hackathon_teams t
      where t.hackathon_id = p_hackathon_id and private.can_view_arena(p_hackathon_id, auth.uid()))
  from public.hackathon_registrations r
  where r.hackathon_id = p_hackathon_id
    and r.withdrawn_at is null
    and private.can_view_arena(p_hackathon_id, auth.uid())
$$;

-- "I'm in, let's build": once, while the Sprint is live and not paused.
create or replace function public.hackathon_check_in(p_hackathon_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_at timestamptz;
begin
  if not private.is_participant(p_hackathon_id, uid) then
    raise exception 'Only people taking part can check in.' using errcode = '42501';
  end if;
  if not private.hackathon_writable(p_hackathon_id) or private.hackathon_phase(p_hackathon_id) <> 'live' then
    raise exception 'Check-in is open while the Sprint is live.' using hint = 'not_live';
  end if;
  update public.hackathon_registrations r
  set checked_in_at = coalesce(r.checked_in_at, now())
  where r.hackathon_id = p_hackathon_id and r.user_id = uid
  returning r.checked_in_at into v_at;
  return v_at;
end $$;

-- ============================================================================
-- Grants and realtime
-- ============================================================================
grant execute on all functions in schema private to anon, authenticated, service_role;

revoke execute on function public.hackathon_team_invite_code(uuid) from public, anon;
revoke execute on function public.hackathon_reset_invite_code(uuid) from public, anon;
revoke execute on function public.hackathon_team_by_code(text) from public, anon;
revoke execute on function public.hackathon_join_with_code(text) from public, anon;
revoke execute on function public.hackathon_invite_member(uuid, uuid) from public, anon;
revoke execute on function public.hackathon_respond_to_invitation(uuid, boolean) from public, anon;
revoke execute on function public.hackathon_cancel_invitation(uuid) from public, anon;
revoke execute on function public.hackathon_registration_counts(uuid) from public, anon;
revoke execute on function public.hackathon_check_in(uuid) from public, anon;
grant execute on function public.hackathon_team_invite_code(uuid) to authenticated;
grant execute on function public.hackathon_reset_invite_code(uuid) to authenticated;
grant execute on function public.hackathon_team_by_code(text) to authenticated;
grant execute on function public.hackathon_join_with_code(text) to authenticated;
grant execute on function public.hackathon_invite_member(uuid, uuid) to authenticated;
grant execute on function public.hackathon_respond_to_invitation(uuid, boolean) to authenticated;
grant execute on function public.hackathon_cancel_invitation(uuid) to authenticated;
grant execute on function public.hackathon_registration_counts(uuid) to authenticated;
grant execute on function public.hackathon_check_in(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.hackathon_team_invitations;
exception when duplicate_object then null;
end $$;
