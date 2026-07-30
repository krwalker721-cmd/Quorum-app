-- ---------------------------------------------------------------------------
-- 014 — launch hardening: privilege escalation, anonymity, and signup
--
-- Four fixes that all had to land before the app could take public signups.
--
--  1. profiles could be self-escalated. "profiles_update_own" allows an update
--     of ANY column on your own row, and computeEntitlement() reads
--     profiles.tier — with no subscription row the status defaults to
--     "trialing", which is an entitled status. So a single update from the
--     browser console granted tier='partner' (free unlimited access),
--     is_admin=true, and status='approved' (waitlist bypass). The paywall was
--     decorative.
--
--  2. check_ins were readable by every authenticated user, with anonymity
--     "enforced in the app layer". It wasn't enforced there either — the cohort
--     room maps check-ins by user_id and renders them against the member, so an
--     anonymous check-in was attributed to its author in the roster.
--
--  3. handshakes had the same bare-authenticated read policy, exposing the
--     private `agreement` text of every handshake in the app. Two call sites
--     already carry comments asserting the opposite ("RLS keeps handshakes
--     private to the two parties") — the policy simply never matched the code.
--
--  4. signup created the profile row from the client, which only works while
--     email confirmation is disabled. With confirmation on there is no session
--     at signUp() time, so the insert fails RLS and the account is stranded
--     with an auth user and no profile. Profile creation moves into a trigger
--     on auth.users, which runs regardless of session state.
-- ---------------------------------------------------------------------------

-- --- 1. profiles: stop self-escalation -------------------------------------

-- The columns a user must never be able to write on their own row. Everything
-- here is set by the server (webhooks, admin routes, referral logic) through the
-- service-role client.
--
-- Enforced with a BEFORE trigger rather than a column-scoped policy because
-- Postgres RLS has no per-column granularity. The trigger clamps privileged
-- columns instead of raising, so an ordinary profile edit that happens to
-- include an unchanged tier still succeeds.
--
-- INSERT is covered as well as UPDATE. "profiles_insert_own" has the identical
-- gap — it admits any column so long as id = auth.uid() — and while the
-- handle_new_user() trigger below normally wins the race by creating the row
-- inside the same transaction as the auth user, a self-insert must not be the
-- one path that can still mint a partner tier.
--
-- auth.uid() is the discriminator: it returns the signed-in user for a request
-- made with the anon key, and NULL for the service-role client. So the clamp
-- applies to self-service writes and never to server-side ones.
create or replace function public.profiles_guard_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or auth.uid() <> new.id then
      return new;  -- service role (trigger, webhook, admin route)
    end if;
    new.status     := 'pending';
    new.tier       := 'free';
    new.is_admin   := false;
    new.trust_score := 0;
    return new;
  end if;

  if auth.uid() is null or auth.uid() <> old.id then
    -- Service role, or an admin acting on someone else's row. Leave it alone.
    return new;
  end if;

  new.status                := old.status;
  new.tier                  := old.tier;
  new.is_admin              := old.is_admin;
  new.trust_score           := old.trust_score;
  new.stripe_customer_id    := old.stripe_customer_id;
  new.partner_waitlist      := old.partner_waitlist;
  new.trial_ends_at         := old.trial_ends_at;

  -- Founding-seat columns only exist once 008 has run. jsonb_exists() rather
  -- than the `?` operator, which some drivers read as a bind placeholder.
  if jsonb_exists(to_jsonb(old), 'is_founding_member') then
    new.is_founding_member := old.is_founding_member;
  end if;
  if jsonb_exists(to_jsonb(old), 'founding_member_number') then
    new.founding_member_number := old.founding_member_number;
  end if;

  return new;
end; $$;

drop trigger if exists profiles_guard_privileged_columns_trigger on public.profiles;
create trigger profiles_guard_privileged_columns_trigger
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_privileged_columns();

-- --- 2. check_ins: real anonymity ------------------------------------------

drop policy if exists "check_ins_read_own_or_cohort" on public.check_ins;
drop policy if exists "check_ins_insert_own" on public.check_ins;

-- Your own check-ins are always yours to read, anonymous or not.
create policy "check_ins_read_own"
  on public.check_ins for select
  using (auth.uid() = user_id);

-- Cohort-mates see each other's check-ins, but an anonymous one is withheld at
-- the row level. This is what makes the anonymity real: previously the row was
-- readable by anyone with the anon key and a devtools console, so "anonymous"
-- only held for people who used the UI as intended.
--
-- my_cohort_ids() is the existing SECURITY DEFINER helper from 005, so this does
-- not recurse through cohort_members' own policies.
create policy "check_ins_read_cohort_named"
  on public.check_ins for select
  using (
    coalesce(is_anonymous, false) = false
    and exists (
      select 1 from public.cohort_members cm
      where cm.user_id = check_ins.user_id
        and cm.cohort_id in (select public.my_cohort_ids())
    )
  );

create policy "check_ins_insert_own"
  on public.check_ins for insert
  with check (auth.uid() = user_id);

-- --- 3. handshakes: private to the two parties ------------------------------

drop policy if exists "handshakes_read_party" on public.handshakes;

create policy "handshakes_read_party"
  on public.handshakes for select
  using (auth.uid() = initiator_id or auth.uid() = recipient_id);

-- The handshake COUNT is a public trust signal on every profile, but the rows
-- behind it are not public. A SECURITY DEFINER function hands back the integer
-- without granting read access to the `agreement` text it was derived from.
create or replace function public.handshake_count(target uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer
  from public.handshakes
  where initiator_id = target or recipient_id = target;
$$;

revoke all on function public.handshake_count(uuid) from public;
grant execute on function public.handshake_count(uuid) to authenticated;

-- --- 4. profiles: create on signup, from the trigger ------------------------

-- Builds a unique username from the display name, falling back to 'founder'.
-- The uuid suffix makes collisions vanishingly unlikely; the loop covers the
-- rest rather than letting a duplicate abort the signup.
create or replace function public.generate_username(display_name text, user_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n integer := 0;
begin
  base := lower(regexp_replace(coalesce(nullif(trim(display_name), ''), 'founder'),
                               '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  if base = '' then base := 'founder'; end if;

  candidate := base || '-' || substring(user_id::text, 1, 4);
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || '-' || substring(user_id::text, 1, 4) || '-' || n::text;
  end loop;

  return candidate;
end; $$;

-- Creates the profile row the instant the auth user exists, reading the signup
-- fields out of raw_user_meta_data.
--
-- status is hardcoded to 'pending' and never read from metadata: metadata is
-- attacker-controlled at signUp(), so honouring a status there would hand every
-- signup a waitlist bypass. Approval is an admin action. The same reasoning
-- applies to tier, which is left at its column default.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  display_name text := nullif(trim(coalesce(meta->>'full_name', '')), '');
  claimed_stage text := meta->>'stage';
begin
  insert into public.profiles (
    id, full_name, email, what_they_are_building, stage, status, username
  )
  values (
    new.id,
    display_name,
    new.email,
    nullif(trim(coalesce(meta->>'what_they_are_building', '')), ''),
    case when claimed_stage in ('idea','pre-seed','seed','series_a')
         then claimed_stage else 'idea' end,
    'pending',
    public.generate_username(display_name, new.id)
  )
  on conflict (id) do nothing;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any auth user that predates the trigger and never got a profile
-- (the stranded-signup case described at the top of this file).
insert into public.profiles (id, full_name, email, status, username)
select
  u.id,
  nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), ''),
  u.email,
  'pending',
  public.generate_username(u.raw_user_meta_data->>'full_name', u.id)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
