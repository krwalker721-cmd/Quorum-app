import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateReferralCode, createReferral } from "@/lib/referral-helpers";

// The landing point for every emailed auth link: signup confirmation, password
// recovery, and magic links. Supabase sends the user here with a one-time `code`
// which has to be exchanged for a session cookie — without this route the links
// land on a page that has no idea what to do with the code, and the user is
// stuck holding a valid token nothing will spend.
//
// Runs on the server so the exchange writes real HTTP-only cookies rather than
// leaving the session in localStorage.
export const dynamic = "force-dynamic";

/**
 * The public origin to redirect back to.
 *
 * `new URL(request.url).origin` is NOT safe here: behind Vercel's proxy it
 * resolves to the internal deployment host, so every post-confirmation redirect
 * would leave the user on a *.vercel.app URL (or worse, an internal one) with no
 * session cookie for the real domain. It works perfectly in local dev, which is
 * what makes it a trap. Prefer the configured app URL, then the forwarded host.
 */
function publicOrigin(request: NextRequest): string {
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
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

// Supabase's messages for a failed link are written for developers — the PKCE
// one reads "PKCE code verifier not found in storage" — and they used to be
// passed straight to the login page. These are the failures real people hit,
// in words they can act on. Matched on error codes, as Supabase recommends, not
// on message text; the raw error is still logged server-side.
//
// The common case: a reset (or signup) requested on a laptop and opened on a
// phone. PKCE only lets the browser that started the flow finish it, because
// the code verifier lives in that browser's cookies.
const CROSS_DEVICE_CODES = new Set([
  "pkce_code_verifier_not_found", // this browser never started the flow
  "bad_code_verifier",
  "flow_state_not_found",
]);
const EXPIRED_CODES = new Set(["otp_expired", "flow_state_expired"]);

/** `type` is "recovery" for reset links (set by /forgot-password); signup and
 *  magic links carry no type. */
function linkErrorMessage(code: string | undefined, type: string | null): string {
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  // Supabase reports link failures (expired, already used) as query params
  // rather than a non-2xx, so check them before trying to spend the code.
  if (searchParams.get("error") || searchParams.get("error_code")) {
    const linkCode = searchParams.get("error_code") ?? undefined;
    console.error(
      "[auth/callback] link error:",
      searchParams.get("error"),
      linkCode,
      searchParams.get("error_description"),
    );
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(linkErrorMessage(linkCode, type))}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(linkErrorMessage(undefined, type))}`,
    );
  }

  const supabase = await createClient();
  let exchangeError: { name?: string; code?: string; message: string } | null = null;
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchangeError = error;
  } catch (e) {
    // A missing code verifier can surface as a thrown error rather than a
    // returned one; handle both the same way.
    exchangeError = e as { name?: string; code?: string; message: string };
  }

  if (exchangeError) {
    console.error(
      "[auth/callback] code exchange failed:",
      exchangeError.name,
      exchangeError.code,
      exchangeError.message,
    );
    const failure =
      exchangeError.name === "AuthPKCECodeVerifierMissingError"
        ? "pkce_code_verifier_not_found"
        : exchangeError.code;
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(linkErrorMessage(failure, type))}`,
    );
  }

  // A recovery link means the user is mid-password-reset. They now hold a valid
  // session, so send them somewhere they can actually set a new password —
  // anywhere else and they'd be silently signed in with the old one still set.
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  // A confirmed signup may have arrived through a referral link. The code sits
  // in a cookie set at signup, and claiming it needs a session — which only
  // exists as of the exchange above. The helpers are called directly rather than
  // POSTing to /api/referrals/claim: an internal fetch to self would need a
  // correct absolute origin and would forward cookies just to reach code already
  // importable here. Best-effort; a failed claim must never block confirmation.
  const referralCode = request.cookies.get("referral_code")?.value;
  if (referralCode) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { valid, referrerId } = await validateReferralCode(referralCode);
        if (valid && referrerId && referrerId !== user.id) {
          await createReferral(referrerId, user.id, referralCode);
        }
      }
    } catch (e) {
      console.error("[auth/callback] referral claim failed:", e);
    }
  }

  // `/` resolves the right destination (pending vs. home) from profile status,
  // so we don't duplicate that decision here.
  const response = NextResponse.redirect(`${origin}${next ?? "/"}`);
  // The code has been spent; don't leave it to be re-claimed on a later signup
  // from the same browser.
  if (referralCode) response.cookies.set("referral_code", "", { maxAge: 0, path: "/" });
  return response;
}
