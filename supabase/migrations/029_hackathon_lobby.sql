-- ---------------------------------------------------------------------------
-- 029 — The lobby: a welcome note, milestone messages, and basic protections
--
-- The lobby's table and its access rules come from 019: participants, accepted
-- judges and admins read it; they write until lobby_closes_at (if set). It
-- stays writable during a pause (decision 9, kept by the owner in Phase 7) and
-- turns read-only on cancel. This adds:
--
--  * hackathons.lobby_welcome: the note pinned at the top of the lobby, pre-
--    filled for every Sprint, edited in the admin console, copied by
--    Duplicate. Read through hackathon_lobby_welcome(id), so only the lobby's
--    own audience sees it (it isn't on the public view).
--
--  * Milestone messages ("Teams are locked", "Sprint is LIVE — the theme is:
--    …", "1 hour left", "Submissions are locked", "Results are in!"), posted
--    by hackathon_post_lobby_milestones(id). There's no per-minute cron (the
--    app is on Vercel Hobby), so the app calls it whenever a Sprint or lobby
--    page loads and from the timing check every open Sprint page makes.
--    It posts each milestone exactly once (system_key, unique per Sprint),
--    on the Sprint's own clock (nothing while paused, nothing once
--    cancelled), timestamped at the milestone itself so the history reads in
--    order even when nobody was looking. "1 hour left" is skipped once the
--    deadline has passed rather than posted late. If an admin moves a time so
--    an announced milestone is in the future again (extending the deadline),
--    the announcement is withdrawn and posts again at the new time.
--
--  * For members' own posts: at most 1,000 characters, at most 5 messages in
--    15 seconds and 30 in 5 minutes. Admins are exempt.
--
--  * An admin pinning, unpinning or deleting someone's message from the lobby
--    itself (with their own sign-in, not the admin console) is written to
--    admin_change_log too, like the console's moderation.
--
-- RUN AFTER 028. Idempotent.
-- ---------------------------------------------------------------------------

-- ============================================================================
-- The welcome note
-- ============================================================================
alter table public.hackathons
  add column if not exists lobby_welcome text
    default 'This is the lobby for everyone in the Sprint — banter, questions, cheering each other on. Keep your team''s idea under wraps until the reveal!';

do $$ begin
  alter table public.hackathons add constraint hackathons_lobby_welcome_length
    check (lobby_welcome is null or char_length(lobby_welcome) <= 1000);
exception when duplicate_object then null;
end $$;

-- The lobby's audience only (private.can_read_lobby); NULL for anyone else.
create or replace function public.hackathon_lobby_welcome(p_hackathon_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select nullif(btrim(h.lobby_welcome), '')
  from public.hackathons h
  where h.id = p_hackathon_id
    and private.can_read_lobby(h.id, auth.uid())
$$;

-- Duplicate (022) copies the welcome note too.
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
    show_countdown_in_app, show_countdown_on_landing, countdown_headline_override,
    lobby_welcome
  ) values (
    h.title, h.tagline, h.rules, h.max_team_size, h.min_team_size,
    h.show_countdown_in_app, h.show_countdown_on_landing, h.countdown_headline_override,
    h.lobby_welcome
  )
  returning id into v_id;
  return v_id;
end $$;

-- ============================================================================
-- Milestone messages
-- ============================================================================
alter table public.hackathon_lobby_messages add column if not exists system_key text;
create unique index if not exists hackathon_lobby_messages_system_key_idx
  on public.hackathon_lobby_messages (hackathon_id, system_key)
  where system_key is not null;

