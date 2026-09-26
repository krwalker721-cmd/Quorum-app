-- ---------------------------------------------------------------------------
-- 023 — Who made an admin change: the admin's name, from their account
--
-- The admin console now requires a signed-in Quorum account marked is_admin
-- (lib/admin/auth.ts), so every admin request knows who is acting. Its server
-- routes send that in request headers (lib/admin/db.ts):
--
--   x-quorum-actor-id    the admin's profile id
--   x-quorum-via         "admin console, <ip>"
--   x-quorum-action-b64  a one-line note, base64 UTF-8 ("Merged Comets into
--                        Rockets"). HTTP header values must be ASCII, and team
--                        and Sprint names needn't be.
--
-- Both logs, admin_change_log (022) and hackathon_admin_audit (021), now take
-- the name from the account: "Keaton Walker (admin console, 203.0.113.9)".
-- Precedence is unchanged otherwise: a label set in the SQL editor with
--   select set_config('hackathon.actor', 'Keaton', true);
-- wins, then an explicit x-quorum-actor header, then the account's name, then
-- the channel.
--
-- Also:
--  * Log entries skip fields that are empty on both sides (a new row's blank
--    columns no longer show as "— → —").
--  * Resuming with the time given back moves the times by whole minutes,
--    rounded up, so they stay on the minute the admin form can show.
--
-- RUN AFTER 022. Idempotent.
-- ---------------------------------------------------------------------------

-- The acting admin's account: from the header a server route sends, or the
-- signed-in user writing directly.
create or replace function private.request_actor_id()
returns uuid language plpgsql stable as $$
begin
  return coalesce(private.request_header('x-quorum-actor-id')::uuid, auth.uid());
exception when others then
  return auth.uid();
end $$;

create or replace function private.request_actor(p_role text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_name text;
  v_via text := private.request_header('x-quorum-via');
begin
  if nullif(btrim(current_setting('hackathon.actor', true)), '') is not null then
    return btrim(current_setting('hackathon.actor', true));
  end if;
  if private.request_header('x-quorum-actor') is not null then
    return private.request_header('x-quorum-actor');
  end if;
  select coalesce(nullif(btrim(p.full_name), ''), p.username) into v_name
  from public.profiles p where p.id = private.request_actor_id();
  if v_name is not null then
    return v_name || coalesce(' (' || v_via || ')', '');
  end if;
  return case p_role when 'service_role' then coalesce(v_via, 'admin console') else 'database (' || p_role || ')' end;
end $$;

-- The note on what the admin set out to do.
create or replace function private.request_action()
returns text language plpgsql stable as $$
declare
  v text := nullif(btrim(current_setting('hackathon.action', true)), '');
begin
  if v is not null then
    return v;
  end if;
  v := private.request_header('x-quorum-action-b64');
  if v is not null then
    return convert_from(decode(v, 'base64'), 'UTF8');
  end if;
  return private.request_header('x-quorum-action');
exception when others then
  return null;
end $$;

-- 022's change log, now naming the admin.
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
    and nullif(p_old -> k, 'null'::jsonb) is distinct from nullif(p_new -> k, 'null'::jsonb);

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

  v_actor_id := private.request_actor_id();
  v_actor := private.request_actor(p_role);

  insert into public.admin_change_log
    (area, table_name, row_id, hackathon_id, action, summary, subject, changes, actor, actor_id, db_role)
  values (
    v_area, p_table, coalesce(r ->> 'id', '?'), v_hackathon, p_action,
    left(private.request_action(), 300),
    left(v_subject, 300), v_changes, left(v_actor, 200), v_actor_id, p_role
  );
end $$;

-- 021's after-deadline audit, the same.
create or replace function private.log_hackathon_admin_edit(
  p_table text,
  p_action text,
  p_old jsonb,
  p_new jsonb,
  p_role text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  r jsonb := coalesce(p_new, p_old);
  v_hackathon uuid := (r ->> 'hackathon_id')::uuid;
  v_deadline timestamptz;
  v_changes jsonb;
  v_subject text;
  v_actor text;
begin
  select case when p_table = 'hackathon_submissions' then h.ends_at else h.judging_ends_at end
  into v_deadline
  from public.hackathons h
  where h.id = v_hackathon;

  -- Before the deadline, an admin edit is ordinary; and a Sprint that is being
  -- deleted has no log to write to.
  if v_deadline is null or now() < v_deadline then
    return;
  end if;

  select coalesce(jsonb_object_agg(k, jsonb_build_object('old', p_old -> k, 'new', p_new -> k)), '{}'::jsonb)
  into v_changes
  from jsonb_object_keys(r) as k
  where k <> 'updated_at'
    and nullif(p_old -> k, 'null'::jsonb) is distinct from nullif(p_new -> k, 'null'::jsonb);

  if p_action = 'update' and v_changes = '{}'::jsonb then
    return;
  end if;

  if p_table = 'hackathon_submissions' then
    select coalesce(r ->> 'project_name', 'Submission') || ' (team ' || coalesce(t.name, '?') || ')'
    into v_subject
    from (select 1) one
    left join public.hackathon_teams t on t.id = (r ->> 'team_id')::uuid;
  else
    select coalesce(nullif(btrim(p.full_name), ''), p.username, 'A judge') || '''s score for '
           || coalesce(s.project_name, 'a submission')
    into v_subject
    from (select 1) one
    left join public.profiles p on p.id = (r ->> 'judge_id')::uuid
    left join public.hackathon_submissions s on s.id = (r ->> 'submission_id')::uuid;
  end if;

  v_actor := private.request_actor(p_role);

  insert into public.hackathon_admin_audit
    (hackathon_id, table_name, row_id, action, subject, changes, actor, db_role, deadline)
  values
    (v_hackathon, p_table, (r ->> 'id')::uuid, p_action, v_subject, v_changes, left(v_actor, 200), p_role, v_deadline);
end $$;

grant execute on all functions in schema private to anon, authenticated, service_role;

-- Resume a paused Sprint (018), now giving back whole minutes, rounded up.
-- A 40-second pause gives back 1 minute; times stay on the minute.
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

  shift := make_interval(mins => ceil(greatest(extract(epoch from now() - h.status_override_at), 0) / 60)::integer);
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

revoke execute on function public.hackathon_resume(uuid, boolean) from public, anon, authenticated;
grant execute on function public.hackathon_resume(uuid, boolean) to service_role;
