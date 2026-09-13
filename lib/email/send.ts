import { LEGAL } from "@/lib/legal";

// Quorum's own emails: the "you're in" approval email and trial reminders. The
// auth emails (confirm, reset, change email) are sent by Supabase through the
// same Resend account over SMTP, from supabase/templates/. This talks to
// Resend's REST API with a plain fetch, so there's no SDK to keep current.

export const EMAIL_FROM = "Quorum <no-reply@quorumhq.co>";

const RESEND_URL = "https://api.resend.com/emails";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Resend ignores a repeat send with the same key for 24 hours. */
  idempotencyKey?: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

/** Never throws. Every caller treats email as best-effort. */
export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not set" };

  const init: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email.to],
      // no-reply@ can't receive mail, so a reply reaches a person.
      reply_to: LEGAL.contactEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  };

  try {
    let res = await fetch(RESEND_URL, init);
    // Resend limits requests per second. One pause covers a burst, like a
    // bulk approval of twelve.
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1000));
      res = await fetch(RESEND_URL, init);
    }
    if (!res.ok) {
      return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
