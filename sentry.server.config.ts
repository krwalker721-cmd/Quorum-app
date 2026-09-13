import * as Sentry from "@sentry/nextjs";

// Server-side error reporting: API routes, server components, the Stripe
// webhook, the cron jobs. The DSN is set in Vercel Production only, so local
// and preview builds send nothing.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Errors only. No performance tracing, which Sentry meters separately.
  tracesSampleRate: 0,
  sendDefaultPii: false,
  // Most failures here are caught and logged rather than thrown (the webhook,
  // billing sync, emails, referral bookkeeping), so Sentry would never see
  // them on its own. This forwards every server-side console.error as well.
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});
