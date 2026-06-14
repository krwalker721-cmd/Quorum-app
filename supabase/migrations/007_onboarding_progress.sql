-- 007_onboarding_progress.sql
-- Run this in the Supabase SQL editor.
--
-- Tracks each user's progress through the 15-step onboarding flow so it can be
-- resumed across sessions. One row per user (unique user_id), RLS-scoped so a
-- user only ever sees or writes their own row.

-- ============================================================================
-- table
-- ============================================================================
create table if not exists public.onboarding_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  current_step integer default 1 not null,
  completed boolean default false not null,
  screen3_answer text,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.onboarding_progress enable row level security;

-- ============================================================================
-- policies — a user may only touch their own row
-- ============================================================================
drop policy if exists "Users can view their own onboarding progress" on public.onboarding_progress;
create policy "Users can view their own onboarding progress"
  on public.onboarding_progress for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own onboarding progress" on public.onboarding_progress;
create policy "Users can insert their own onboarding progress"
  on public.onboarding_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own onboarding progress" on public.onboarding_progress;
create policy "Users can update their own onboarding progress"
  on public.onboarding_progress for update
  using (auth.uid() = user_id);

-- ============================================================================
-- updated_at trigger — keep updated_at fresh on every write
-- ============================================================================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_onboarding_progress_updated_at on public.onboarding_progress;
create trigger update_onboarding_progress_updated_at
  before update on public.onboarding_progress
  for each row execute function public.update_updated_at_column();
