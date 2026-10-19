-- ---------------------------------------------------------------------------
-- 030 — Submission drafts: autosave, "complete", and drafts stay sealed
--
-- 020 had one submission per team where every saved row counted as
-- submitted, with the project name required. Phase 8 autosaves while the team
-- types, so a submission is now a draft until it's complete:
--
--   complete = project name, tagline and problem filled in, plus at least one
--              of demo URL, video URL or a screenshot.
--
-- is_complete is worked out by the guard trigger on every write (nobody sets
-- it), with completed_at for when it last became complete and
-- last_edited_by beside updated_at, so the form can say who edited last.
--
-- Who sees what (owner, Phase 8): the team and admins see the draft; judges
-- (from the deadline) and everyone (from the reveal) see a submission only if
-- it's complete. Screenshots follow the same rule, since the storage
-- policies use the same can_read_submission. An incomplete draft stays
-- sealed for good.
--
-- The deadline is 020's trigger, unchanged: a member's insert or update is
-- refused unless the Sprint is live and not paused. The admin console
-- (service role) can still correct after the deadline, audited (021).
--
-- "Submitted" everywhere (the arena's pulse, get_team_activity) now means
-- complete. hackathon_submissions joins realtime, so teammates see each
-- other's edits; realtime applies the same read policy.
--
-- RUN AFTER 029. Idempotent.
-- ---------------------------------------------------------------------------

alter table public.hackathon_submissions alter column project_name drop not null;
alter table public.hackathon_submissions add column if not exists is_complete boolean not null default false;
alter table public.hackathon_submissions add column if not exists completed_at timestamptz;
alter table public.hackathon_submissions
  add column if not exists last_edited_by uuid references public.profiles(id) on delete set null;

-- ============================================================================
-- The guard (020), plus tidying, completeness and who edited last
-- ============================================================================
create or replace function private.hackathon_submissions_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  v_hackathon uuid;
  v_phase text;
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.team_id := old.team_id;
    new.submitted_at := old.submitted_at;
    new.submitted_by := old.submitted_by;
  end if;
  v_hackathon := private.team_hackathon_id(new.team_id);
  if v_hackathon is null then
    raise exception 'That team doesn''t exist.';
  end if;
  new.hackathon_id := v_hackathon;
  -- The deadline. Checked before anything else so a late save always gets
  -- this answer.
  if current_user in ('anon', 'authenticated') then
    v_phase := private.hackathon_phase(v_hackathon);
    if not private.hackathon_writable(v_hackathon) then
      raise exception 'The Sprint is paused, so submissions are frozen.' using hint = 'sprint_frozen';
    elsif v_phase in ('draft', 'upcoming', 'registration', 'teams_locked') then
      raise exception 'Submissions open at kickoff.' using hint = 'submissions_not_open';
    elsif v_phase <> 'live' then
      raise exception 'The submission deadline has passed.' using hint = 'submissions_closed';
    end if;
    if tg_op = 'INSERT' then
      new.submitted_by := auth.uid();
      new.submitted_at := now();
    end if;
    new.last_edited_by := auth.uid();
  end if;
  new.updated_at := now();

  -- An emptied field is a missing one.
  new.project_name := nullif(btrim(new.project_name), '');
  new.tagline := nullif(btrim(new.tagline), '');
  new.problem := nullif(btrim(new.problem), '');
  new.description := nullif(btrim(new.description), '');
  new.demo_url := nullif(btrim(new.demo_url), '');
  new.repo_url := nullif(btrim(new.repo_url), '');
  new.video_url := nullif(btrim(new.video_url), '');

  if exists (
    select 1 from unnest(new.screenshots) p
    where p !~ ('^' || v_hackathon::text || '/' || new.team_id::text || '/[A-Za-z0-9._-]{1,200}$')
  ) then
    raise exception 'Screenshots must be uploaded to this team''s folder.' using hint = 'bad_screenshot_path';
  end if;
  -- Lower-case, trimmed, de-duplicated, first-seen order.
  new.built_with := array(
    select s from (
      select lower(btrim(x)) as s, min(ord) as o
      from unnest(new.built_with) with ordinality as u(x, ord)
      where btrim(x) <> ''
      group by 1
    ) q
    order by o
  );

  -- Complete: what it takes to count as submitted.
  new.is_complete := new.project_name is not null
    and new.tagline is not null
    and new.problem is not null
    and (new.demo_url is not null or new.video_url is not null or cardinality(new.screenshots) > 0);
  if not new.is_complete then
    new.completed_at := null;
  elsif tg_op = 'INSERT' or not old.is_complete then
    new.completed_at := now();
  else
    new.completed_at := old.completed_at;
  end if;
  return new;
end $$;

-- ============================================================================
-- Reading: drafts stay with the team
-- ============================================================================
create or replace function private.can_read_submission(p_team_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select private.is_team_member(t.id, uid)
      or private.is_admin(uid)
      or (
        exists (select 1 from public.hackathon_submissions s where s.team_id = t.id and s.is_complete)
        and (
          private.hackathon_phase(t.hackathon_id) = 'revealed'
          or (
            private.is_judge(t.hackathon_id, uid)
            and private.hackathon_phase(t.hackathon_id) in ('judging', 'revealed')
          )
        )
      )
    from public.hackathon_teams t
    where t.id = p_team_id
  ), false)
