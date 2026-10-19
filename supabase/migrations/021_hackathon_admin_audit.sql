-- ---------------------------------------------------------------------------
-- 021 — Audit log for admin edits made after a deadline
--
-- Members can't touch a submission after ends_at, or a score after
-- judging_ends_at: the 020 triggers refuse them. The admin console (service
-- role) and the SQL editor can, on purpose, so a genuine mistake can be fixed.
-- Every such fix is recorded here, with who made it, what changed (old → new,
-- field by field), and when. The admin console shows the log.
--
-- "Who": the admin console signs in with one shared code, not personal
-- accounts, so the database can't name a person. It records the channel
-- ("admin console" for the service role, "database (postgres)" for the SQL
-- editor) unless the caller supplies a label, either with
--   select set_config('hackathon.actor', 'Keaton, fixing a typo', true);
-- in the SQL editor, or with an `x-quorum-actor` request header from a
-- server route. Headers only matter here for service-role requests, which
-- never come from a browser.
--
-- The log is append-only: nobody can edit or delete an entry through the API,
-- and the table refuses updates and deletes outright. The one exception is
-- deleting a whole Sprint, which takes its log with it.
--
-- RUN AFTER 020. Idempotent.
-- ---------------------------------------------------------------------------

create table if not exists public.hackathon_admin_audit (
  id           bigint generated always as identity primary key,
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  table_name   text not null check (table_name in ('hackathon_submissions', 'hackathon_scores')),
  row_id       uuid not null,
  action       text not null check (action in ('insert', 'update', 'delete')),
  -- What was edited, in words, captured at the time: "NightOwl (team Rockets)"
  -- or "Jude Judge's score for NightOwl".
  subject      text not null,
  -- {"field": {"old": …, "new": …}} for every field that changed.
  changes      jsonb not null,
  actor        text not null,
  db_role      text not null,
  -- The deadline that had passed when the edit was made.
  deadline     timestamptz not null,
  created_at   timestamptz not null default now()
);
create index if not exists hackathon_admin_audit_created_idx
  on public.hackathon_admin_audit (created_at desc);
create index if not exists hackathon_admin_audit_hackathon_idx
  on public.hackathon_admin_audit (hackathon_id, created_at desc);

alter table public.hackathon_admin_audit enable row level security;

-- Written only by the trigger below (as the table owner). Readable by admins.
revoke insert, update, delete, truncate on public.hackathon_admin_audit from anon, authenticated, service_role;

drop policy if exists "hackathon_admin_audit_read_admins" on public.hackathon_admin_audit;
create policy "hackathon_admin_audit_read_admins"
  on public.hackathon_admin_audit for select to authenticated
  using (private.is_admin(auth.uid()));

create or replace function private.hackathon_admin_audit_append_only()
returns trigger language plpgsql set search_path = public as $$
begin
  -- A Sprint being deleted takes its log with it (the cascade runs after the
  -- Sprint row is gone). Nothing else may remove or rewrite an entry.
  if tg_op = 'DELETE' and not exists (select 1 from public.hackathons h where h.id = old.hackathon_id) then
    return old;
  end if;
  raise exception 'The admin audit log is append-only.';
end $$;

drop trigger if exists hackathon_admin_audit_append_only_trigger on public.hackathon_admin_audit;
create trigger hackathon_admin_audit_append_only_trigger
  before update or delete on public.hackathon_admin_audit
  for each row execute function private.hackathon_admin_audit_append_only();

-- Does the logging. SECURITY DEFINER so it can write the log; only ever
-- called from the trigger below, which passes the caller's role.
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
  v_headers text := nullif(current_setting('request.headers', true), '');
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
  where k <> 'updated_at' and (p_old -> k) is distinct from (p_new -> k);

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

  v_actor := coalesce(
    nullif(btrim(current_setting('hackathon.actor', true)), ''),
    nullif(btrim(v_headers::jsonb ->> 'x-quorum-actor'), ''),
    case p_role when 'service_role' then 'admin console' else 'database (' || p_role || ')' end
  );

  insert into public.hackathon_admin_audit
    (hackathon_id, table_name, row_id, action, subject, changes, actor, db_role, deadline)
  values
    (v_hackathon, p_table, (r ->> 'id')::uuid, p_action, v_subject, v_changes, left(v_actor, 200), p_role, v_deadline);
end $$;

-- Not SECURITY DEFINER: current_user must be the real caller. Members' edits
-- are left alone here; after a deadline the 020 triggers have already
-- refused them.
create or replace function private.hackathon_audit_admin_edit()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') then
    return null;
  end if;
  perform private.log_hackathon_admin_edit(
    tg_table_name,
    lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    current_user::text
  );
  return null;
end $$;

drop trigger if exists hackathon_submissions_audit_trigger on public.hackathon_submissions;
create trigger hackathon_submissions_audit_trigger
  after insert or update or delete on public.hackathon_submissions
  for each row execute function private.hackathon_audit_admin_edit();

drop trigger if exists hackathon_scores_audit_trigger on public.hackathon_scores;
create trigger hackathon_scores_audit_trigger
  after insert or update or delete on public.hackathon_scores
  for each row execute function private.hackathon_audit_admin_edit();

grant execute on all functions in schema private to anon, authenticated, service_role;
