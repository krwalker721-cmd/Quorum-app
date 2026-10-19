-- ---------------------------------------------------------------------------
-- 036 — Peer reviews: the competitors judge, and the awards work themselves out
--
-- Owner, 2026-10-18: judging by the builders, not judges, "so it feels more
-- like a community". At the deadline every participant is handed a few other
-- teams' projects to review (never their own team's, never chosen by them):
-- three 1–5 ratings, two optional lines of feedback, and one favourite among
-- those they saw. At the reveal the awards are computed and published with no
-- manual step. Teams read their feedback anonymously after the reveal.
--
--  * hackathons.reviews_per_person: how many projects each person reviews
--    (default 6, set per Sprint). hackathons.reviews_assigned_at: when they
--    were handed out (once).
--  * hackathon_reviews: one row per (reviewer, submission), written by
--    hackathon_assign_reviews (service role), then filled in by the reviewer
--    while scoring is open (the judging window: deadline to judging end, not
--    paused). Reviewers read only their own rows; admins read all and may
--    hide an abusive one (hidden_at).
--  * Assignment is balanced: reviewers in random order, each takes the
--    eligible complete projects that have the fewest reviewers so far.
--  * Scoring (hackathon_review_standings): completed, visible reviews only.
--    Each rating is adjusted by the reviewer's own lean (their average minus
--    everyone's, shrunk by n/(n+1) so a single review isn't cancelled out),
--    so one harsh or generous reviewer can't sink or lift a team. A project needs at least two reviews (or the most any project got,
--    if fewer). Its team stays eligible only if at least one of its members
--    finished all their reviews (owner: "reviewing can count").
--  * Awards (hackathon_compute_awards, at the reveal): Community pick (best
--    overall), Most shipped (best "how much works"), Most likely to become
--    real (best "would you use it"), Crowd favourite (picked as favourite by
--    the largest share of its reviewers). Written, then finalized, so the
--    existing reveal rules publish them (031). An admin can recompute
--    (p_force) after hiding a review.
--  * Reviewers may read the submissions (and their screenshots and decks)
--    they were assigned, from the deadline (private.can_read_submission).
--  * Judges are no longer part of the flow; their tables stay, unused.
--
-- RUN AFTER 035. Idempotent.
-- ---------------------------------------------------------------------------

-- ============================================================================
-- 1. The Sprint's settings
-- ============================================================================
alter table public.hackathons add column if not exists reviews_per_person smallint not null default 6;
alter table public.hackathons drop constraint if exists hackathons_reviews_per_person;
alter table public.hackathons add constraint hackathons_reviews_per_person check (reviews_per_person between 1 and 20);
alter table public.hackathons add column if not exists reviews_assigned_at timestamptz;
grant select (reviews_per_person, reviews_assigned_at) on public.hackathons to anon, authenticated;

-- ============================================================================
-- 2. Awards: two new kinds
-- ============================================================================
alter table public.hackathon_awards drop constraint if exists hackathon_awards_award_type_check;
alter table public.hackathon_awards add constraint hackathon_awards_award_type_check check (award_type in (
  'community_pick', 'most_shipped', 'most_likely_to_become_real', 'crowd_favourite',
  'judges_pick', 'best_collaboration', 'custom'
));

-- ============================================================================
-- 3. Reviews
-- ============================================================================
create table if not exists public.hackathon_reviews (
  id             uuid primary key default gen_random_uuid(),
  hackathon_id   uuid not null references public.hackathons(id) on delete cascade,
  submission_id  uuid not null,
  reviewer_id    uuid not null references public.profiles(id) on delete cascade,
  position       smallint not null,
  assigned_at    timestamptz not null default now(),
  score_problem  smallint check (score_problem between 1 and 5),
  score_works    smallint check (score_works between 1 and 5),
  score_use      smallint check (score_use between 1 and 5),
  strength       text check (strength is null or char_length(strength) <= 280),
  suggestion     text check (suggestion is null or char_length(suggestion) <= 280),
  is_favourite   boolean not null default false,
  completed_at   timestamptz,
  updated_at     timestamptz not null default now(),
  hidden_at      timestamptz,
  foreign key (submission_id, hackathon_id)
    references public.hackathon_submissions (id, hackathon_id) on delete cascade,
  unique (submission_id, reviewer_id)
);
create index if not exists hackathon_reviews_reviewer_idx on public.hackathon_reviews (hackathon_id, reviewer_id, position);
create index if not exists hackathon_reviews_submission_idx on public.hackathon_reviews (submission_id);
create unique index if not exists hackathon_reviews_one_favourite
  on public.hackathon_reviews (hackathon_id, reviewer_id) where is_favourite;

