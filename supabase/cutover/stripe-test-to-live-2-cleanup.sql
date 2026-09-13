-- Stripe test → live cutover, PART 2 of 2: THE CLEANUP.
-- LAUNCH.md, Phase 1: "Clear the test-mode Stripe IDs".
--
-- WHEN: during the cutover, right AFTER the live-key deploy is confirmed.
-- Not before — a checkout on the old test-key deploy would write fresh test
-- ids back in. Run stripe-test-to-live-1-check.sql first and read it.
--
-- WHY: production has only ever run on Stripe TEST keys, so every Stripe id
-- stored here is test-mode, and live Stripe rejects it ("No such customer").
-- getOrCreateStripeCustomer returns a stored id unchecked, so checkout, the
-- billing portal, and the referral card form would fail for any test-era
-- account, and account deletion (which aborts on any Stripe error, by design)
-- couldn't delete one. With the ids gone, checkout creates a fresh live
-- customer, and deletion searches live Stripe, finds nothing, and proceeds.
--
-- The SQL editor runs a multi-statement paste as ONE transaction, so this is
-- all-or-nothing. It runs without a user session, so the privileged-column
-- guard from migration 014 (which only clamps a member editing their own row)
-- lets these writes through.
--
-- Deliberately NOT touched: tiers granted by hand in the admin panel (no Stripe
-- subscription behind them), card-free trials that are still running, and the
-- lapse columns from migration 013 (lapsed_at, seat_released_at).

-- 1. Access that came from a test subscription goes away with it. Profiles
--    first, while the subscription ids still say which rows to touch.
update public.profiles p
set tier = 'free'
from public.subscriptions s
where s.user_id = p.id
  and s.stripe_subscription_id is not null
  and p.tier in ('member', 'partner');

update public.subscriptions
set tier                   = 'free',
    status                 = case when trial_ends_at > now() then 'trialing' else 'canceled' end,
    stripe_subscription_id = null,
    current_period_start   = null,
    current_period_end     = null,
    cancel_at_period_end   = false
where stripe_subscription_id is not null;

-- 2. Forget every test-mode customer. The next checkout creates a live one.
update public.subscriptions set stripe_customer_id = null where stripe_customer_id is not null;
update public.profiles      set stripe_customer_id = null where stripe_customer_id is not null;

-- 3. Give back the founding seats that test checkouts claimed.
update public.profiles
set is_founding_member     = false,
    founding_member_number = null
where is_founding_member;

-- 4. Verify. Every number should be 0.
select
  (select count(*) from public.subscriptions where stripe_subscription_id is not null) as test_subscriptions_left,
  (select count(*) from public.subscriptions where stripe_customer_id is not null)     as test_customers_in_billing,
  (select count(*) from public.profiles      where stripe_customer_id is not null)     as test_customers_on_profiles,
  (select count(*) from public.profiles      where is_founding_member)                  as founding_stamps_left;
