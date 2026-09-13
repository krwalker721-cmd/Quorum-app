-- Stripe test → live cutover, PART 1 of 2: READ-ONLY CHECK. Changes nothing.
-- LAUNCH.md, Phase 1: "Clear the test-mode Stripe IDs".
--
-- Safe to run any time. Lists every account that PART 2 would change:
--   * any stored Stripe customer or subscription id — production has only ever
--     run on TEST keys, so all of them are test-mode ids live Stripe rejects
--   * any founding-member stamp — each came from a test checkout, and each one
--     counts against the 100 real founding seats
--
-- Paste into Supabase → SQL Editor and click Run.

select
  p.email,
  p.tier                                as profile_tier,
  s.tier                                as billing_tier,
  s.status,
  s.trial_ends_at,
  s.stripe_subscription_id is not null  as has_test_subscription,
  (s.stripe_customer_id is not null
     or p.stripe_customer_id is not null) as has_test_customer,
  p.is_founding_member,
  p.founding_member_number
from public.profiles p
left join public.subscriptions s on s.user_id = p.id
where s.stripe_subscription_id is not null
   or s.stripe_customer_id is not null
   or p.stripe_customer_id is not null
   or p.is_founding_member
order by p.email;
