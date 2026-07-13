-- 012_in_app_tour.sql
-- Run this in the Supabase SQL editor.
--
-- Splits the old single onboarding gate into two phases. `completed` keeps its
-- meaning — the cinematic Act I scroll is done, so the (app) layout lets the
-- user in. The in-app guided tour then runs *inside* the real app; its own
-- progress lives in these two columns so it can be resumed across sessions and
-- shown exactly once.
--
--   tour_step      last completed tour step (0 = not started). Mirrors how
--                  current_step tracks the scroll, so a returning mid-tour user
--                  resumes on the step they left off.
--   tour_completed the walkthrough is finished; the overlay never shows again.

alter table public.onboarding_progress
  add column if not exists tour_step integer default 0 not null;

alter table public.onboarding_progress
  add column if not exists tour_completed boolean default false not null;
