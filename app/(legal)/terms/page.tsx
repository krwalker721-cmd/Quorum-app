import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { FOUNDING_SEATS, TRIAL_DAYS } from "@/lib/pricing";
import s from "../legal.module.css";

export const metadata: Metadata = {
  title: "terms of service — quorum",
  description: "The agreement between you and Quorum.",
};

// Draft written 2026-09-12 — not reviewed by a lawyer. See LAUNCH.md, Phase 0.
export default function TermsPage() {
  return (
    <>
      <p className={s.kicker}>// terms of service</p>
      <h1>Terms of Service</h1>
      <p className={s.meta}>Effective {LEGAL.effectiveDate}</p>

      <div className={s.summary}>
        <p>
          <strong>The short version.</strong> Quorum is a paid, invite-only community for
          founders. Memberships renew automatically until you cancel, and you can cancel
          anytime. Payments aren’t refunded, but you keep access until the end of the period
          you paid for. Keep what other members share with you confidential, treat people
          well, and don’t abuse the referral program. This summary isn’t a substitute for
          the full terms below.
        </p>
      </div>

      <h2>1. Who we are</h2>
      <p>
        Quorum is operated by {LEGAL.party}, a sole proprietorship based in {LEGAL.state}{" "}
        (“Quorum,” “we,” “us”). These Terms of Service (“Terms”) are a binding agreement
        between you and us. By creating an account or using Quorum, you agree to these Terms
        and to our <Link href="/privacy">Privacy Policy</Link> and{" "}
        <Link href="/refunds">Refund &amp; Cancellation Policy</Link>. If you don’t agree,
        don’t use Quorum.
      </p>

      <h2>2. Eligibility and your account</h2>
      <ul>
        <li>You must be at least 18 and able to enter a binding contract.</li>
        <li>
          Quorum is currently offered to people in the United States. We may decline or close
          accounts created from outside the US until we support other regions.
        </li>
        <li>
          Membership is by application. We may approve, decline, or waitlist any application
          at our discretion, and we don’t owe an explanation for declining one.
        </li>
        <li>
          One account per person. Keep the information on your account accurate, keep your
          password secure, and don’t share your account. You’re responsible for what happens
          under your account.
        </li>
      </ul>

      <h2>3. The membership</h2>
      <p>
        A membership gives you access to Quorum’s features, which today include cohorts of up
        to twelve founders, weekly check-ins, the pulse feed, the collab board, the vault,
        direct messages, and referrals. We place members into cohorts at our discretion and
        may change, add, or remove features over time. We don’t guarantee any particular
        cohort, level of activity, introduction, or business outcome.
      </p>

      <h2>4. Free trials</h2>
      <ul>
        <li>
          New members may get a free trial. Its length is shown when you start it — currently{" "}
          {TRIAL_DAYS.standard} days, or {TRIAL_DAYS.referred} days if you were referred by a
          member. One trial per person.
        </li>
        <li>
          <strong>A trial you start without adding a card never turns into a paid
          subscription on its own.</strong> You’re only charged if you choose to subscribe.
        </li>
        <li>
          <strong>If you add a card to claim a trial, your paid subscription starts
          automatically when the trial ends</strong>, at the price shown when you added the
          card, unless you cancel before the trial’s end date. You’ll be asked to agree to
          this before your card is saved, and we’ll email you a reminder about a week before
          the trial ends.
        </li>
      </ul>

      <h2>5. Subscriptions, billing, and automatic renewal</h2>
      <p>
        Paid memberships are subscriptions billed in advance, monthly or annually, at the
        price shown when you subscribe.{" "}
        <strong>
          Your subscription renews automatically at the end of each billing period, at the
          then-current price for your plan, until you cancel.
        </strong>{" "}
        By subscribing, you authorize us to charge your payment method for each renewal.
        Prices don’t include taxes; where tax applies, it’s added at checkout.
      </p>
      <p>
        Every charge comes with an emailed receipt showing the amount and how to cancel. On
        an annual plan, we’ll also remind you by email before each renewal.
      </p>
      <p>
        Payments are processed by Stripe. We never see or store your full card number. If a
        payment fails, we may retry it and may limit your access until it’s resolved.
      </p>

      <h2>6. Cancellation and refunds</h2>
      <p>
        You can cancel anytime from your settings. Cancellation takes effect at the end of
        your current billing period: you keep access until then and aren’t charged again.{" "}
        <strong>
          Payments are non-refundable, including for partial periods and for unused time on
          annual plans
        </strong>
        , except for billing errors, where the law requires a refund, or as described in
        sections 13 and 14.
      </p>
      <p>
        <strong>Deleting your account is different from cancelling.</strong> It cancels your
        subscription immediately and ends your access at once, without a refund for the rest
        of the period. If you want to keep access until your period ends, cancel first and
        delete your account afterwards. The full details are in our{" "}
        <Link href="/refunds">Refund &amp; Cancellation Policy</Link>.
      </p>

      <h2>7. Price changes and the founding rate</h2>
      <p>
        We may change our prices. If you already subscribe, we’ll tell you before a new price
        applies to your next renewal — no less than 7 and no more than 30 days ahead — so you
        can cancel first if you choose.
      </p>
      <p>
        The first {FOUNDING_SEATS} founding members pay the founding rate for as long as
        their founding subscription stays continuously active, even if standard prices rise.
        If a founding subscription is cancelled or lapses, rejoining is at the current
        standard price.
      </p>

      <h2>8. Referral program</h2>
      <ul>
        <li>
          Members can earn a recurring discount on their own membership based on how many
          people they referred are currently active members, as described on the referrals
          page. Referred members may get a longer trial.
        </li>
        <li>
          Referral discounts have no cash value, can’t be transferred, apply only to your own
          subscription, and adjust automatically as your number of active referrals changes —
          including being reduced or removed.
        </li>
        <li>
          No self-referrals, duplicate or fake accounts, spam, or paying people to sign up.
          We may withhold or remove referral discounts, and suspend accounts, for abuse.
        </li>
        <li>
          We may change or end the referral program with notice. Discounts already applied to
          past invoices stay applied.
        </li>
      </ul>

      <h2>9. Your content</h2>
      <p>
        You own what you post on Quorum — posts, replies, check-ins, messages, notes,
        projects, and anything else (“your content”). You give us a non-exclusive,
        worldwide, royalty-free license to host, store, display, and transmit your content
        only as needed to run Quorum and show it to the people you’ve shared it with.
        Members can nominate posts for the vault’s community wisdom collection, and our
        administrators decide which to feature. A featured post can be seen by members
        outside your cohort; ask us and we’ll remove yours.
      </p>
      <p>
        The license ends when you delete your content or your account, except for copies
        other members have already saved and for backups kept for a limited period. You’re
        responsible for your content, and you confirm you have the right to share it.
      </p>

      <h2>10. Confidentiality inside the community</h2>
      <p>
        Quorum works because founders speak candidly. Treat what other members share with
        you inside Quorum — cohort discussions, check-ins, messages, collab details, and
        handshake agreements — as confidential. Don’t publish it, share it outside Quorum, or
        pass on screenshots of it without the member’s permission.
      </p>
      <p>
        We can’t guarantee that every member honors this, so use judgment about what you
        share. Quorum isn’t a substitute for a nondisclosure agreement. Agreements that
        members make with each other, including handshakes, are between those members;
        Quorum isn’t a party to them and doesn’t enforce them.
      </p>

      <h2>11. Acceptable use</h2>
      <p>When using Quorum, don’t:</p>
      <ul>
        <li>harass, threaten, or discriminate against anyone;</li>
        <li>spam, or send unsolicited promotions in bulk;</li>
        <li>impersonate anyone or misrepresent who you are or what you’re building;</li>
        <li>post anything unlawful, or anything that infringes someone else’s rights;</li>
        <li>share other people’s private information without their permission;</li>
        <li>scrape, crawl, or harvest data from Quorum;</li>
        <li>access other people’s accounts, or get around our security, usage limits, or access controls;</li>
        <li>sell, rent, or share your account;</li>
        <li>use Quorum to offer securities or investments in ways that break the law; or</li>
        <li>upload malware or interfere with how Quorum runs.</li>
      </ul>
      <p>
        Members can report content. We may remove content, and suspend or terminate accounts,
        that we believe break these Terms.
      </p>

      <h2>12. No professional advice</h2>
      <p>
        What members share on Quorum, including in the vault, is their own opinion. It isn’t
        legal, financial, tax, investment, or other professional advice. We don’t verify
        what members say about themselves or their businesses. Any deal, hire, collaboration,
        or investment arranged through Quorum is between the people involved — do your own
        diligence.
      </p>

      <h2>13. Ending your membership</h2>
      <p>
        You can stop using Quorum anytime and delete your account from your settings. We may
        suspend or terminate your account if you break these Terms, don’t pay, create legal
        risk for us, or put other members at risk, with notice where reasonable. If we end
        your membership when you haven’t broken these Terms, we’ll refund any prepaid, unused
        portion of your subscription.
      </p>

      <h2>14. Availability and changes to the service</h2>
      <p>
        We work to keep Quorum running, but it may sometimes be unavailable, and we may change
        or discontinue parts of it. If we shut Quorum down entirely, we’ll give you
        reasonable notice and refund any prepaid, unused portion of your subscription.
      </p>

      <h2>15. Disclaimers</h2>
      <p>
        To the fullest extent the law allows, Quorum is provided “as is” and “as available,”
        without warranties of any kind, whether express or implied, including warranties of
        merchantability, fitness for a particular purpose, and non-infringement.
      </p>

      <h2>16. Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, we aren’t liable for any indirect, incidental,
        special, consequential, or punitive damages, or for lost profits, revenue, data, or
        business opportunities, arising from your use of Quorum. Our total liability for any
        claim relating to Quorum is limited to the greater of the amount you paid us in the
        12 months before the claim arose, or $100. Some jurisdictions don’t allow these
        limits; where that’s the case, they apply only as far as the law permits.
      </p>

      <h2>17. Indemnity</h2>
      <p>
        You agree to indemnify us against claims, losses, and costs, including reasonable
        legal fees, that arise from your content, or from your breaking these Terms or the
        law.
      </p>

      <h2>18. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the Commonwealth of {LEGAL.state}, without
        regard to its conflict-of-laws rules. If a dispute arises, please contact us first;
        we’ll try in good faith to resolve it informally within 30 days. If we can’t, the
        dispute will be decided exclusively by the state or federal courts located in{" "}
        {LEGAL.state}, and you and we both consent to their jurisdiction. Either of us may
        instead bring an eligible claim in small claims court.
      </p>

      <h2>19. Changes to these Terms</h2>
      <p>
        We may update these Terms. For material changes, we’ll give you at least 14 days’
        notice by email or in the app before they take effect. If you keep using Quorum after
        that, you accept the updated Terms. If you don’t agree to them, cancel your
        membership before they take effect.
      </p>

      <h2>20. Copyright complaints</h2>
      <p>
        If you believe something on Quorum infringes your copyright, email{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> with: the work you
        believe is infringed; where the material appears on Quorum; your contact details; a
        statement that you believe in good faith the use isn’t authorized; a statement,
        under penalty of perjury, that your notice is accurate and that you own the
        copyright or are authorized to act for the owner; and your physical or electronic
        signature. We remove infringing material when we’re notified of it, and we
        terminate the accounts of repeat infringers.
      </p>

      <h2>21. General</h2>
      <p>
        These Terms, together with the Privacy Policy and the Refund &amp; Cancellation
        Policy, are the entire agreement between you and us. If any part is found
        unenforceable, the rest still applies. Our not enforcing a provision isn’t a waiver
        of it. You can’t transfer these Terms without our consent. We may transfer them to a
        successor that takes over Quorum, including a business entity formed to operate it.
        We may send you notices by email or in the app.
      </p>

      <h2>22. Contact</h2>
      <p>
        Questions about these Terms: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>
    </>
  );
}