-- Posts every milestone that's due and hasn't been posted. Safe to call any
-- number of times, from anywhere. Returns how many it posted.
create or replace function public.hackathon_post_lobby_milestones(p_hackathon_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  h public.hackathons%rowtype;
  v_clock timestamptz;
  v_posted integer := 0;
  v_rows integer;
  m record;
begin
  select * into h from public.hackathons where id = p_hackathon_id;
  if not found or not h.is_published or h.status_override = 'cancelled' then
    return 0;
  end if;
  -- The Sprint's own clock: stopped at the pause while paused.
  v_clock := private.hackathon_clock(
    case when h.status_override is not null then h.status_override_at end, now());

  for m in
    select * from (values
      ('teams_locked', h.team_lock_at,
        'Teams are locked. Anyone still without a team is being matched now.'),
      ('live', h.starts_at,
        'Sprint is LIVE — the theme is: ' || coalesce(nullif(btrim(h.theme_hidden), ''), 'revealed on the Sprint page') || '. Go build!'),
      ('one_hour_left', h.ends_at - interval '1 hour',
        '1 hour left. Get your submission in before the deadline.'),
      ('submissions_locked', h.ends_at,
        'Submissions are locked. The judges take it from here.'),
      ('results', h.reveal_at,
        'Results are in! Every project is unsealed. Go see what everyone built.')
    ) as x(key, at, body)
    order by at
  loop
    continue when m.at is null or m.at > v_clock;
    -- Too late to be useful: say nothing rather than "1 hour left" after the deadline.
    continue when m.key = 'one_hour_left' and h.ends_at <= v_clock;

    insert into public.hackathon_lobby_messages (hackathon_id, user_id, body, is_system, system_key, created_at)
    values (h.id, null, m.body, true, m.key, m.at)
    on conflict (hackathon_id, system_key) where system_key is not null do nothing;
    get diagnostics v_rows = row_count;
    v_posted := v_posted + v_rows;
  end loop;
  return v_posted;
end $$;


-- When an admin moves a Sprint's times (extending the deadline, resuming with
-- the pause given back), a milestone already announced can end up in the
-- future again: "Submissions are locked" while they're open. Those
-- announcements are withdrawn, and post again when the new time comes, so
-- the lobby never says something that isn't true yet.
create or replace function private.hackathon_lobby_withdraw_moved_milestones()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_clock timestamptz := private.hackathon_clock(
    case when new.status_override is not null then new.status_override_at end, now());
  -- Put back afterwards whatever an admin set in the SQL editor.
  v_actor text := current_setting('hackathon.actor', true);
  v_action text := current_setting('hackathon.action', true);
begin
  -- How the admin change log describes the withdrawal.
  perform set_config('hackathon.actor', 'Sprint times moved', true);
  perform set_config('hackathon.action', 'Withdrew a milestone message whose time moved', true);
  delete from public.hackathon_lobby_messages l
  where l.hackathon_id = new.id
    and l.system_key is not null
    and case l.system_key
      when 'teams_locked' then new.team_lock_at
      when 'live' then new.starts_at
      when 'one_hour_left' then new.ends_at - interval '1 hour'
      when 'submissions_locked' then new.ends_at
      when 'results' then new.reveal_at
    end > v_clock;
  perform set_config('hackathon.actor', coalesce(v_actor, ''), true);
  perform set_config('hackathon.action', coalesce(v_action, ''), true);
  return null;
end $$;

drop trigger if exists hackathons_withdraw_moved_milestones_trigger on public.hackathons;
create trigger hackathons_withdraw_moved_milestones_trigger
  after update of team_lock_at, starts_at, ends_at, reveal_at on public.hackathons
  for each row execute function private.hackathon_lobby_withdraw_moved_milestones();

-- ============================================================================
-- Members' posts: length, pace, and no made-up system keys
-- ============================================================================
-- Security invoker, like the 019 guard: current_user is then the caller, which
-- is how a member's own request is told apart from the server's.
create or replace function private.hackathon_lobby_message_limits()
returns trigger language plpgsql set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.system_key := old.system_key;
  else
    new.system_key := null;
  end if;

  if private.is_admin(uid) then
    return new;
  end if;

  if new.deleted_at is null and char_length(btrim(new.body)) > 1000 then
    raise exception 'Keep lobby messages under 1,000 characters.' using errcode = '22001', hint = 'too_long';
  end if;

  if tg_op = 'INSERT' then
    if (select count(*) from public.hackathon_lobby_messages l
        where l.user_id = uid and l.hackathon_id = new.hackathon_id
          and l.created_at > now() - interval '15 seconds') >= 5
       or (select count(*) from public.hackathon_lobby_messages l
           where l.user_id = uid and l.hackathon_id = new.hackathon_id
             and l.created_at > now() - interval '5 minutes') >= 30 then
      raise exception 'You''re posting fast. Give it a few seconds.' using errcode = '54000', hint = 'rate_limited';
    end if;
  end if;
  return new;
end $$;

-- Fires after the 019 guard (triggers run in name order: guard < limits).
drop trigger if exists hackathon_lobby_messages_limits_trigger on public.hackathon_lobby_messages;
create trigger hackathon_lobby_messages_limits_trigger
  before insert or update on public.hackathon_lobby_messages
  for each row execute function private.hackathon_lobby_message_limits();

