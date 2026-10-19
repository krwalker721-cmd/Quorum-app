-- ---------------------------------------------------------------------------
-- 031 — Judging: finalized awards, award rules, scoring complete work only
--
-- 020 built the scores (four 1–5 scores and private notes, written between
-- the deadline and judging_ends_at) and the awards (public at the reveal).
-- Phase 9 adds the judges' screens and the admin's results and award board,
-- and with them:
--
--  * Finalizing. The admin builds the award list during judging, then
--    finalizes it (hackathon_finalize_awards). The public sees awards only
--    once the Sprint is revealed AND its awards are finalized, so a half-made
--    list never leaks at the reveal. A finalized list is locked; reopening it
--    (hackathon_unfinalize_awards) unlocks it, and hides it again if the
--    Sprint is already revealed. Both are service role only, and both land in
--    admin_change_log through the existing hackathons trigger.
--
--  * Award rules, enforced by a trigger: only for a complete submission, only
--    once submissions have closed (on the Sprint's own clock), never while
--    the list is finalized. Each named award (Judges' pick, Most shipped,
--    Best collaboration, Most likely to become real) has exactly one winner
--    per Sprint (owner, Phase 9); custom awards are unlimited. An optional
--    citation (280 characters) says why it won.
--
--  * Judges score complete submissions only. A judge can't read a draft
--    (030), but could have scored one by guessing its id.
--
--  * Award changes are written to admin_change_log under a new "award" area,
--    like every other admin change (022).
--
-- Judges are still hackathon_judges rows with a user_id and accepted_at;
-- nothing here assumes a judge is a paying member, so the external-judge
-- accounts deferred to Sprint #2 (decision 14) slot in without changes.
--
-- RUN AFTER 030. Idempotent.
-- ---------------------------------------------------------------------------

-- ============================================================================
-- 1. Finalizing
-- ============================================================================
alter table public.hackathons add column if not exists awards_finalized_at timestamptz;
alter table public.hackathons
  add column if not exists awards_finalized_by uuid references public.profiles(id) on delete set null;
-- When they were finalized is readable (the Sprint page uses it, so an admin,
-- who can read every award, sees only what the public will); who finalized
-- them isn't. The table's reads are column-by-column (018).
grant select (awards_finalized_at) on public.hackathons to anon, authenticated;

create or replace function private.awards_final(p_hackathon_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select h.awards_finalized_at is not null from public.hackathons h where h.id = p_hackathon_id
  ), false)
$$;

create or replace function public.hackathon_finalize_awards(p_hackathon_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  h public.hackathons%rowtype;
begin
  select * into h from public.hackathons where id = p_hackathon_id for update;
  if not found then
    raise exception 'That Sprint doesn''t exist.';
  end if;
  if h.awards_finalized_at is not null then
    return h.awards_finalized_at;
  end if;
  if h.status_override = 'cancelled' then
    raise exception 'This Sprint was cancelled, so it has no awards.' using hint = 'sprint_cancelled';
  end if;
  if private.hackathon_phase(h.id) not in ('judging', 'revealed') then
    raise exception 'Awards can be finalized once submissions close.' using hint = 'awards_too_early';
  end if;
  update public.hackathons
  set awards_finalized_at = now(), awards_finalized_by = private.request_actor_id()
  where id = p_hackathon_id;
  return now();
end $$;

create or replace function public.hackathon_unfinalize_awards(p_hackathon_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.hackathons
  set awards_finalized_at = null, awards_finalized_by = null
  where id = p_hackathon_id and awards_finalized_at is not null;
  if not found and not exists (select 1 from public.hackathons where id = p_hackathon_id) then
    raise exception 'That Sprint doesn''t exist.';
  end if;
end $$;

-- ============================================================================
-- 2. Awards: citation, one winner per named award, the rules
-- ============================================================================
alter table public.hackathon_awards add column if not exists citation text;
alter table public.hackathon_awards drop constraint if exists hackathon_awards_citation_length;
alter table public.hackathon_awards add constraint hackathon_awards_citation_length
  check (citation is null or char_length(citation) <= 280);
alter table public.hackathon_awards add column if not exists updated_at timestamptz not null default now();

create unique index if not exists hackathon_awards_one_winner
  on public.hackathon_awards (hackathon_id, award_type) where award_type <> 'custom';

create or replace function private.hackathon_awards_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r public.hackathon_awards%rowtype;
begin
  if tg_op = 'DELETE' then
    r := old;
  else
    r := new;
  end if;

  -- A Sprint (or a submission) being deleted takes its awards with it.
  if tg_op = 'DELETE' and (
    not exists (select 1 from public.hackathons h where h.id = old.hackathon_id)
    or not exists (select 1 from public.hackathon_submissions s where s.id = old.submission_id)
  ) then
    return old;
  end if;

  if private.awards_final(r.hackathon_id)
    or (tg_op = 'UPDATE' and private.awards_final(old.hackathon_id)) then
    raise exception 'The awards are finalized. Reopen them to make changes.' using hint = 'awards_finalized';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  new.custom_label := nullif(btrim(new.custom_label), '');
  new.citation := nullif(btrim(new.citation), '');

  if private.hackathon_phase(new.hackathon_id) not in ('judging', 'revealed') then
    raise exception 'Awards can be given once submissions close.' using hint = 'awards_too_early';
  end if;
  if not exists (
    select 1 from public.hackathon_submissions s
    where s.id = new.submission_id and s.hackathon_id = new.hackathon_id and s.is_complete
  ) then
    raise exception 'Only a complete submission can win an award.' using hint = 'award_needs_complete';
  end if;
  return new;
end $$;

drop trigger if exists hackathon_awards_guard_trigger on public.hackathon_awards;
create trigger hackathon_awards_guard_trigger
  before insert or update or delete on public.hackathon_awards
  for each row execute function private.hackathon_awards_guard();

-- Everyone sees the awards once the Sprint is revealed (on its own clock) and
-- they're finalized; admins always.
drop policy if exists "hackathon_awards_read" on public.hackathon_awards;
create policy "hackathon_awards_read"
  on public.hackathon_awards for select to anon, authenticated
  using (
    (private.hackathon_phase(hackathon_id) = 'revealed' and private.awards_final(hackathon_id))
    or private.is_admin(auth.uid())
  );

-- ============================================================================
-- 3. Scores: complete submissions only
-- ============================================================================
-- Looked up past RLS, so a caller who can't read the submission at all (not
-- a judge) gets row-level security's refusal, not a misleading "draft".
create or replace function private.submission_is_complete(p_submission_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.is_complete from public.hackathon_submissions s where s.id = p_submission_id), false)
$$;

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

  if current_user in ('anon', 'authenticated') then
    if not private.scoring_open(new.hackathon_id) then
      raise exception 'Scoring is closed for this Sprint.' using hint = 'scoring_closed';
    end if;
    if not private.submission_is_complete(new.submission_id) then
      raise exception 'Only complete submissions are judged.' using hint = 'score_needs_complete';
    end if;
  end if;
  new.notes := nullif(btrim(new.notes), '');
  return new;
