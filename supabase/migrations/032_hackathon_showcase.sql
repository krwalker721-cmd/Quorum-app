-- ---------------------------------------------------------------------------
-- 032 — The public showcase: what anyone may see once a Sprint is revealed
--
-- Phase 10 makes each project page and each Sprint's recap public, signed out
-- included, after the reveal: they're what gets shared. Signed-out visitors
-- can already read complete submissions, their screenshots and finalized
-- awards from the reveal (020, 030, 031), but not teams, team members or
-- profiles, which stay limited to the arena's audience. Rather than opening
-- those tables, three narrow functions give out exactly the showcase:
--
--   hackathon_public_sprint(number)   the Sprint and its recap numbers
--   hackathon_public_projects(id)     complete submissions with their team
--   hackathon_public_sitemap()        revealed Sprints and their project slugs
--
-- Each answers only for a published Sprint revealed on its own clock (the
-- same test as the submissions' read policy), so a Sprint paused or cancelled
-- before its reveal stays sealed. Drafts never appear.
--
-- People: a signed-out caller (or an account not yet approved) gets each
-- builder's first name only. An approved member also gets the full name,
-- username (for profile links) and stage, which members can read anyway.
-- Cohorts appear only as a count; cohort names stay with members
-- (hackathon_arena_cohorts, 027).
--
-- RUN AFTER 031. Idempotent.
-- ---------------------------------------------------------------------------

create or replace function private.is_revealed(p_hackathon_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.hackathon_phase(p_hackathon_id) = 'revealed', false)
$$;

create or replace function private.is_approved_member(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select uid is not null and exists (select 1 from public.profiles p where p.id = uid and p.status = 'approved')
$$;

-- A first name to show signed out: the first word of the full name.
create or replace function private.first_name(p_full_name text)
returns text language sql immutable as $$
  select coalesce(nullif(split_part(btrim(coalesce(p_full_name, '')), ' ', 1), ''), 'A builder')
$$;

-- ============================================================================
-- The Sprint and its recap numbers
-- ============================================================================
create or replace function public.hackathon_public_sprint(p_number integer)
returns table (
  id          uuid,
  number      integer,
  slug        text,
  title       text,
  tagline     text,
  theme       text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  reveal_at   timestamptz,
  teams       integer,
  builders    integer,
  cohorts     integer,
  shipped     integer
)
language sql stable security definer set search_path = public as $$
  select
    h.id, h.number, h.slug, h.title, h.tagline, h.theme_hidden,
    h.starts_at, h.ends_at, h.reveal_at,
    (select count(*)::integer from public.hackathon_teams t where t.hackathon_id = h.id),
    (select count(*)::integer from public.hackathon_team_members m where m.hackathon_id = h.id),
    (select count(distinct c.cohort_id)::integer
       from public.hackathon_team_members m
       join public.cohort_members c on c.user_id = m.user_id
      where m.hackathon_id = h.id and c.cohort_id is not null),
    (select count(*)::integer from public.hackathon_submissions s where s.hackathon_id = h.id and s.is_complete)
  from public.hackathons h
  where h.number = p_number
    and private.is_revealed(h.id)
$$;

-- ============================================================================
-- Complete submissions, with their team
-- ============================================================================
create or replace function public.hackathon_public_projects(p_hackathon_id uuid)
returns table (
  submission_id uuid,
  team_id       uuid,
  team_slug     text,
  team_name     text,
  team_emblem   text,
  team_color    text,
  project_name  text,
  tagline       text,
  problem       text,
  description   text,
  demo_url      text,
  repo_url      text,
  video_url     text,
  screenshots   text[],
  built_with    text[],
  completed_at  timestamptz,
  members       jsonb
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
    ), '[]'::jsonb)
  from public.hackathon_submissions s
  join public.hackathon_teams t on t.id = s.team_id
  where s.hackathon_id = p_hackathon_id
    and s.is_complete
    and private.is_revealed(p_hackathon_id)
  order by s.completed_at, s.id
$$;

-- ============================================================================
-- The sitemap: revealed Sprints and their project pages
-- ============================================================================
create or replace function public.hackathon_public_sitemap()
returns table (number integer, reveal_at timestamptz, team_slugs text[])
language sql stable security definer set search_path = public as $$
  select h.number, h.reveal_at,
    coalesce(array(
      select t.slug
      from public.hackathon_submissions s
      join public.hackathon_teams t on t.id = s.team_id
      where s.hackathon_id = h.id and s.is_complete
      order by t.slug
    ), '{}')
  from public.hackathons h
  where private.is_revealed(h.id)
  order by h.number
$$;

-- ============================================================================
-- Grants
-- ============================================================================
grant execute on all functions in schema private to anon, authenticated, service_role;

revoke execute on function public.hackathon_public_sprint(integer) from public;
grant execute on function public.hackathon_public_sprint(integer) to anon, authenticated, service_role;
revoke execute on function public.hackathon_public_projects(uuid) from public;
grant execute on function public.hackathon_public_projects(uuid) to anon, authenticated, service_role;
revoke execute on function public.hackathon_public_sitemap() from public;
grant execute on function public.hackathon_public_sitemap() to anon, authenticated, service_role;
