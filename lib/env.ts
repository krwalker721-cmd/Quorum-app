// Validates that all Stripe / app environment variables required by the payments
// stack are present. Call from a server context (e.g. a startup check or the
// webhook handler) — never from client code.
const required = [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_MEMBER_PRICE_ID",
  "STRIPE_PARTNER_PRICE_ID",
  "NEXT_PUBLIC_APP_URL",
] as const;

export function validateEnv(): void {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}
