import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  claimSignupReferral,
  linkErrorMessage,
  publicOrigin,
  safeNext,
} from "@/lib/auth/email-links";

// The landing point for emailed auth links that carry a one-time PKCE `code`:
// signup confirmation, password recovery, and magic links sent with Supabase's
// default templates. Quorum's own templates (supabase/templates/) link to
// /auth/confirm instead, which works on any device; this route stays for links
// already in flight.
//
// The code has to be exchanged for a session cookie — without this route the
// links land on a page that has no idea what to do with the code, and the user
// is stuck holding a valid token nothing will spend. Runs on the server so the
// exchange writes real HTTP-only cookies rather than leaving the session in
// localStorage.
export const dynamic = "force-dynamic";

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

  // A confirmed signup may have arrived through a referral link; claiming it
  // needs the session that only exists as of the exchange above.
  const hadReferralCookie = await claimSignupReferral(request, supabase);

  // `/` resolves the right destination (pending vs. home) from profile status,
  // so we don't duplicate that decision here.
  const response = NextResponse.redirect(`${origin}${next ?? "/"}`);
  // The code has been spent; don't leave it to be re-claimed on a later signup
  // from the same browser.
  if (hadReferralCookie) response.cookies.set("referral_code", "", { maxAge: 0, path: "/" });
  return response;
}
