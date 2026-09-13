# Supabase auth email templates

The source of truth for the auth emails Quorum sends. Supabase doesn't read this
folder — the templates are pasted into the dashboard by hand — so after changing
a file here, paste it again.

**Where:** Supabase → Authentication → Emails → Templates. For each template,
set the subject and replace the whole message body with the file's contents.

| Supabase template | File | Subject | Sent when |
|---|---|---|---|
| Confirm signup | `confirm-signup.html` | Confirm your email for Quorum | Someone signs up — only once "Confirm email" is on |
| Reset Password | `reset-password.html` | Reset your Quorum password | Someone uses /forgot-password |
| Change Email Address | `change-email.html` | Confirm your new email for Quorum | A member changes their email in Settings |

Quorum doesn't use magic links, invites, or reauthentication, so those
templates are left at Supabase's defaults.

## Why the links look like this

Every link is `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`,
handled by `app/auth/confirm/route.ts` with `verifyOtp`, instead of Supabase's
default `{{ .ConfirmationURL }}`:

- **Works on any device.** The default link finishes with a PKCE code exchange
  that only works in the browser that requested the email. `verifyOtp` with a
  token hash doesn't need that.
- **Stays on our own domain.** A `*.supabase.co` link in an email from
  `quorumhq.co` is a spam signal.

## Order matters

**Deploy `/auth/confirm` before saving any of these templates.** Until it
exists, every link these templates produce is a 404. `/auth/callback` stays in
place for links sent with the old templates.

`{{ .SiteURL }}` is whatever Supabase's Site URL is set to. It changes from the
`vercel.app` host to `quorumhq.co` during the Phase 1 cutover (LAUNCH.md), and
the links follow automatically.

"Expires after an hour" in the reset email matches Supabase's default email OTP
expiry (3600 seconds). If that setting changes, update the wording.
