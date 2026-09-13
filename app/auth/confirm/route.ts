import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  claimSignupReferral,
  linkErrorMessage,
  publicOrigin,
  safeNext,
} from "@/lib/auth/email-links";

// Finishes an emailed auth link from Quorum's own templates (supabase/templates/):
//
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>
//
// verifyOtp with a token hash — Supabase's recommended pattern for server-side
// auth — needs no PKCE code verifier from the browser that requested the email,
// unlike /auth/callback's `code` exchange. So these links work when opened on a
// different device, and they keep the link on our own domain instead of
// *.supabase.co, which spam filters distrust.
//
// Runs on the server so the session lands in real cookies.
export const dynamic = "force-dynamic";

// The link types our templates send. `email` is signup confirmation in
// Supabase's current naming; `signup` is the older spelling of the same thing.
type ConfirmType = "email" | "signup" | "recovery" | "email_change";
const TYPES: ReadonlySet<string> = new Set(["email", "signup", "recovery", "email_change"]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request);
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  if (!tokenHash || !rawType || !TYPES.has(rawType)) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(linkErrorMessage(undefined, rawType))}`,
    );
  }
  const type = rawType as ConfirmType;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    console.error("[auth/confirm] verifyOtp failed:", type, error.code, error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(linkErrorMessage(error.code, type))}`,
    );
  }

  // A reset link: the member now holds a session, so send them straight to set
  // a new password — anywhere else and they'd be signed in with the old one.
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  // An email change: back to settings, where the new address shows.
  if (type === "email_change") {
    return NextResponse.redirect(`${origin}/settings`);
  }

  // A confirmed signup. Claim any referral now that a session exists, then let
  // `/` pick the destination (pending vs. home) from profile status.
  const hadReferralCookie = await claimSignupReferral(request, supabase);
  const response = NextResponse.redirect(`${origin}${next ?? "/"}`);
  if (hadReferralCookie) response.cookies.set("referral_code", "", { maxAge: 0, path: "/" });
  return response;
}
