import type { NextRequest } from "next/server";
import type { createClient } from "@/lib/supabase/server";
import { validateReferralCode, createReferral } from "@/lib/referral-helpers";

// Helpers shared by the two routes that finish an emailed auth link:
//   /auth/confirm  — `?token_hash=` links from Quorum's own templates
//                    (supabase/templates/). These work on any device.
//   /auth/callback — PKCE `?code=` links from Supabase's default templates,
//                    kept for links already in flight.

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The public origin to redirect back to.
 *
 * `new URL(request.url).origin` is NOT safe here: behind Vercel's proxy it
 * resolves to the internal deployment host, so every post-confirmation redirect
 * would leave the user on a *.vercel.app URL (or worse, an internal one) with no
 * session cookie for the real domain. It works perfectly in local dev, which is
 * what makes it a trap. Prefer the configured app URL, then the forwarded host.
 */
export function publicOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

/** Only ever redirect within this app — `next` arrives from a query string. */
export function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

// Supabase's messages for a failed link are written for developers — the PKCE
// one reads "PKCE code verifier not found in storage" — and they used to be
// passed straight to the login page. These are the failures real people hit,
// in words they can act on. Matched on error codes, as Supabase recommends, not
// on message text; callers still log the raw error server-side.
//
// Cross-device failures only happen on /auth/callback: a PKCE `code` can only
// be spent by the browser that started the flow, because the code verifier
// lives in that browser's cookies. /auth/confirm's token-hash links don't have
// that limitation.
const CROSS_DEVICE_CODES = new Set([
  "pkce_code_verifier_not_found", // this browser never started the flow
  "bad_code_verifier",
  "flow_state_not_found",
]);
const EXPIRED_CODES = new Set(["otp_expired", "flow_state_expired"]);

/** `type` is "recovery" for reset links; signup and other links get the
 *  general wording. */
export function linkErrorMessage(code: string | undefined, type: string | null): string {
  const reset = type === "recovery";
  if (code && CROSS_DEVICE_CODES.has(code)) {
    return reset
      ? "reset links only work in the browser you requested them from. tap “forgot?” to send a new one, then open the email on this device."
      : "this link only works in the browser you signed up in. open it there, or try logging in here.";
  }
  if (code && EXPIRED_CODES.has(code)) {
    return reset
      ? "that reset link has expired or was already used. tap “forgot?” to send a new one."
      : "that link has expired or was already used. try logging in here.";
  }
  return reset
    ? "we couldn’t open that reset link. tap “forgot?” to send a new one."
    : "we couldn’t sign you in with that link. try logging in here.";
}

/**
 * Record the referral for a newly confirmed signup, if there is one.
 *
 * The code normally sits in the `referral_code` cookie set by /signup. A
 * confirmation opened on another device has no such cookie, so /signup also
 * saves the code in the user's metadata, and that is the fallback. Claiming
 * needs a session, which only exists once the link has been verified.
 * validateReferralCode, the self-referral check, and the unique constraint on
 * referrals.referred_id still apply either way.
 *
 * Best-effort: a failed claim must never block confirmation. Returns whether
 * the cookie was present, so the caller can clear it.
 */
export async function claimSignupReferral(
  request: NextRequest,
  supabase: ServerClient,
): Promise<boolean> {
  const cookieCode = request.cookies.get("referral_code")?.value;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const metaCode = user?.user_metadata?.referral_code;
    const code = cookieCode || (typeof metaCode === "string" ? metaCode : undefined);
    if (user && code) {
      const { valid, referrerId } = await validateReferralCode(code);
      if (valid && referrerId && referrerId !== user.id) {
        await createReferral(referrerId, user.id, code);
      }
    }
  } catch (e) {
    console.error("[auth] referral claim failed:", e);
  }
  return !!cookieCode;
}
