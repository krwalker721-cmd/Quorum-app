-- ---------------------------------------------------------------------------
-- 024 — Who's registered, for the Sprint page
--
-- The Hackathon tab shows "who's registered so far" while registration is
-- open. The registrations table itself stays participants-only (018), because
-- a row says more than a name: random pool or team, check-in, withdrawal.
--
-- This function gives the arena's audience (active members, participants,
-- judges, admins: private.can_view_arena) just the people: id, name, username,
-- stage and when they registered. Withdrawn registrations are left out. Nothing
-- about mode or team, and never an email.
--
-- RUN AFTER 023. Idempotent.
-- ---------------------------------------------------------------------------

create or replace function public.hackathon_registrants(p_hackathon_id uuid)
returns table (
  user_id       uuid,
  full_name     text,
  username      text,
  stage         text,
  registered_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.user_id, p.full_name, p.username, p.stage, r.created_at
  from public.hackathon_registrations r
  join public.profiles p on p.id = r.user_id
  where r.hackathon_id = p_hackathon_id
    and r.withdrawn_at is null
    and private.can_view_arena(p_hackathon_id, auth.uid())
  order by r.created_at, r.user_id
$$;

revoke execute on function public.hackathon_registrants(uuid) from public, anon;
grant execute on function public.hackathon_registrants(uuid) to authenticated;