end $$;

-- ============================================================================
-- 4. Award changes in the admin change log (022)
-- ============================================================================
alter table public.admin_change_log drop constraint if exists admin_change_log_area_check;
alter table public.admin_change_log add constraint admin_change_log_area_check
  check (area in ('sprint', 'countdown', 'team', 'member', 'registration', 'judge', 'lobby', 'award'));

create or replace function private.write_award_change(p_action text, p_old jsonb, p_new jsonb, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r jsonb := coalesce(p_new, p_old);
  v_changes jsonb;
  v_subject text;
begin
  select coalesce(jsonb_object_agg(k, jsonb_build_object('old', p_old -> k, 'new', p_new -> k)), '{}'::jsonb)
  into v_changes
  from jsonb_object_keys(r) as k
  where k not in ('updated_at', 'created_at')
    and nullif(p_old -> k, 'null'::jsonb) is distinct from nullif(p_new -> k, 'null'::jsonb);
  if p_action = 'update' and v_changes = '{}'::jsonb then
    return;
  end if;

  select case r ->> 'award_type'
           when 'judges_pick' then 'Judges'' pick'
           when 'most_shipped' then 'Most shipped'
           when 'best_collaboration' then 'Best collaboration'
           when 'most_likely_to_become_real' then 'Most likely to become real'
           else coalesce(r ->> 'custom_label', 'Award')
         end
         || ' → ' || coalesce(s.project_name, 'a submission')
         || coalesce(' (team ' || t.name || ')', '')
         || coalesce(' (Sprint #' || h.number || ')', '')
  into v_subject
  from (select 1) one
  left join public.hackathon_submissions s on s.id = (r ->> 'submission_id')::uuid
  left join public.hackathon_teams t on t.id = s.team_id
  left join public.hackathons h on h.id = (r ->> 'hackathon_id')::uuid;

  insert into public.admin_change_log
    (area, table_name, row_id, hackathon_id, action, summary, subject, changes, actor, actor_id, db_role)
  values (
    'award', 'hackathon_awards', coalesce(r ->> 'id', '?'), (r ->> 'hackathon_id')::uuid, p_action,
    left(private.request_action(), 300), left(v_subject, 300), v_changes,
    left(private.request_actor(p_role), 200), private.request_actor_id(), p_role
  );
end $$;

-- Not SECURITY DEFINER, so current_user is the real caller. Only the admin
-- console and the SQL editor can write awards, so every change is logged.
create or replace function private.log_award_change()
returns trigger language plpgsql set search_path = public as $$
begin
  perform private.write_award_change(
    lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    current_user::text
  );
  return null;
end $$;

drop trigger if exists hackathon_awards_admin_log_trigger on public.hackathon_awards;
create trigger hackathon_awards_admin_log_trigger
  after insert or update or delete on public.hackathon_awards
  for each row execute function private.log_award_change();

-- ============================================================================
-- 5. Backfill: Sprints already revealed keep showing their awards
-- ============================================================================
-- Only staging has any (production has no Sprints yet). Done quietly: it
-- isn't an admin's decision, so it isn't written to the change log.
alter table public.hackathons disable trigger hackathons_admin_log_trigger;
update public.hackathons h
set awards_finalized_at = h.reveal_at
where h.awards_finalized_at is null
  and private.hackathon_phase(h.id) = 'revealed'
  and exists (select 1 from public.hackathon_awards a where a.hackathon_id = h.id);
alter table public.hackathons enable trigger hackathons_admin_log_trigger;

-- ============================================================================
-- Grants
-- ============================================================================
grant execute on all functions in schema private to anon, authenticated, service_role;

revoke execute on function public.hackathon_finalize_awards(uuid) from public, anon, authenticated;
grant execute on function public.hackathon_finalize_awards(uuid) to service_role;
revoke execute on function public.hackathon_unfinalize_awards(uuid) from public, anon, authenticated;
grant execute on function public.hackathon_unfinalize_awards(uuid) to service_role;
