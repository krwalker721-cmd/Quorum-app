import { LEGAL } from "@/lib/legal";
import { FOUNDING_SEATS, LAPSE_GRACE_DAYS, PRICING } from "@/lib/pricing";

// Quorum's own emails, styled to match the auth templates in supabase/templates/
// so everything a member receives looks like it came from one place. Each
// builder returns an HTML body and a plain-text twin; sending both helps
// deliverability and covers text-only clients.

export type EmailContent = { subject: string; html: string; text: string };

type Body = {
  /** Inbox preview line, shown after the subject and hidden in the email. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta: { label: string; href: string };
  footnote?: string;
};

const FOOTER = "Quorum · a private community for founders · quorumhq.co";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function firstName(fullName: string | null | undefined): string {
  return fullName?.trim().split(/\s+/)[0] || "there";
}

function render(subject: string, b: Body): EmailContent {
  const paragraphs = b.paragraphs
    .map(
      (t) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${esc(t)}</p>`,
    )
    .join("\n            ");
  const footnote = b.footnote
    ? `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#6b7280;">${esc(b.footnote)}</p>`
    : "";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f6f7f9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(b.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
        <tr>
          <td style="padding:28px 28px 8px;">
            <p style="margin:0;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:14px;letter-spacing:0.08em;color:#0d1117;">quorum<span style="color:#f59e0b;">.</span></p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 4px;">
            <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:600;color:#0d1117;">${esc(b.heading)}</h1>
            ${paragraphs}
            <a href="${esc(b.cta.href)}" style="display:inline-block;margin-top:4px;background:#f59e0b;color:#1a1204;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;">${esc(b.cta.label)}</a>
            <p style="margin:24px 0 6px;font-size:13px;line-height:1.5;color:#6b7280;">Or paste this link into your browser:</p>
            <p style="margin:0 0 20px;font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all;">${esc(b.cta.href)}</p>
            ${footnote}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 24px;border-top:1px solid #f0f1f3;">
            <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">${FOOTER}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    b.heading,
    "",
    ...b.paragraphs.flatMap((t) => [t, ""]),
    `${b.cta.label}: ${b.cta.href}`,
    "",
    ...(b.footnote ? [b.footnote, ""] : []),
    FOOTER,
  ].join("\n");

  return { subject, html, text };
}

/** Sent from approveUser() the moment a founder is let in. */
export function approvedEmail(p: { fullName: string | null; trialDays: number }): EmailContent {
  return render("You're in — welcome to Quorum", {
    preheader: `Your group has opened. Your ${p.trialDays}-day free trial starts today.`,
    heading: "You're in",
    paragraphs: [
      `Hi ${firstName(p.fullName)}, your group has opened, and your seat in Quorum is ready.`,
      `You'll be placed in a cohort of up to twelve founders. Your free trial starts today and runs for ${p.trialDays} days. No card needed.`,
      "Log in to meet your cohort.",
    ],
    cta: { label: "Log in to Quorum", href: `${LEGAL.site}/login` },
  });
}

const DAY_MS = 86_400_000;

function endsIn(daysLeft: number): string {
  if (daysLeft < 1) return "in less than a day";
  const n = Math.round(daysLeft);
  return n === 1 ? "in about a day" : `in ${n} days`;
}

/** Sent 7, 3, and 1 days before a card-free trial ends. */
export function trialReminderEmail(p: {
  fullName: string | null;
  trialEndsAt: Date;
  now: Date;
  foundingSeatsLeft: number;
}): EmailContent {
  const when = endsIn((p.trialEndsAt.getTime() - p.now.getTime()) / DAY_MS);
  // Members could be anywhere; the business runs on Eastern time, so say so.
  const at = p.trialEndsAt.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });

  const price =
    p.foundingSeatsLeft > 0
      ? `Membership is $${PRICING.member.monthly}/month or $${PRICING.member.annual}/year. The founding rate, $${PRICING.founding.monthly}/month locked for life, is still open: ${p.foundingSeatsLeft} of ${FOUNDING_SEATS} seats left.`
      : `Membership is $${PRICING.member.monthly}/month or $${PRICING.member.annual}/year.`;

  return render(`Your Quorum trial ends ${when}`, {
    preheader: `Nothing will be charged. Subscribe to keep your seat in your cohort.`,
    heading: `Your trial ends ${when}`,
    paragraphs: [
      `Hi ${firstName(p.fullName)}, your free trial of Quorum ends on ${at}.`,
      `Nothing will be charged: you never gave us a card, so the trial simply ends. After that your account is read-only. You can still read your cohort, but you can't post, reply, or message. Your seat in your cohort is held for ${LAPSE_GRACE_DAYS} days, then it opens to someone new.`,
      price,
      "Subscribe before your trial ends to keep full access without a gap.",
    ],
    cta: { label: "Keep my seat", href: `${LEGAL.site}/pricing` },
    footnote: `You're getting this because your Quorum trial is ending. You can turn these reminders off in Settings, under notifications: ${LEGAL.site}/settings`,
  });
}
