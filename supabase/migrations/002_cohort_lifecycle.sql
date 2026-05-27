-- Add status column to cohorts (open/closed) and ensure cohort_members ->
-- cohorts foreign key so PostgREST auto-joins from invite page work.

alter table public.cohorts add column if not exists status text default 'open' check (status in ('open','closed'));

-- Backfill status from existing is_open if present
update public.cohorts set status = case when coalesce(is_open, true) then 'open' else 'closed' end where status is null;

-- Ensure cohort_members.cohort_id references cohorts.id (some installs were
-- missing this FK which broke nested PostgREST selects).
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'cohort_members_cohort_id_fkey'
  ) then
    alter table public.cohort_members
      add constraint cohort_members_cohort_id_fkey
      foreign key (cohort_id) references public.cohorts(id) on delete cascade;
  end if;
end $$;

-- Allow users to delete their own cohort_members row (so "leave cohort" works
-- from the client). Without this RLS would only let inserts through.
drop policy if exists "cohort_members_delete_own" on public.cohort_members;
create policy "cohort_members_delete_own"
  on public.cohort_members for delete
  using (auth.uid() = user_id);
