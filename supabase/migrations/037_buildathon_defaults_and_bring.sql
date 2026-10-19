-- ---------------------------------------------------------------------------
-- 037 — Buildathon defaults, and "what you bring" at signup
--
-- Owner, 2026-10-18: every event is a Buildathon with the same title, told
-- apart by its number ("Buildathon #3"), and the whole thing exists to get
-- founders building together and meeting people they'd build with again.
--
-- 1. Defaults. A new Buildathon is titled "Buildathon", and the lobby welcome
--    asks people to introduce themselves. The admin form fills in the rest
--    (tagline, full rules, teams of 2 to 4); existing rows are left alone.
--
-- 2. "What you bring." When registering, a member may add one short line
--    about what they bring (design, sales, backend…). It shows next to their
--    name in "Registered so far", so people can find teammates before teams
--    lock. Theirs to write while registration is open; up to 80 characters,
--    trimmed, blank means none. hackathon_registrants (024) returns it to the
--    same audience as the names.
--
-- RUN AFTER 036. Idempotent.
-- ---------------------------------------------------------------------------

alter table public.hackathons alter column title set default 'Buildathon';
alter table public.hackathons alter column lobby_welcome set default
  'Welcome! Introduce yourself: who you are, what you''re good at, and the kind of business you''d want to build. The best teams start here, before teams lock.';

alter table public.hackathon_registrations add column if not exists bring text;
alter table public.hackathon_registrations drop constraint if exists hackathon_registrations_bring_length;
alter table public.hackathon_registrations add constraint hackathon_registrations_bring_length
  check (bring is null or char_length(bring) <= 80);

-- Tidies the line and keeps it to the signup window. Security invoker, like
-- the 018 guard, so current_user tells a member's request from the system's
-- (the admin console can still correct it).
create or replace function private.hackathon_registrations_bring()
returns trigger language plpgsql set search_path = public as $$
begin
  new.bring := nullif(btrim(regexp_replace(coalesce(new.bring, ''), '\s+', ' ', 'g')), '');
  if current_user in ('anon', 'authenticated')
     and new.bring is distinct from (case when tg_op = 'UPDATE' then old.bring end)
     and not (private.hackathon_writable(new.hackathon_id) and private.hackathon_phase(new.hackathon_id) = 'registration')
  then
    raise exception 'You can change what you bring while registration is open.' using hint = 'registration_closed';
  end if;
  return new;
end $$;

drop trigger if exists hackathon_registrations_bring_trigger on public.hackathon_registrations;
create trigger hackathon_registrations_bring_trigger
  before insert or update of bring on public.hackathon_registrations
  for each row execute function private.hackathon_registrations_bring();

-- 024's list of who's registered, now with what each person brings.
drop function if exists public.hackathon_registrants(uuid);
create function public.hackathon_registrants(p_hackathon_id uuid)
returns table (
  user_id       uuid,
  full_name     text,
  username      text,
  stage         text,
  registered_at timestamptz,
  bring         text
)
language sql stable security definer set search_path = public as $$
  select r.user_id, p.full_name, p.username, p.stage, r.created_at, r.bring
  from public.hackathon_registrations r
  join public.profiles p on p.id = r.user_id
  where r.hackathon_id = p_hackathon_id
    and r.withdrawn_at is null
    and private.can_view_arena(p_hackathon_id, auth.uid())
  order by r.created_at, r.user_id
$$;

revoke execute on function public.hackathon_registrants(uuid) from public, anon;
grant execute on function public.hackathon_registrants(uuid) to authenticated;