alter table public.hackathon_reviews enable row level security;
revoke insert, delete, truncate on public.hackathon_reviews from anon, authenticated;

drop policy if exists "hackathon_reviews_read_own" on public.hackathon_reviews;
create policy "hackathon_reviews_read_own"
  on public.hackathon_reviews for select to authenticated
  using (reviewer_id = auth.uid() or private.is_admin(auth.uid()));

drop policy if exists "hackathon_reviews_update_own" on public.hackathon_reviews;
create policy "hackathon_reviews_update_own"
  on public.hackathon_reviews for update to authenticated
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid());

-- A reviewer fills in the ratings and the two lines while scoring is open;
-- nothing else moves. Complete once all three ratings are in. The favourite
-- goes through hackathon_pick_favourite (one per reviewer).
create or replace function private.hackathon_reviews_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.hackathon_id := old.hackathon_id;
    new.submission_id := old.submission_id;
    new.reviewer_id := old.reviewer_id;
    new.position := old.position;
    new.assigned_at := old.assigned_at;
    if current_user in ('anon', 'authenticated') then
      new.hidden_at := old.hidden_at;
      new.is_favourite := old.is_favourite;
      if not private.scoring_open(old.hackathon_id) then
        raise exception 'Reviews are closed for this Sprint.' using hint = 'reviews_closed';
      end if;
    end if;
  end if;
  new.strength := nullif(btrim(new.strength), '');
  new.suggestion := nullif(btrim(new.suggestion), '');
  new.updated_at := now();
  if new.score_problem is not null and new.score_works is not null and new.score_use is not null then
    new.completed_at := coalesce(case when tg_op = 'UPDATE' then old.completed_at end, now());
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists hackathon_reviews_guard_trigger on public.hackathon_reviews;
create trigger hackathon_reviews_guard_trigger
  before insert or update on public.hackathon_reviews
  for each row execute function private.hackathon_reviews_guard();

-- ============================================================================
-- 4. Reviewers may read what they review
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
          or (
            private.hackathon_phase(t.hackathon_id) in ('judging', 'revealed')
            and exists (
              select 1 from public.hackathon_reviews r
              join public.hackathon_submissions s on s.id = r.submission_id
              where s.team_id = t.id and r.reviewer_id = uid
            )
          )
        )
      )
    from public.hackathon_teams t
    where t.id = p_team_id
  ), false)
$$;