create index if not exists hackathon_lobby_messages_user_idx
  on public.hackathon_lobby_messages (user_id, hackathon_id, created_at);

-- ============================================================================
-- Moderation from the lobby itself goes in the admin change log
-- ============================================================================
-- 022's log skips anything done through a member's own sign-in. An admin's
-- pins, unpins and deletions of other people's messages from the lobby page
-- are moderation all the same, so they're logged here, naming the admin.
create or replace function private.hackathon_lobby_log_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_name text;
  v_action text;
  v_prev_actor text := current_setting('hackathon.actor', true);
  v_prev_action text := current_setting('hackathon.action', true);
begin
  -- A member's own sign-in (this function runs as its owner, so current_user
  -- can't tell; the request's role can, as in 022's log).
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') or not private.is_admin(uid) then
    return null;
  end if;
  if new.deleted_at is not null and old.deleted_at is null and old.user_id is distinct from uid then
    v_action := 'Deleted a lobby message';
  elsif new.is_pinned is distinct from old.is_pinned then
    v_action := case when new.is_pinned then 'Pinned a lobby message' else 'Unpinned a lobby message' end;
  else
    return null;
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), p.username, 'An admin') into v_name
  from public.profiles p where p.id = uid;
  perform set_config('hackathon.actor', coalesce(v_name, 'An admin') || ' (in the lobby)', true);
  perform set_config('hackathon.action', v_action, true);
  perform private.write_admin_change(tg_table_name, 'update', to_jsonb(old), to_jsonb(new), 'authenticated');
  perform set_config('hackathon.actor', coalesce(v_prev_actor, ''), true);
  perform set_config('hackathon.action', coalesce(v_prev_action, ''), true);
  return null;
end $$;

drop trigger if exists hackathon_lobby_log_moderation_trigger on public.hackathon_lobby_messages;
create trigger hackathon_lobby_log_moderation_trigger
  after update on public.hackathon_lobby_messages
  for each row execute function private.hackathon_lobby_log_moderation();


-- ============================================================================
-- Who's who in the lobby: the tag beside each name
-- ============================================================================
-- Everyone the lobby can show: participants, accepted judges, and anyone who
-- has posted there (an admin, say). Name, avatar details, team (if any), and
-- a role for the tag. Only for the lobby's own audience.
create or replace function public.hackathon_lobby_people(p_hackathon_id uuid)
returns table (
  user_id uuid, full_name text, username text, stage text,
  team_name text, team_emblem text, team_color text, role text
)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.username, p.stage,
    t.name, t.emblem, t.color,
    case
      when private.is_admin(p.id) then 'admin'
      when private.is_judge(p_hackathon_id, p.id) then 'judge'
      when private.is_participant(p_hackathon_id, p.id) then 'participant'
    end
  from (
    select r.user_id from public.hackathon_registrations r
    where r.hackathon_id = p_hackathon_id and r.withdrawn_at is null
    union
    select j.user_id from public.hackathon_judges j
    where j.hackathon_id = p_hackathon_id and j.accepted_at is not null and j.user_id is not null
    union
    select l.user_id from public.hackathon_lobby_messages l
    where l.hackathon_id = p_hackathon_id and l.user_id is not null
  ) ids
  join public.profiles p on p.id = ids.user_id
  left join public.hackathon_team_members m on m.hackathon_id = p_hackathon_id and m.user_id = p.id
  left join public.hackathon_teams t on t.id = m.team_id
  where private.can_read_lobby(p_hackathon_id, auth.uid())
$$;

-- ============================================================================
-- Grants
-- ============================================================================
grant execute on all functions in schema private to anon, authenticated, service_role;

revoke execute on function public.hackathon_lobby_welcome(uuid) from public, anon;
grant execute on function public.hackathon_lobby_welcome(uuid) to authenticated;
revoke execute on function public.hackathon_lobby_people(uuid) from public, anon;
grant execute on function public.hackathon_lobby_people(uuid) to authenticated;
revoke execute on function public.hackathon_post_lobby_milestones(uuid) from public, anon, authenticated;
grant execute on function public.hackathon_post_lobby_milestones(uuid) to service_role;
revoke execute on function public.hackathon_admin_duplicate(uuid) from public, anon, authenticated;
grant execute on function public.hackathon_admin_duplicate(uuid) to service_role;
