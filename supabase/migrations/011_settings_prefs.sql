-- 011_settings_prefs.sql
-- Run this in the Supabase SQL editor.
--
-- Backing columns for the rebuilt /settings control panel:
--   • is_visible              — profile visibility toggle (account + privacy)
--   • notification_preferences — per-channel notification opt-ins (JSONB blob)
-- Both are additive and default to sensible values so existing rows keep
-- working without a backfill.

alter table public.profiles
  add column if not exists is_visible boolean default true;

alter table public.profiles
  add column if not exists notification_preferences jsonb default '{}'::jsonb;
