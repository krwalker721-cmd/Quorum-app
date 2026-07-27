-- ---------------------------------------------------------------------------
-- 013 — referral credit model + lapsed-member seat release
--
-- Two pricing changes land here:
--
--  1. Referral rewards move from a standing "50% off forever off one referral"
--     coupon to one month of Stripe customer-balance credit per referral who
--     activates. The old model capped effective revenue near half list price,
--     since a referral-led product trends toward everyone holding the discount.
--
--  2. The free tier stops being a membership and becomes a lapsed state. A
--     cohort seat is scarce and rivalrous, so a non-paying account can't keep
--     occupying one — after a grace window the seat returns to the pool.
-- ---------------------------------------------------------------------------

-- --- 1. referral_rewards: support per-referral credit grants ----------------

alter table public.referral_rewards
  add column if not exists source_referred_id uuid references public.profiles(id) on delete set null,
  add column if not exists amount_cents integer,
  add column if not exists applied boolean default false not null;

-- Widen the reward_type check to admit the new credit rows. Milestone types are
-- retained: they still exist, but now grant badges rather than free months.
--
-- The original constraint was declared inline in 009, so its name is whatever
-- Postgres generated. Drop by lookup rather than by assumed name: a missed drop
-- would leave the old constraint in place alongside the new one, and every
-- referral_credit insert would fail against it.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'referral_rewards'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%reward_type%'
  loop
    execute format('alter table public.referral_rewards drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.referral_rewards
  add constraint referral_rewards_reward_type_check check (reward_type in (
    'milestone_1',
    'milestone_3',
    'milestone_5',
    'milestone_10',
    'milestone_25',
    'monthly_bonus',
    'referral_credit'
  ));

-- One credit per referred founder, ever. This is the idempotency guarantee that
-- grantReferralCredit() relies on: a replayed webhook hits a unique violation
-- instead of paying out twice. Partial, so it only constrains credit rows.
create unique index if not exists referral_rewards_credit_unique_idx
  on public.referral_rewards(user_id, source_referred_id)
  where reward_type = 'referral_credit';

-- Retire every standing monthly bonus. Members keep any credit they go on to
-- earn under the new model; nobody keeps a permanent half-price subscription.
-- The matching Stripe coupons are detached separately by the backfill script.
update public.referral_rewards
  set active = false
  where reward_type = 'monthly_bonus' and active = true;

-- --- 2. subscriptions: lapse grace window -----------------------------------

-- When the trial or subscription lapsed. The cohort seat is held for
-- LAPSE_GRACE_DAYS past this, then released. Null = not lapsed.
alter table public.subscriptions
  add column if not exists lapsed_at timestamptz,
  add column if not exists seat_released_at timestamptz;

create index if not exists subscriptions_lapsed_at_idx
  on public.subscriptions(lapsed_at)
  where lapsed_at is not null and seat_released_at is null;

-- --- 3. founding members ----------------------------------------------------

-- Founding-rate seats are finite and the rate is locked for life, so it has to
-- be recorded on the profile rather than inferred from the Stripe price in use.
alter table public.profiles
  add column if not exists is_founding_member boolean default false not null,
  add column if not exists founding_member_number integer;

create unique index if not exists profiles_founding_member_number_idx
  on public.profiles(founding_member_number)
  where founding_member_number is not null;

-- --- 4. verification --------------------------------------------------------

-- Run this after the migration; every row should report ok = true.
--
-- select 'reward_type accepts referral_credit' as check_name,
--        exists (
--          select 1 from pg_constraint con
--          join pg_class rel on rel.oid = con.conrelid
--          where rel.relname = 'referral_rewards' and con.contype = 'c'
--            and pg_get_constraintdef(con.oid) like '%referral_credit%'
--        ) as ok
-- union all
-- select 'exactly one reward_type check',
--        (select count(*) = 1 from pg_constraint con
--         join pg_class rel on rel.oid = con.conrelid
--         where rel.relname = 'referral_rewards' and con.contype = 'c'
--           and pg_get_constraintdef(con.oid) ilike '%reward_type%')
-- union all
-- select 'subscriptions.lapsed_at exists',
--        exists (select 1 from information_schema.columns
--                where table_name = 'subscriptions' and column_name = 'lapsed_at')
-- union all
-- select 'subscriptions.seat_released_at exists',
--        exists (select 1 from information_schema.columns
--                where table_name = 'subscriptions' and column_name = 'seat_released_at')
-- union all
-- select 'profiles.is_founding_member exists',
--        exists (select 1 from information_schema.columns
--                where table_name = 'profiles' and column_name = 'is_founding_member')
-- union all
-- select 'referral credit unique index exists',
--        exists (select 1 from pg_indexes
--                where tablename = 'referral_rewards'
--                  and indexname = 'referral_rewards_credit_unique_idx');
