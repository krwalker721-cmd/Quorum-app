import * as Sentry from "@sentry/nextjs";

// Edge-runtime error reporting (middleware). Same settings as the server.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});
