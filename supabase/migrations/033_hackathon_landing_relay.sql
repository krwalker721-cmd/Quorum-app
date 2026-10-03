-- ---------------------------------------------------------------------------
-- 033 — The landing page's countdown relay: public-safe Sprint data
--
-- Phase 11 shows one countdown message on the public landing page, chosen
-- from the admin's standalone countdowns (site_countdowns, 022) and each
-- Sprint's show_countdown_on_landing switch. Signed-out visitors need a
-- little more than the Sprint view gives them (a team count during a live
-- Sprint), so this function hands out exactly what the relay shows:
--
--   number, title, tagline, the headline override, the five public times,
--   state and phase, the landing switch, and two counts (teams, builders).
--
-- Never the theme, team names or anything a team wrote, and never ids.
-- Published Sprints only; cancelled ones are left out; of the revealed ones,
-- only the latest (the relay links its recap until a newer Sprint is
-- published). A newer Sprint comes back even with its landing switch off,
-- so the relay can tell that it has been announced; its times are already
-- public through hackathon_overview (decision 8).
--
-- RUN AFTER 032. Idempotent.
-- ---------------------------------------------------------------------------

create or replace function public.hackathon_landing_relay()
returns table (
  number                integer,
  title                 text,
  tagline               text,
  headline              text,
  registration_opens_at timestamptz,
  team_lock_at          timestamptz,
  starts_at             timestamptz,
  ends_at               timestamptz,
  reveal_at             timestamptz,
  state                 text,
  phase                 text,
  on_landing            boolean,
  teams                 integer,
  builders              integer
)
language sql stable security definer set search_path = public as $$
  with published as (
    select h.*, private.hackathon_phase(h.id) as p
    from public.hackathons h
    where h.is_published and h.status_override is distinct from 'cancelled'
  ),
  latest_revealed as (
    select id from published where p = 'revealed' order by reveal_at desc, number desc limit 1
  )
  select
    h.number, h.title, h.tagline, h.countdown_headline_override,
    h.registration_opens_at, h.team_lock_at, h.starts_at, h.ends_at, h.reveal_at,
    coalesce(h.status_override, h.p), h.p, h.show_countdown_on_landing,
    (select count(*)::integer from public.hackathon_teams t where t.hackathon_id = h.id),
    (select count(*)::integer from public.hackathon_registrations r where r.hackathon_id = h.id and r.withdrawn_at is null)
  from published h
  where h.p <> 'revealed' or h.id in (select id from latest_revealed)
  order by h.number
$$;

revoke execute on function public.hackathon_landing_relay() from public;
grant execute on function public.hackathon_landing_relay() to anon, authenticated, service_role;
