import * as Sentry from "@sentry/nextjs";

// Browser-side error reporting. NEXT_PUBLIC_SENTRY_DSN is baked in at build
// time and set for Production only, so local and preview builds send nothing.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
