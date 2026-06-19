-- ============================================================================
-- Session 4 — Payments, usage tracking, partner waitlist
-- ============================================================================
-- Tier naming: this codebase historically used free / tier_1 / tier_2. We are
-- standardizing on free / member / partner. Existing data is migrated below and
-- the CHECK constraint is replaced. Admin UI + tier routes are updated to match.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: migrate tier values, swap CHECK constraint, add Stripe columns
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_tier_check;

update public.profiles set tier = 'member'  where tier = 'tier_1';
update public.profiles set tier = 'partner' where tier = 'tier_2';

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists partner_waitlist boolean default false;

-- Ensure the column exists (no-op if it already does) then re-apply the new check.
alter table public.profiles
  add column if not exists tier text not null default 'free';

alter table public.profiles
  add constraint profiles_tier_check check (tier in ('free', 'member', 'partner'));

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  tier text not null default 'free' check (tier in ('free', 'member', 'partner')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'paused')),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  referred_free_month_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can view their own subscription" on public.subscriptions;
create policy "Users can view their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Service role bypasses RLS entirely; this explicit grant keeps intent clear
-- without opening the table to anon/authenticated keys (which `using (true)`
-- without a role target would have done).
drop policy if exists "Service role can manage all subscriptions" on public.subscriptions;
create policy "Service role can manage all subscriptions"
  on public.subscriptions for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- usage_tracking
-- ---------------------------------------------------------------------------
create table if not exists public.usage_tracking (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  month text not null, -- format: YYYY-MM e.g. "2026-06"
  cohort_posts integer default 0,
  pulse_posts integer default 0,
  replies integer default 0,
  messages integer default 0,
  vault_notes integer default 0,
  collab_posts integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, month)
);

alter table public.usage_tracking enable row level security;

drop policy if exists "Users can view their own usage" on public.usage_tracking;
create policy "Users can view their own usage"
  on public.usage_tracking for select
  using (auth.uid() = user_id);

drop policy if exists "Service role can manage all usage" on public.usage_tracking;
create policy "Service role can manage all usage"
  on public.usage_tracking for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- partner_waitlist
-- ---------------------------------------------------------------------------
create table if not exists public.partner_waitlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  created_at timestamptz default now()
);

alter table public.partner_waitlist enable row level security;

drop policy if exists "Users can view their own waitlist entry" on public.partner_waitlist;
create policy "Users can view their own waitlist entry"
  on public.partner_waitlist for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own waitlist entry" on public.partner_waitlist;
create policy "Users can insert their own waitlist entry"
  on public.partner_waitlist for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own waitlist entry" on public.partner_waitlist;
create policy "Users can delete their own waitlist entry"
  on public.partner_waitlist for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_subscriptions_updated_at on public.subscriptions;
create trigger update_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_usage_tracking_updated_at on public.usage_tracking;
create trigger update_usage_tracking_updated_at
  before update on public.usage_tracking
  for each row execute function public.update_updated_at_column();
