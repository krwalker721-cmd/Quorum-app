-- ---------------------------------------------------------------------------
-- 035 — A team's presentation: one PDF deck per submission (optional)
--
-- The team room (2026-10-17) gets a place to drop the team's deck. It's part
-- of the submission, so everything 020/030 say about submissions applies to
-- it unchanged: team members write it while the Sprint is live and not paused
-- (private.hackathon_submissions_guard); the team and admins read it at any
-- time, judges from the deadline, everyone from the reveal, and only if the
-- submission is complete (private.can_read_submission). It does NOT count
-- toward is_complete (owner: optional).
--
-- Files go to their own private bucket, hackathon-decks: PDFs only, up to
-- 25 MB, enforced by storage itself. The screenshots bucket stays images-only
-- at 5 MB. Same folder layout as screenshots: <sprint id>/<team id>/<file>.pdf.
--
-- hackathon_public_projects (032) gains the deck's path and name, so a
-- revealed project's public page can link it.
--
-- RUN AFTER 034. Idempotent.
-- ---------------------------------------------------------------------------

-- ============================================================================
-- The submission's deck
-- ============================================================================
alter table public.hackathon_submissions add column if not exists presentation_path text;
alter table public.hackathon_submissions add column if not exists presentation_name text;
alter table public.hackathon_submissions add column if not exists presentation_size integer;

alter table public.hackathon_submissions drop constraint if exists hackathon_submissions_presentation_name;
alter table public.hackathon_submissions add constraint hackathon_submissions_presentation_name
  check (presentation_name is null or char_length(presentation_name) between 1 and 200);
alter table public.hackathon_submissions drop constraint if exists hackathon_submissions_presentation_size;
alter table public.hackathon_submissions add constraint hackathon_submissions_presentation_size
  check (presentation_size is null or presentation_size between 1 and 26214400);

-- The deck must be a PDF in this team's folder; no path, no name or size.
-- Runs after the guard (trigger names sort), which already decided whether
-- this write is allowed at all.
create or replace function private.hackathon_submissions_presentation()
returns trigger language plpgsql set search_path = public as $$
begin
  new.presentation_path := nullif(btrim(new.presentation_path), '');
  new.presentation_name := nullif(btrim(new.presentation_name), '');
  if new.presentation_path is null then
    new.presentation_name := null;
    new.presentation_size := null;
    return new;
  end if;
  if new.presentation_path !~ ('^' || new.hackathon_id::text || '/' || new.team_id::text || '/[A-Za-z0-9._-]{1,200}\.pdf$') then
    raise exception 'The presentation must be a PDF uploaded to this team''s folder.' using hint = 'bad_presentation_path';
  end if;
  return new;
end $$;

drop trigger if exists hackathon_submissions_presentation_trigger on public.hackathon_submissions;
create trigger hackathon_submissions_presentation_trigger
  before insert or update on public.hackathon_submissions
  for each row execute function private.hackathon_submissions_presentation();

-- ============================================================================
-- Storage: decks
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hackathon-decks', 'hackathon-decks', false, 26214400, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hackathon_decks_read" on storage.objects;
create policy "hackathon_decks_read"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'hackathon-decks'
    and private.can_read_submission(private.submission_path_team(name), auth.uid())
  );

drop policy if exists "hackathon_decks_insert" on storage.objects;
create policy "hackathon_decks_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'hackathon-decks'
    and name ~ '\.pdf$'
    and private.can_write_submission(private.submission_path_team(name), auth.uid())
  );

drop policy if exists "hackathon_decks_update" on storage.objects;
create policy "hackathon_decks_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'hackathon-decks'
    and private.can_write_submission(private.submission_path_team(name), auth.uid())
  )
  with check (
    bucket_id = 'hackathon-decks'
    and name ~ '\.pdf$'
    and private.can_write_submission(private.submission_path_team(name), auth.uid())
  );

drop policy if exists "hackathon_decks_delete" on storage.objects;
create policy "hackathon_decks_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'hackathon-decks'
    and private.can_write_submission(private.submission_path_team(name), auth.uid())
  );

-- ============================================================================
-- Public projects: now with the deck (its return type changes, so recreate)
-- ============================================================================
drop function if exists public.hackathon_public_projects(uuid);
create function public.hackathon_public_projects(p_hackathon_id uuid)
returns table (
  submission_id     uuid,
  team_id           uuid,
  team_slug         text,
  team_name         text,
  team_emblem       text,
  team_color        text,
  project_name      text,
  tagline           text,
  problem           text,
  description       text,
  demo_url          text,
  repo_url          text,
  video_url         text,
  screenshots       text[],
  built_with        text[],
  completed_at      timestamptz,
  members           jsonb,
  presentation_path text,
  presentation_name text
)
language sql stable security definer set search_path = public as $$
  select
    s.id, t.id, t.slug, t.name, t.emblem, t.color,
    s.project_name, s.tagline, s.problem, s.description,
    s.demo_url, s.repo_url, s.video_url, s.screenshots, s.built_with, s.completed_at,
    coalesce((
      select jsonb_agg(
        case when private.is_approved_member(auth.uid()) then
          jsonb_build_object(
            'first_name', private.first_name(p.full_name),
            'id', p.id,
            'full_name', p.full_name,
            'username', p.username,
            'stage', p.stage)
        else
          jsonb_build_object('first_name', private.first_name(p.full_name))
        end
        order by (m.role = 'owner') desc, m.joined_at, m.user_id)
      from public.hackathon_team_members m
      join public.profiles p on p.id = m.user_id
      where m.team_id = t.id
    ), '[]'::jsonb),
    s.presentation_path, s.presentation_name
  from public.hackathon_submissions s
  join public.hackathon_teams t on t.id = s.team_id
  where s.hackathon_id = p_hackathon_id
    and s.is_complete
    and private.is_revealed(p_hackathon_id)
  order by s.completed_at, s.id
$$;

grant execute on all functions in schema private to anon, authenticated, service_role;
revoke execute on function public.hackathon_public_projects(uuid) from public;
grant execute on function public.hackathon_public_projects(uuid) to anon, authenticated, service_role;
