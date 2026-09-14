import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { LAPSE_GRACE_DAYS } from "@/lib/pricing";
import s from "../legal.module.css";

export const metadata: Metadata = {
  title: "Refunds & cancellation",
  description: "How cancelling works, and why Quorum doesn’t issue refunds.",
};

// Draft written 2026-09-12 — not reviewed by a lawyer. The behaviour described
// here mirrors the Customer Portal settings (cancel at period end) and
// app/api/account/delete (immediate cancel, no proration). See LAUNCH.md.
export default function RefundsPage() {
  return (
    <>
      <p className={s.kicker}>// refunds &amp; cancellation</p>
      <h1>Refund &amp; Cancellation Policy</h1>
      <p className={s.meta}>Effective {LEGAL.effectiveDate}</p>

      <div className={s.summary}>
        <p>
          <strong>The short version.</strong> Cancel anytime, and you keep access until the
          end of the period you’ve paid for. We don’t refund payments, including partial
          months and unused time on annual plans, except for billing errors. Deleting your
          account ends access immediately, so cancel first if you want to use the time
          you’ve paid for.
        </p>
      </div>

      <h2>Cancelling</h2>
      <p>
        Go to your settings and open billing. Cancellation takes effect at the end of your
        current billing period. Until then, you keep full access and won’t be charged again.
      </p>
      <p>
        When your paid access ends, your cohort seat is held for {LAPSE_GRACE_DAYS} days in
        case you come back. After that, it goes back to the pool so your cohort stays full.
      </p>

      <h2>Refunds</h2>
      <p>
        <strong>All payments are non-refundable.</strong> That covers monthly and annual
        memberships and the founding rate. We don’t refund partial billing periods or unused
        time on an annual plan. Referral discounts have no cash value.
      </p>

      <h2>Free trials</h2>
      <ul>
        <li>
          <strong>A trial started without a card</strong> is never charged. When it ends,
          nothing happens unless you choose to subscribe.
        </li>
        <li>
          <strong>A trial where you added a card</strong> becomes a paid subscription on its
          end date. Cancel before then and you won’t be charged.
        </li>
      </ul>

      <h2>Deleting your account</h2>
      <p>
        Deleting your account isn’t the same as cancelling. It{" "}
        <strong>
          cancels your subscription immediately and ends your access at once, with no refund
          for the rest of the period
        </strong>
        . If you want to use the time you’ve already paid for, cancel your membership first
        and delete your account after your access ends.
      </p>

      <h2>When we do refund</h2>
      <ul>
        <li>
          <strong>Billing errors</strong>, such as a duplicate charge, or a charge after a
          cancellation that went through.
        </li>
        <li>
          <strong>If we end your membership</strong> when you haven’t broken our{" "}
          <Link href="/terms">Terms</Link>, or <strong>if we shut Quorum down</strong>: we
          refund the prepaid, unused part of your subscription.
        </li>
        <li><strong>Where the law requires a refund.</strong></li>
      </ul>

      <h2>Questions about a charge</h2>
      <p>
        If something looks wrong on your statement, email us at{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> before disputing it
        with your bank. We’ll look into it and reply within a few business days. Charges
        appear on your statement as <strong>QUORUM</strong>.
      </p>
    </>
  );
}
