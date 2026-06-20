-- ===========================================================================
-- Session 7 — Referral system data layer
-- Referral codes, referrals, milestone/monthly rewards, login activity tracking.
-- Idempotent: safe to re-run. Uses public.update_updated_at_column() from 008.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- referral_codes — one code per user, generated on approval
-- ---------------------------------------------------------------------------
create table if not exists public.referral_codes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  code text not null unique,
  active boolean default true not null,
  created_at timestamptz default now()
);
alter table public.referral_codes enable row level security;

drop policy if exists "Users can view their own referral code" on public.referral_codes;
create policy "Users can view their own referral code"
  on public.referral_codes for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- referrals — who referred who and the referred user's current state
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id uuid default gen_random_uuid() primary key,
  referrer_id uuid references public.profiles(id) on delete cascade not null,
  referred_id uuid references public.profiles(id) on delete cascade not null unique,
  code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'inactive', 'churned')),
  activated_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.referrals enable row level security;

drop policy if exists "Users can view referrals they made" on public.referrals;
create policy "Users can view referrals they made"
  on public.referrals for select
  using (auth.uid() = referrer_id);

-- ---------------------------------------------------------------------------
-- referral_rewards — milestone + monthly-bonus rewards granted to a referrer
-- ---------------------------------------------------------------------------
create table if not exists public.referral_rewards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  reward_type text not null check (reward_type in (
    'milestone_1',
    'milestone_3',
    'milestone_5',
    'milestone_10',
    'milestone_25',
    'monthly_bonus'
  )),
  milestone_count integer,
  stripe_coupon_id text,
  stripe_discount_id text,
  applied_at timestamptz default now(),
  expires_at timestamptz,
  active boolean default true not null,
  created_at timestamptz default now()
);
alter table public.referral_rewards enable row level security;

drop policy if exists "Users can view their own rewards" on public.referral_rewards;
create policy "Users can view their own rewards"
  on public.referral_rewards for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- login_events — activity gate: must return on 3 separate days
-- ---------------------------------------------------------------------------
create table if not exists public.login_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  logged_in_at timestamptz default now(),
  date_key text not null -- YYYY-MM-DD, used for per-day deduplication
);
alter table public.login_events enable row level security;

drop policy if exists "Users can view their own login events" on public.login_events;
create policy "Users can view their own login events"
  on public.login_events for select
  using (auth.uid() = user_id);

-- One login event per user per day.
create unique index if not exists login_events_user_date_unique
  on public.login_events(user_id, date_key);

-- ---------------------------------------------------------------------------
-- profiles — referral-related columns
-- (bio added here: the spec's profile-complete gate references it and no column
--  existed yet; the gate also accepts what_they_are_building as a fallback.)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists referred_by uuid references public.profiles(id),
  add column if not exists referral_code text,
  add column if not exists connector_badge boolean default false,
  add column if not exists founding_member boolean default false,
  add column if not exists bio text;

-- ---------------------------------------------------------------------------
-- updated_at maintenance on referrals
-- ---------------------------------------------------------------------------
drop trigger if exists update_referrals_updated_at on public.referrals;
create trigger update_referrals_updated_at
  before update on public.referrals
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Indexes for fast lookups
-- ---------------------------------------------------------------------------
create index if not exists referrals_referrer_id_idx on public.referrals(referrer_id);
create index if not exists referrals_referred_id_idx on public.referrals(referred_id);
create index if not exists referrals_status_idx on public.referrals(status);
create index if not exists referral_codes_code_idx on public.referral_codes(code);
create index if not exists referral_rewards_user_id_idx on public.referral_rewards(user_id);
create index if not exists login_events_user_id_idx on public.login_events(user_id);
