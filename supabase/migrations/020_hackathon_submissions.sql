-- ---------------------------------------------------------------------------
-- 020 — Hackathon submissions, screenshots, judging, awards, activity pulse
--
-- One submission per team. Before the reveal it is sealed: readable only by
-- the team, admins, and (from the deadline) the Sprint's accepted judges. From
-- reveal_at it is public, signed out included, for the showcase pages.
-- "Reveal" uses the Sprint's own clock, so a Sprint paused or cancelled before
-- reveal_at stays sealed.
--
-- The deadline is enforced by a trigger that raises, not only by a policy: a
-- team member's insert or update is refused unless the Sprint is live on the
-- database clock (and not paused). The admin console (service role) can still
-- correct a submission after the deadline.
--
-- Screenshots live in the private `hackathon-submissions` storage bucket at
-- {hackathon_id}/{team_id}/{file}, with the same visibility as the submission.
-- Public pages show them through signed URLs.
--
-- Scores are private to the judge who wrote them (and admins), and can only be
-- written between ends_at and judging_ends_at. Awards are public from the
-- reveal.
--
-- RUN AFTER 018 and 019. Idempotent.
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Tables
-- ============================================================================
create table if not exists public.hackathon_submissions (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null unique,
  hackathon_id uuid not null,
  project_name text not null check (char_length(btrim(project_name)) between 1 and 80),
  tagline      text check (tagline is null or char_length(tagline) <= 140),
  description  text check (description is null or char_length(description) <= 20000),
  problem      text check (problem is null or char_length(problem) <= 5000),
  demo_url     text check (demo_url is null or (demo_url ~* '^https?://[^[:space:]]+$' and char_length(demo_url) <= 2000)),
  repo_url     text check (repo_url is null or (repo_url ~* '^https?://[^[:space:]]+$' and char_length(repo_url) <= 2000)),
  video_url    text check (video_url is null or (video_url ~* '^https?://[^[:space:]]+$' and char_length(video_url) <= 2000)),
  -- Storage paths in the hackathon-submissions bucket, inside this team's folder.
  screenshots  text[] not null default '{}' check (cardinality(screenshots) <= 6),
  built_with   text[] not null default '{}' check (cardinality(built_with) <= 20),
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (team_id, hackathon_id)
    references public.hackathon_teams (id, hackathon_id) on delete cascade,
  unique (id, hackathon_id)
);
create index if not exists hackathon_submissions_hackathon_idx
  on public.hackathon_submissions (hackathon_id);

create table if not exists public.hackathon_scores (
  id                  uuid primary key default gen_random_uuid(),
  submission_id       uuid not null,
  hackathon_id        uuid not null,
  judge_id            uuid not null references public.profiles(id) on delete cascade,
  score_problem       smallint not null check (score_problem between 1 and 5),
  score_shipped       smallint not null check (score_shipped between 1 and 5),
  score_collaboration smallint not null check (score_collaboration between 1 and 5),
  score_potential     smallint not null check (score_potential between 1 and 5),
  notes               text check (notes is null or char_length(notes) <= 5000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  foreign key (submission_id, hackathon_id)
    references public.hackathon_submissions (id, hackathon_id) on delete cascade,
  unique (submission_id, judge_id)
);
create index if not exists hackathon_scores_hackathon_idx
  on public.hackathon_scores (hackathon_id);

create table if not exists public.hackathon_awards (
  id            uuid primary key default gen_random_uuid(),
  hackathon_id  uuid not null references public.hackathons(id) on delete cascade,
  submission_id uuid not null,
  award_type    text not null check (award_type in (
    'judges_pick', 'most_shipped', 'best_collaboration', 'most_likely_to_become_real', 'custom'
  )),
  custom_label  text check (custom_label is null or char_length(btrim(custom_label)) between 1 and 80),
  created_at    timestamptz not null default now(),
  foreign key (submission_id, hackathon_id)
    references public.hackathon_submissions (id, hackathon_id) on delete cascade,
  constraint hackathon_awards_custom_label check ((award_type = 'custom') = (custom_label is not null)),
  unique nulls not distinct (submission_id, award_type, custom_label)
);
create index if not exists hackathon_awards_hackathon_idx
  on public.hackathon_awards (hackathon_id);

-- ============================================================================
-- Access helpers
-- ============================================================================

create or replace function private.can_read_submission(p_team_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select private.is_team_member(t.id, uid)
      or private.is_admin(uid)
      or private.hackathon_phase(t.hackathon_id) = 'revealed'
      or (
        private.is_judge(t.hackathon_id, uid)
        and private.hackathon_phase(t.hackathon_id) in ('judging', 'revealed')
      )
    from public.hackathon_teams t
    where t.id = p_team_id
  ), false)
$$;

create or replace function private.can_write_submission(p_team_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select private.is_team_member(t.id, uid)
      and private.hackathon_writable(t.hackathon_id)
      and private.hackathon_phase(t.hackathon_id) = 'live'
    from public.hackathon_teams t
    where t.id = p_team_id
  ), false)
$$;

-- The team a storage path belongs to, or NULL unless the path is exactly
-- {hackathon_id}/{team_id}/{file} for a real team of that Sprint. The CASE
-- keeps a malformed path from ever reaching the uuid cast.
create or replace function private.submission_path_team(p_name text)
returns uuid language sql stable security definer set search_path = public as $$
  select t.id
  from public.hackathon_teams t
  where t.id = (
      case
        when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,200}$'
        then split_part(p_name, '/', 2)::uuid
      end
    )
    and t.hackathon_id::text = split_part(p_name, '/', 1)
$$;