$$;

-- ============================================================================
-- "Submitted" means complete: the arena's pulse (027) and get_team_activity (020)
-- ============================================================================
create or replace function private.hackathon_team_pulse_bump()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_at timestamptz;
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

  if tg_table_name = 'hackathon_submissions' then
    -- Submitted follows completeness: a draft isn't, and emptying a required
    -- field takes it back.
    insert into public.hackathon_team_pulse as p (team_id, hackathon_id, activity_count, last_active_at, has_submitted, submitted_at)
    select t.id, t.hackathon_id, 1, v_at, new.is_complete, new.completed_at
    from public.hackathon_teams t
    where t.id = new.team_id
    on conflict (team_id) do update set
      activity_count = p.activity_count + 1,
      last_active_at = greatest(p.last_active_at, excluded.last_active_at),
      has_submitted  = excluded.has_submitted,
      submitted_at   = excluded.submitted_at,
      updated_at     = now();
    return null;
  end if;

  insert into public.hackathon_team_pulse as p (team_id, hackathon_id, activity_count, last_active_at)
  select t.id, t.hackathon_id, 1, v_at
  from public.hackathon_teams t
  where t.id = new.team_id
  on conflict (team_id) do update set
    activity_count = p.activity_count + 1,
    last_active_at = greatest(p.last_active_at, excluded.last_active_at),
    updated_at     = now();
  return null;
end $$;

create or replace function public.get_team_activity(p_hackathon_id uuid)
returns table (
  team_id        uuid,
  message_count  integer,
  doc_count      integer,
  link_count     integer,
  last_active_at timestamptz,
  has_submitted  boolean
)
language sql stable security definer set search_path = public as $$
  select
    t.id,
    (select count(*)::integer from public.hackathon_team_messages m
      where m.team_id = t.id and not m.is_system and m.deleted_at is null),
    (select count(*)::integer from public.hackathon_team_docs d where d.team_id = t.id),
    (select count(*)::integer from public.hackathon_team_links l where l.team_id = t.id),
    greatest(
      (select max(m.created_at) from public.hackathon_team_messages m where m.team_id = t.id and not m.is_system),
      (select max(d.updated_at) from public.hackathon_team_docs d where d.team_id = t.id),
      (select max(l.created_at) from public.hackathon_team_links l where l.team_id = t.id),
      (select max(v.created_at) from public.hackathon_team_votes v where v.team_id = t.id),
      (select max(b.updated_at) from public.hackathon_team_ballots b where b.team_id = t.id),
      (select s.updated_at from public.hackathon_submissions s where s.team_id = t.id)
    ),
    exists (select 1 from public.hackathon_submissions s where s.team_id = t.id and s.is_complete)
  from public.hackathon_teams t
  where t.hackathon_id = p_hackathon_id
    and private.can_view_arena(p_hackathon_id, auth.uid())
  order by t.created_at, t.id
$$;

-- ============================================================================
-- Every existing submission, worked out once (the guard does it from now on)
-- ============================================================================
-- Without the triggers: this isn't anyone editing a submission, so it mustn't
-- move updated_at, bump the arena's pulse, or land in the after-deadline
-- audit (021). One transaction, so they're never off for anyone else.
alter table public.hackathon_submissions disable trigger hackathon_submissions_guard_trigger;
alter table public.hackathon_submissions disable trigger hackathon_submissions_audit_trigger;
alter table public.hackathon_submissions disable trigger hackathon_team_pulse_submissions_trigger;

update public.hackathon_submissions s set
  is_complete = x.complete,
  completed_at = case when x.complete then coalesce(s.completed_at, s.updated_at) end
from (
  select id,
    project_name is not null and nullif(btrim(tagline), '') is not null and nullif(btrim(problem), '') is not null
      and (nullif(btrim(demo_url), '') is not null or nullif(btrim(video_url), '') is not null or cardinality(screenshots) > 0)
      as complete
  from public.hackathon_submissions
) x
where x.id = s.id
  and (s.is_complete is distinct from x.complete or (x.complete and s.completed_at is null));

alter table public.hackathon_submissions enable trigger hackathon_submissions_guard_trigger;
alter table public.hackathon_submissions enable trigger hackathon_submissions_audit_trigger;
alter table public.hackathon_submissions enable trigger hackathon_team_pulse_submissions_trigger;

update public.hackathon_team_pulse p set
  has_submitted = coalesce(s.is_complete, false),
  submitted_at = s.completed_at,
  updated_at = now()
from public.hackathon_teams t
left join public.hackathon_submissions s on s.team_id = t.id
where p.team_id = t.id
  and (p.has_submitted is distinct from coalesce(s.is_complete, false) or p.submitted_at is distinct from s.completed_at);

-- ============================================================================
-- Grants and realtime
-- ============================================================================
grant execute on all functions in schema private to anon, authenticated, service_role;
revoke execute on function public.get_team_activity(uuid) from public, anon;
grant execute on function public.get_team_activity(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.hackathon_submissions;
exception when duplicate_object then null;
end $$;