-- ============================================================================
-- 5. Handing out the reviews (once, from the deadline)
-- ============================================================================
create or replace function public.hackathon_assign_reviews(p_hackathon_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  h public.hackathons%rowtype;
  r record;
  n integer := 0;
  pos integer;
  p record;
begin
  select * into h from public.hackathons where id = p_hackathon_id for update;
  if not found or h.reviews_assigned_at is not null or h.status_override = 'cancelled' then
    return 0;
  end if;
  if private.hackathon_phase(h.id) not in ('judging', 'revealed') then
    return 0;
  end if;

  -- Every participant, in random order, with their team (if any).
  for r in
    select reg.user_id, m.team_id
    from public.hackathon_registrations reg
    left join public.hackathon_team_members m on m.hackathon_id = reg.hackathon_id and m.user_id = reg.user_id
    where reg.hackathon_id = h.id and reg.withdrawn_at is null
    order by random()
  loop
    pos := 0;
    -- The complete projects of other teams with the fewest reviewers so far.
    for p in
      select s.id
      from public.hackathon_submissions s
      where s.hackathon_id = h.id and s.is_complete and s.team_id is distinct from r.team_id
      order by (select count(*) from public.hackathon_reviews x where x.submission_id = s.id), random()
      limit h.reviews_per_person
    loop
      pos := pos + 1;
      insert into public.hackathon_reviews (hackathon_id, submission_id, reviewer_id, position)
      values (h.id, p.id, r.user_id, pos)
      on conflict (submission_id, reviewer_id) do nothing;
      n := n + 1;
    end loop;
  end loop;

  update public.hackathons set reviews_assigned_at = now() where id = h.id;
  return n;
end $$;

-- ============================================================================
-- 6. The favourite: one per reviewer, among the reviews they finished
-- ============================================================================
create or replace function public.hackathon_pick_favourite(p_review_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  rv public.hackathon_reviews%rowtype;
begin
  select * into rv from public.hackathon_reviews where id = p_review_id;
  if not found or rv.reviewer_id is distinct from auth.uid() then
    raise exception 'That isn''t one of your reviews.' using hint = 'not_your_review';
  end if;
  if not private.scoring_open(rv.hackathon_id) then
    raise exception 'Reviews are closed for this Sprint.' using hint = 'reviews_closed';
  end if;
  if rv.completed_at is null then
    raise exception 'Rate a project before picking it as your favourite.' using hint = 'review_incomplete';
  end if;
  update public.hackathon_reviews set is_favourite = false
  where hackathon_id = rv.hackathon_id and reviewer_id = rv.reviewer_id and is_favourite and id <> rv.id;
  update public.hackathon_reviews set is_favourite = true where id = rv.id;
end $$;

-- ============================================================================
-- 7. Progress (counts only), for everyone following the Sprint
-- ============================================================================
create or replace function public.hackathon_review_progress(p_hackathon_id uuid)
returns table (assigned integer, completed integer, reviewers integer, reviewers_done integer)
language sql stable security definer set search_path = public as $$
  with per as (
    select reviewer_id, count(*) as total, count(completed_at) as done
    from public.hackathon_reviews where hackathon_id = p_hackathon_id
    group by reviewer_id
  )
  select
    coalesce(sum(total), 0)::integer,
    coalesce(sum(done), 0)::integer,
    count(*)::integer,
    count(*) filter (where done = total)::integer
  from per
  where exists (select 1 from public.hackathons h where h.id = p_hackathon_id and h.is_published)
$$;

-- ============================================================================
-- 8. Standings and awards
-- ============================================================================
-- The arithmetic, with no access check: only ever called from the functions
-- below (the private schema isn't reachable through the API).
create or replace function private.review_standings(p_hackathon_id uuid)
returns table (
  submission_id uuid,
  team_id       uuid,
  reviews       integer,
  problem       numeric,
  works         numeric,
  use           numeric,
  overall       numeric,
  favourites    integer,
  eligible      boolean
)
language sql stable security definer set search_path = public as $$
  with counted as (
    select r.* from public.hackathon_reviews r
    where r.hackathon_id = p_hackathon_id and r.completed_at is not null and r.hidden_at is null
  ),
  everyone as (
    select avg(score_problem) as gp, avg(score_works) as gw, avg(score_use) as gu from counted
  ),
  -- A reviewer's lean, shrunk by how little we know of it: n/(n+1) of the gap,
  -- so a single review keeps half its say instead of being cancelled out.
  lean as (
    select c.reviewer_id,
      (avg(c.score_problem) - e.gp) * count(*) / (count(*) + 1) as lp,
      (avg(c.score_works) - e.gw) * count(*) / (count(*) + 1) as lw,
      (avg(c.score_use) - e.gu) * count(*) / (count(*) + 1) as lu
    from counted c cross join everyone e
    group by c.reviewer_id, e.gp, e.gw, e.gu
  ),
  per_project as (
    select c.submission_id,
      count(*)::integer as reviews,
      avg(c.score_problem - l.lp) as problem,
      avg(c.score_works - l.lw) as works,
      avg(c.score_use - l.lu) as use,
      count(*) filter (where c.is_favourite)::integer as favourites
    from counted c join lean l on l.reviewer_id = c.reviewer_id
    group by c.submission_id
  ),
  -- A reviewer is done when they finished every review handed to them.
  done_reviewers as (
    select reviewer_id from public.hackathon_reviews where hackathon_id = p_hackathon_id
    group by reviewer_id having count(*) = count(completed_at)
  ),
  any_assigned as (
    select exists (select 1 from public.hackathon_reviews where hackathon_id = p_hackathon_id) as yes
  )
  select s.id, s.team_id,
    coalesce(pp.reviews, 0),
    round(pp.problem, 3), round(pp.works, 3), round(pp.use, 3),
    round((pp.problem + pp.works + pp.use) / 3, 3),
    coalesce(pp.favourites, 0),
    -- Eligible: some teammate finished their reviews, or nobody on the team was handed any.
    (not (select yes from any_assigned))
      or exists (select 1 from public.hackathon_team_members m join done_reviewers d on d.reviewer_id = m.user_id where m.team_id = s.team_id)
      or not exists (
        select 1 from public.hackathon_team_members m join public.hackathon_reviews r on r.reviewer_id = m.user_id
        where m.team_id = s.team_id and r.hackathon_id = p_hackathon_id
      )
  from public.hackathon_submissions s
  left join per_project pp on pp.submission_id = s.id
  where s.hackathon_id = p_hackathon_id and s.is_complete
$$;

-- For the admin console: admins only. (Inside a SECURITY DEFINER function
-- current_user is the owner, so the caller is told apart by auth.uid() and
-- the request's role claim.)
create or replace function public.hackathon_review_standings(p_hackathon_id uuid)
returns table (
  submission_id uuid,
  team_id       uuid,
  reviews       integer,
  problem       numeric,
  works         numeric,
  use           numeric,
  overall       numeric,
  favourites    integer,
  eligible      boolean
)
language sql stable security definer set search_path = public as $$
  select * from private.review_standings(p_hackathon_id)
  where private.is_admin(auth.uid()) or coalesce(auth.role(), '') = 'service_role'
$$;

create or replace function public.hackathon_compute_awards(p_hackathon_id uuid, p_force boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare
  h public.hackathons%rowtype;
  min_reviews integer;
  n integer := 0;
  w record;
begin
  select * into h from public.hackathons where id = p_hackathon_id for update;
  if not found or h.status_override = 'cancelled' then
    return 0;
  end if;
  if not private.is_revealed(h.id) then
    raise exception 'Awards are worked out at the reveal.' using hint = 'awards_too_early';
  end if;
  if h.awards_finalized_at is not null and not p_force then
    return 0;
  end if;

  -- Start clean: reopen, and clear the computed kinds (custom awards stay).
  update public.hackathons set awards_finalized_at = null, awards_finalized_by = null where id = h.id;
  delete from public.hackathon_awards
  where hackathon_id = h.id and award_type in ('community_pick', 'most_shipped', 'most_likely_to_become_real', 'crowd_favourite');

  select least(2, coalesce(max(reviews), 0)) into min_reviews from private.review_standings(h.id);

  if min_reviews > 0 then
    for w in
      with st as (select * from private.review_standings(h.id) x where x.eligible and x.reviews >= min_reviews)
      select * from (
        (select 'community_pick'::text as kind, st.submission_id, st.reviews, st.favourites
         from st order by st.overall desc, st.reviews desc, st.submission_id limit 1)
        union all
        (select 'most_shipped', st.submission_id, st.reviews, st.favourites
         from st order by st.works desc, st.overall desc, st.submission_id limit 1)
        union all
        (select 'most_likely_to_become_real', st.submission_id, st.reviews, st.favourites
         from st order by st.use desc, st.overall desc, st.submission_id limit 1)
        union all
        (select 'crowd_favourite', st.submission_id, st.reviews, st.favourites
         from st where st.favourites > 0
         order by st.favourites::numeric / st.reviews desc, st.favourites desc, st.overall desc, st.submission_id limit 1)
      ) picks
    loop
      insert into public.hackathon_awards (hackathon_id, submission_id, award_type, citation)
      values (
        h.id, w.submission_id, w.kind,
        case w.kind
          when 'community_pick' then format('Rated highest overall by the %s fellow builders who reviewed it.', w.reviews)
          when 'most_shipped' then 'Reviewers said more of it works than anything else.'
          when 'most_likely_to_become_real' then 'The project reviewers most wanted to use.'
          else format('Picked as a favourite by %s of the %s people who reviewed it.', w.favourites, w.reviews)
        end
      );
      n := n + 1;
    end loop;
  end if;

  update public.hackathons set awards_finalized_at = now() where id = h.id;
  return n;
end $$;

-- ============================================================================
-- 9. A team's feedback, anonymously, after the reveal
-- ============================================================================
create or replace function public.hackathon_team_feedback(p_team_id uuid)
returns table (strength text, suggestion text, score_problem smallint, score_works smallint, score_use smallint, completed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.strength, r.suggestion, r.score_problem, r.score_works, r.score_use, r.completed_at
  from public.hackathon_reviews r
  join public.hackathon_submissions s on s.id = r.submission_id
  where s.team_id = p_team_id
    and r.completed_at is not null and r.hidden_at is null
    and private.is_revealed(s.hackathon_id)
    and (private.is_team_member(p_team_id, auth.uid()) or private.is_admin(auth.uid()))
  order by r.completed_at
$$;

-- ============================================================================
-- 10. Grants
-- ============================================================================
grant execute on all functions in schema private to anon, authenticated, service_role;

revoke execute on function public.hackathon_assign_reviews(uuid) from public, anon, authenticated;
grant execute on function public.hackathon_assign_reviews(uuid) to service_role;
revoke execute on function public.hackathon_compute_awards(uuid, boolean) from public, anon, authenticated;
grant execute on function public.hackathon_compute_awards(uuid, boolean) to service_role;
revoke execute on function public.hackathon_pick_favourite(uuid) from public, anon;
grant execute on function public.hackathon_pick_favourite(uuid) to authenticated, service_role;
revoke execute on function public.hackathon_review_progress(uuid) from public, anon;
grant execute on function public.hackathon_review_progress(uuid) to authenticated, service_role;
revoke execute on function public.hackathon_review_standings(uuid) from public, anon;
grant execute on function public.hackathon_review_standings(uuid) to authenticated, service_role;
revoke execute on function public.hackathon_team_feedback(uuid) from public, anon;
grant execute on function public.hackathon_team_feedback(uuid) to authenticated, service_role;
