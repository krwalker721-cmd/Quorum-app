import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import s from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Quorum collects, why, who can see it, and how to control it.",
};

// Draft written 2026-09-12 from a survey of what the app actually stores — not
// reviewed by a lawyer. Re-check this page whenever a table, a third-party
// service, or an email type is added. See LAUNCH.md, Phase 0.
export default function PrivacyPage() {
  return (
    <>
      <p className={s.kicker}>// privacy policy</p>
      <h1>Privacy Policy</h1>
      <p className={s.meta}>Effective {LEGAL.effectiveDate}</p>

      <div className={s.summary}>
        <p>
          <strong>The short version.</strong> We collect what you give us to run a private
          community — your profile, what you post, and your billing status. We don’t sell your
          data, we don’t run ads, and there are no third-party trackers. Payments go through
          Stripe, so we never see your card number. You can download your data or delete
          your account from your settings anytime.
        </p>
      </div>

      <h2>1. Who we are</h2>
      <p>
        Quorum is operated by {LEGAL.party}, based in {LEGAL.state} (“Quorum,” “we,” “us”).
        This policy explains how we handle personal information when you use Quorum at{" "}
        {LEGAL.site.replace("https://", "")}. It’s part of our{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>

      <h2>2. What we collect</h2>
      <p><strong>Information you give us</strong></p>
      <ul>
        <li>
          <strong>Account:</strong> your name, email address, and password. Your password is
          stored as a secure hash by our authentication provider; we can’t read it. We also
          record which version of our Terms you accepted, and when.
        </li>
        <li>
          <strong>Profile:</strong> your username, the stage of your company, what you’re
          building, your skills, and your bio.
        </li>
        <li>
          <strong>What you post:</strong> pulse posts and replies, cohort posts, weekly
          check-ins, direct messages, collab board projects and applications, handshake
          agreements, vault notes and saved items, votes on decisions, vouches, introductions,
          answers to feedback questions, and reports you file.
        </li>
        <li>
          <strong>Invitations:</strong> if you invite someone to a cohort and enter their
          email address, we store it with the invite (see section 6).
        </li>
      </ul>
      <p><strong>Information created as you use Quorum</strong></p>
      <ul>
        <li>
          <strong>Community:</strong> which cohort you’re in, when you joined, and your
          settings and notification preferences.
        </li>
        <li>
          <strong>Referrals:</strong> your referral code, who referred you, who you referred,
          and whether those referrals are active.
        </li>
        <li>
          <strong>Activity:</strong> the dates you log in (one record per day, with no IP
          address or device details), usage counts that apply plan limits, and your
          onboarding progress.
        </li>
        <li>
          <strong>Billing:</strong> your plan, subscription status, trial dates, the IDs that
          link your account to Stripe, and when you agreed to automatic renewal.
        </li>
      </ul>
      <p><strong>Information handled by our providers</strong></p>
      <ul>
        <li>
          <strong>Payments:</strong> Stripe collects and stores your card details and billing
          address. We never receive your full card number.
        </li>
        <li>
          <strong>Technical logs:</strong> our hosting and database providers keep standard
          server logs, such as IP addresses and request times, to run and secure their
          services.
        </li>
      </ul>

      <h2>3. How we use it</h2>
      <ul>
        <li>to run Quorum: your account, your cohort, and the features you use;</li>
        <li>to review applications and place members into cohorts;</li>
        <li>to bill you, manage trials, and apply referral discounts;</li>
        <li>to keep the community safe: reviewing reports, preventing abuse, and enforcing our Terms;</li>
        <li>to send the emails the service needs, such as email confirmation, password resets, receipts, and billing notices; and</li>
        <li>to understand how Quorum is used, so we can improve it.</li>
      </ul>
      <p>
        We don’t send marketing email today. If we start, you’ll be able to opt out. We don’t
        sell your personal information, and we don’t share it for targeted advertising.
      </p>

      <h2>4. Who can see what</h2>
      <ul>
        <li><strong>Other members</strong> can see your profile.</li>
        <li>
          <strong>Your cohort</strong> can see your cohort posts and your check-ins. A
          check-in you mark anonymous is shown without your name, but it’s still stored with
          your account, and Quorum’s administrators can see who wrote it.
        </li>
        <li>
          <strong>Pulse posts</strong> are visible across the network. Members can nominate
          posts for the vault’s community wisdom collection, and administrators decide which
          to feature; a featured post can be seen by members outside your cohort.
        </li>
        <li>
          <strong>Direct messages</strong> are visible only to you and the person you’re
          messaging. <strong>Handshake agreements</strong> are visible only to the two members
          involved.
        </li>
        <li>
          <strong>Collab board</strong> projects are visible to members, and your applications
          to a project are visible to its owner.
        </li>
        <li>
          <strong>If you joined through a referral link,</strong> the member who referred you
          can see that you joined and whether your membership is active, because it affects
          their discount.
        </li>
        <li>
          <strong>Quorum’s administrators</strong> can access account and content data where
          needed to run the service, review reports, enforce our Terms, and help you.
        </li>
      </ul>

      <h2>5. Service providers</h2>
      <p>
        We use a small number of providers to run Quorum. They process data on our behalf
        and only as needed to provide their service to us:
      </p>
      <ul>
        <li><strong>Supabase</strong> — database and authentication;</li>
        <li><strong>Stripe</strong> — payments and billing;</li>
        <li><strong>Vercel</strong> — hosting;</li>
        <li>
          <strong>Resend</strong> — email delivery: account emails, trial reminders, and
          approval notices; and
        </li>
        <li>
          <strong>Sentry</strong> — error monitoring: technical details when something breaks,
          such as the page or request involved and your browser type.
        </li>
      </ul>
      <p>
        We may also disclose information if the law requires it, to protect the safety or
        rights of our members or others, or to a successor if Quorum is transferred to a new
        owner or entity, in which case this policy will continue to apply to your
        information.
      </p>

      <h2>6. If someone invited you</h2>
      <p>
        If a member invites you to a cohort and enters your email address, we store it with
        the invitation so the invite can be tracked. We don’t add you to any mailing list or
        use it for anything else. To have it removed, email us.
      </p>

      <h2>7. Cookies and local storage</h2>
      <p>
        We use cookies only to keep you logged in. Your browser’s local storage holds a few
        display preferences, such as your theme and which panels you’ve collapsed. We don’t
        use advertising or analytics cookies, and there are no third-party trackers on
        Quorum.
      </p>
      <p>
        <strong>Do Not Track.</strong> We don’t track you across other websites, and no
        third party collects information about your activity across websites through
        Quorum. So there’s nothing for a browser’s “Do Not Track” signal to switch off, and
        Quorum works the same whether or not it’s on.
      </p>

      <h2>8. How long we keep it</h2>
      <p>
        We keep your information for as long as your account exists. When you delete your
        account, we delete your profile and the content associated with it, cancel any
        subscription, and delete your customer record — including your saved card — at
        Stripe. Some records remain for a limited time:
      </p>
      <ul>
        <li>Stripe keeps records of past payments and invoices, as financial regulations require;</li>
        <li>backups roll off on our providers’ schedule;</li>
        <li>
          content that’s shared with other members may remain visible to them where it’s part
          of their own records, such as a conversation; and
        </li>
        <li>we keep what we need to resolve disputes, prevent fraud, or meet legal obligations.</li>
      </ul>

      <h2>9. Your choices and rights</h2>
      <ul>
        <li>
          <strong>Access:</strong> download a copy of your data anytime from your settings.
        </li>
        <li>
          <strong>Correct:</strong> edit your profile from your settings, or ask us to correct
          anything you can’t change yourself.
        </li>
        <li>
          <strong>Delete:</strong> delete your account from your settings, or ask us to do it.
        </li>
        <li>
          <strong>Other requests:</strong> email us about anything else, including questions
          about how your data is used.
        </li>
      </ul>
      <p>
        We’ll respond within 30 days. We offer these rights to every member, whether or not a
        privacy law in your state requires it, and we won’t treat you differently for using
        them.
      </p>

      <h2>10. Security</h2>
      <p>
        Data travels over encrypted connections, access is restricted with database-level
        permissions, and card data never touches our servers. No system is perfectly
        secure, though, so we can’t guarantee absolute security. If a breach affects your
        personal information, we’ll notify you as the law requires.
      </p>

      <h2>11. Age requirement</h2>
      <p>
        Quorum is for people 18 and over. We don’t knowingly collect information from anyone
        younger, and we’ll delete it if we learn we have.
      </p>

      <h2>12. Where Quorum operates</h2>
      <p>
        Quorum is currently offered in the United States. Our providers may process
        information in the United States and in other countries where they operate.
      </p>

      <h2>13. Changes to this policy</h2>
      <p>
        We may update this policy. For material changes, we’ll notify you by email or in the
        app before they take effect. The date at the top shows when it last changed.
      </p>

      <h2>14. Contact</h2>
      <p>
        Privacy questions and requests: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>
    </>
  );
}
