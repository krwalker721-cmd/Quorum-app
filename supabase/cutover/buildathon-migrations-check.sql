-- Buildathon to production, CHECK: READ-ONLY. Changes nothing.
-- docs/hackathon-plan.md §7, "Production rollout".
--
-- Run it twice in Supabase → SQL Editor (production project):
--   * BEFORE pasting migrations 018–037: every row should say false (the
--     project is at 017). If some say true, stop and tell Claude which: a
--     partial earlier paste means starting from the first false one.
--   * AFTER pasting all twenty: every row should say true.
-- One row per migration, each checking one thing that migration creates.

select m.migration, m.checks, m.ok
from (values
  ('018', 'table hackathons',                         to_regclass('public.hackathons') is not null),
  ('019', 'table hackathon_team_messages',            to_regclass('public.hackathon_team_messages') is not null),
  ('020', 'table hackathon_submissions + bucket',     to_regclass('public.hackathon_submissions') is not null
                                                       and exists (select 1 from storage.buckets where id = 'hackathon-submissions')),
  ('021', 'table hackathon_admin_audit',              to_regclass('public.hackathon_admin_audit') is not null),
  ('022', 'table admin_change_log',                   to_regclass('public.admin_change_log') is not null),
  ('023', 'function private.request_actor_id',        to_regprocedure('private.request_actor_id()') is not null),
  ('024', 'function hackathon_registrants',           to_regprocedure('public.hackathon_registrants(uuid)') is not null),
  ('025', 'table hackathon_team_invitations',         to_regclass('public.hackathon_team_invitations') is not null),
  ('026', 'function hackathon_run_matcher',           exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                                             where n.nspname = 'public' and p.proname = 'hackathon_run_matcher')),
  ('027', 'table hackathon_team_pulse',               to_regclass('public.hackathon_team_pulse') is not null),
  ('028', 'table hackathon_team_member_activity',     to_regclass('public.hackathon_team_member_activity') is not null),
  ('029', 'column hackathon_lobby_messages.system_key',
          exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'hackathon_lobby_messages' and column_name = 'system_key')),
  ('030', 'column hackathon_submissions.is_complete',
          exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'hackathon_submissions' and column_name = 'is_complete')),
  ('031', 'column hackathons.awards_finalized_at',
          exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'hackathons' and column_name = 'awards_finalized_at')),
  ('032', 'function hackathon_public_projects',       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                                             where n.nspname = 'public' and p.proname = 'hackathon_public_projects')),
  ('033', 'function hackathon_landing_relay',         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                                             where n.nspname = 'public' and p.proname = 'hackathon_landing_relay')),
  ('034', 'every active member can read the lobby',   exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                                             where n.nspname = 'private' and p.proname = 'can_read_lobby'
                                                               and pg_get_functiondef(p.oid) like '%is_active_member%')),
  ('035', 'bucket hackathon-decks',                   exists (select 1 from storage.buckets where id = 'hackathon-decks')),
  ('036', 'table hackathon_reviews',                  to_regclass('public.hackathon_reviews') is not null),
  ('037', 'column hackathon_registrations.bring',
          exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'hackathon_registrations' and column_name = 'bring'))
) as m(migration, checks, ok)
order by m.migration;
