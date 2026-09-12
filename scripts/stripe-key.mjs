// Shared by the scripts/create-stripe-*.mjs setup scripts: turns the key the
// user supplies for one command into a Stripe client, or exits with a message
// that says what was wrong without ever echoing the key.
//
// The key comes only from STRIPE_SECRET_KEY in that one command's environment —
// never from .env.local, which holds the test keys for local development.

import Stripe from "stripe";

export function stripeFromEnv() {
  // Trimmed because copying from a dashboard or dialog often drags whitespace along.
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();

  if (!key) {
    console.error(
      "STRIPE_SECRET_KEY is not set. Supply it for this one command — see the run\n" +
        "instructions at the top of the script. It is never read from .env.local.",
    );
    process.exit(1);
  }

  const mode = /^(sk|rk)_live_/.test(key) ? "LIVE" : /^(sk|rk)_test_/.test(key) ? "TEST" : null;
  if (!mode) {
    // Say what was received without echoing it: only a recognised prefix (which
    // is not secret) and the length ever get printed.
    const prefix = key.match(/^[a-z]{2,4}_(live|test)_/)?.[0];
    if (prefix?.startsWith("pk_")) {
      console.error(
        `That's the PUBLISHABLE key (${prefix}…), which can't create anything.\n` +
          "Use the SECRET key (sk_live_…) from Developers → API keys.",
      );
    } else {
      console.error(
        "That doesn't look like a Stripe secret key (expected sk_live_… or sk_test_…).\n" +
          `Received ${key.length} characters, starting with ${prefix ? `${prefix}…` : "something that isn't a Stripe key prefix"}.`,
      );
    }
    process.exit(1);
  }

  // Same pinned API version as lib/stripe.ts.
  return { stripe: new Stripe(key, { apiVersion: "2024-06-20" }), mode };
}
