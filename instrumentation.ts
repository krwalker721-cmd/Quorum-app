import * as Sentry from "@sentry/nextjs";

// Next.js loads this once per server runtime at startup.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

// Errors thrown from route handlers, server components, and server actions.
export const onRequestError = Sentry.captureRequestError;