create or replace function private.submission_hackathon_id(p_submission_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select s.hackathon_id from public.hackathon_submissions s where s.id = p_submission_id
$$;

-- Scoring is open from the deadline until judging_ends_at, and not while the
-- Sprint is paused or cancelled.
create or replace function private.scoring_open(p_hackathon_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select private.hackathon_writable(h.id) and now() >= h.ends_at and now() < h.judging_ends_at
    from public.hackathons h
    where h.id = p_hackathon_id
  ), false)
$$;

-- ============================================================================
-- Triggers
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
  end if;
  new.updated_at := now();

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
  return new;
end $$;

drop trigger if exists hackathon_submissions_guard_trigger on public.hackathon_submissions;
create trigger hackathon_submissions_guard_trigger
  before insert or update on public.hackathon_submissions
  for each row execute function private.hackathon_submissions_guard();

create or replace function private.hackathon_scores_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.submission_id := old.submission_id;
    new.judge_id := old.judge_id;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  new.updated_at := now();

  new.hackathon_id := private.submission_hackathon_id(new.submission_id);
  if new.hackathon_id is null then
    raise exception 'That submission doesn''t exist.';
  end if;

  if current_user in ('anon', 'authenticated') and not private.scoring_open(new.hackathon_id) then
    raise exception 'Scoring is closed for this Sprint.' using hint = 'scoring_closed';
  end if;
  return new;
end $$;

drop trigger if exists hackathon_scores_guard_trigger on public.hackathon_scores;
create trigger hackathon_scores_guard_trigger
  before insert or update on public.hackathon_scores
  for each row execute function private.hackathon_scores_guard();

-- ============================================================================
-- Row level security
-- ============================================================================
alter table public.hackathon_submissions enable row level security;
alter table public.hackathon_scores enable row level security;
alter table public.hackathon_awards enable row level security;

drop policy if exists "hackathon_submissions_read" on public.hackathon_submissions;
create policy "hackathon_submissions_read"
  on public.hackathon_submissions for select to anon, authenticated
  using (private.can_read_submission(team_id, auth.uid()));

drop policy if exists "hackathon_submissions_insert_team" on public.hackathon_submissions;
create policy "hackathon_submissions_insert_team"
  on public.hackathon_submissions for insert to authenticated
  with check (private.is_team_member(team_id, auth.uid()));

drop policy if exists "hackathon_submissions_update_team" on public.hackathon_submissions;
create policy "hackathon_submissions_update_team"
  on public.hackathon_submissions for update to authenticated
  using (private.is_team_member(team_id, auth.uid()))
  with check (private.is_team_member(team_id, auth.uid()));
-- No delete policy: a submission, once made, stays.

drop policy if exists "hackathon_scores_read_own" on public.hackathon_scores;
create policy "hackathon_scores_read_own"
  on public.hackathon_scores for select to authenticated
  using (judge_id = auth.uid() or private.is_admin(auth.uid()));

drop policy if exists "hackathon_scores_insert_judge" on public.hackathon_scores;
create policy "hackathon_scores_insert_judge"
  on public.hackathon_scores for insert to authenticated
  with check (judge_id = auth.uid() and private.is_judge(hackathon_id, auth.uid()));

drop policy if exists "hackathon_scores_update_judge" on public.hackathon_scores;
create policy "hackathon_scores_update_judge"
  on public.hackathon_scores for update to authenticated
  using (judge_id = auth.uid())
  with check (judge_id = auth.uid() and private.is_judge(hackathon_id, auth.uid()));

-- Awards are written by the admin console; everyone can see them once the
-- Sprint is revealed.
drop policy if exists "hackathon_awards_read" on public.hackathon_awards;
create policy "hackathon_awards_read"
  on public.hackathon_awards for select to anon, authenticated
  using (
    private.hackathon_phase(hackathon_id) = 'revealed'
    or private.is_admin(auth.uid())
  );

-- ============================================================================
-- Storage: screenshots
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hackathon-submissions', 'hackathon-submissions', false, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hackathon_submissions_files_read" on storage.objects;
create policy "hackathon_submissions_files_read"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'hackathon-submissions'
    and private.can_read_submission(private.submission_path_team(name), auth.uid())
  );

drop policy if exists "hackathon_submissions_files_insert" on storage.objects;
create policy "hackathon_submissions_files_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'hackathon-submissions'
    and private.can_write_submission(private.submission_path_team(name), auth.uid())
  );

drop policy if exists "hackathon_submissions_files_update" on storage.objects;
create policy "hackathon_submissions_files_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'hackathon-submissions'
    and private.can_write_submission(private.submission_path_team(name), auth.uid())
  )
  with check (
    bucket_id = 'hackathon-submissions'
    and private.can_write_submission(private.submission_path_team(name), auth.uid())
  );

drop policy if exists "hackathon_submissions_files_delete" on storage.objects;
create policy "hackathon_submissions_files_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'hackathon-submissions'
    and private.can_write_submission(private.submission_path_team(name), auth.uid())
  );

-- ============================================================================
-- Activity pulse for the sealed arena
-- ============================================================================
-- Per team: how busy it is and whether it has submitted. Counts and
-- timestamps only, never content, so spectators can see a team working
-- without seeing what it's building. Same audience as the arena itself.
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
    exists (select 1 from public.hackathon_submissions s where s.team_id = t.id)
  from public.hackathon_teams t
  where t.hackathon_id = p_hackathon_id
    and private.can_view_arena(p_hackathon_id, auth.uid())
  order by t.created_at, t.id
$$;

-- ============================================================================
-- Grants
-- ============================================================================
grant execute on all functions in schema private to anon, authenticated, service_role;

revoke execute on function public.get_team_activity(uuid) from public, anon;
grant execute on function public.get_team_activity(uuid) to authenticated;
