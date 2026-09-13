-- ---------------------------------------------------------------------------
-- 015 — trial reminder send log
--
-- Card-free trials live only in public.subscriptions, so Stripe never warns
-- those members that their trial is ending (LAUNCH.md §4a). A daily job,
-- /api/cron/trial-reminders, emails them 7, 3, and 1 days before
-- trial_ends_at. This table records each send so a retried or overlapping run
-- can't email the same person twice for the same mark.
--
-- trial_ends_at is part of the key so a member whose trial is re-granted gets a
-- fresh set of reminders for the new date.
--
-- RUN THIS BEFORE deploying the code that reads it (see LAUNCH.md §7).
-- ---------------------------------------------------------------------------

create table if not exists public.trial_reminder_sends (
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  days_before   smallint    not null check (days_before in (7, 3, 1)),
  trial_ends_at timestamptz not null,
  sent_at       timestamptz not null default now(),
  primary key (user_id, days_before, trial_ends_at)
);

-- No policies: only the service role (the cron job) reads or writes this.
alter table public.trial_reminder_sends enable row level security;
