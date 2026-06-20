-- 010_onboarding_trial_init.sql
-- Run this in the Supabase SQL editor.
--
-- Session 10 conclusion screens. The trial is started the first time a user
-- lands on step 1 of onboarding; this flag makes that one-time initialization
-- idempotent so refreshing/re-entering step 1 doesn't reset the trial clock.

alter table public.onboarding_progress
  add column if not exists trial_initialized boolean default false;
