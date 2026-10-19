import { NextResponse } from "next/server";
import { requireAdmin, type AdminSession } from "@/lib/admin/auth";
import { TIME_FIELDS, timelineErrors, type Timeline } from "@/lib/hackathons/timeline";

// Shared by the /api/admin/hackathons routes.

type Guarded =
  | { ok: true; admin: AdminSession }
  | { ok: false; response: NextResponse };

/** Both admin locks, as a ready-made error response when either is missing. */
export async function guard(req: Request): Promise<Guarded> {
  const check = await requireAdmin(req);
  if (check.ok) return { ok: true, admin: check.admin };
  return {
    ok: false,
    response: NextResponse.json({ error: "locked", reason: check.reason }, { status: check.status }),
  };
}

// Constraint names from migrations 018 and 022, in words.
const CONSTRAINT_MESSAGES: Record<string, string> = {
  hackathons_timeline_order: "The dates are out of order.",
  hackathons_published_has_dates: "A published Buildathon needs all six dates. Unpublish it first to clear one.",
  hackathons_slug_key: "That slug is already used by another Buildathon.",
  hackathons_team_size_order: "The minimum team size can't be more than the maximum.",
  hackathons_lobby_after_open: "The lobby can't close before registration opens.",
  hackathon_teams_name_unique: "Another team in this Buildathon already has that name.",
  hackathon_judges_email_unique: "That email has already been invited to judge this Buildathon.",
  hackathon_judges_hackathon_id_user_id_key: "They're already a judge of this Buildathon.",
  hackathon_awards_one_winner: "That award already has a winner. Change the winner instead.",
  hackathon_awards_citation_length: "Keep the citation to 280 characters.",
  hackathon_awards_submission_id_award_type_custom_label_key: "That project already has an award with that name.",
  hackathon_awards_custom_label_check: "Give the custom award a name (80 characters at most).",
  hackathon_awards_custom_label: "A custom award needs a name, and a named award doesn't take one.",
};

type DbError = { message: string; hint?: string | null; code?: string } | null;

/**
 * A database error as a response the admin screen can show. Our own raise
 * messages are already written for people; constraint names get translated.
 * The hint (e.g. "team_full") comes along so the screen can offer an override.
 */
export function dbErrorResponse(error: DbError, status = 400) {
  const message = error?.message ?? "Something went wrong.";
  const constraint = Object.keys(CONSTRAINT_MESSAGES).find((c) => message.includes(c));
  return NextResponse.json(
    { error: constraint ? CONSTRAINT_MESSAGES[constraint] : message, hint: error?.hint ?? null },
    { status },
  );
}

export const TEXT_FIELDS = ["title", "slug", "tagline", "theme_hidden", "rules", "countdown_headline_override", "lobby_welcome"] as const;
export const INT_FIELDS = ["max_team_size", "min_team_size"] as const;
export const BOOL_FIELDS = ["show_countdown_in_app", "show_countdown_on_landing"] as const;

/**
 * The editable Sprint fields from a request body, tidied and checked. Only the
 * fields present are returned, so a PATCH changes just those. Publishing and
 * pausing are separate actions, not fields.
 */
export function sprintFields(
  body: Record<string, unknown>,
  current: Timeline = {},
): { ok: true; values: Record<string, unknown> } | { ok: false; error: string } {
  const values: Record<string, unknown> = {};

  for (const f of TEXT_FIELDS) {
    if (!(f in body)) continue;
    const v = body[f];
    if (v !== null && typeof v !== "string") return { ok: false, error: `${f} must be text.` };
    const s = typeof v === "string" ? v.trim() : "";
    values[f] = s === "" ? null : s;
  }
  if ("title" in values && !values.title) return { ok: false, error: "Give the Buildathon a title." };
  if (values.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(values.slug))) {
    return { ok: false, error: "The slug may use lower-case letters, numbers and single dashes." };
  }

  for (const f of INT_FIELDS) {
    if (!(f in body)) continue;
    const n = Number(body[f]);
    if (!Number.isInteger(n) || n < 1 || n > 12) return { ok: false, error: "Team sizes are whole numbers from 1 to 12." };
    values[f] = n;
  }

  // Peer reviews (036): how many projects each person reviews.
  if ("reviews_per_person" in body) {
    const n = Number(body.reviews_per_person);
    if (!Number.isInteger(n) || n < 1 || n > 20) return { ok: false, error: "Reviews per person is a whole number from 1 to 20." };
    values.reviews_per_person = n;
  }

  for (const f of BOOL_FIELDS) {
    if (f in body) values[f] = Boolean(body[f]);
  }

  for (const f of TIME_FIELDS) {
    if (!(f in body)) continue;
    const v = body[f];
    if (v === null || v === "") {
      values[f] = null;
      continue;
    }
    const ms = typeof v === "string" ? Date.parse(v) : NaN;
    if (Number.isNaN(ms)) return { ok: false, error: `${f} isn't a valid time.` };
    values[f] = new Date(ms).toISOString();
  }

  const merged: Timeline = { ...current };
  for (const f of TIME_FIELDS) if (f in values) merged[f] = values[f] as string | null;
  const errors = timelineErrors(merged);
  if (errors.length) return { ok: false, error: errors.join(" ") };

  return { ok: true, values };
}
