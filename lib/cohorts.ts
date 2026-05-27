import type { SupabaseClient } from "@supabase/supabase-js";

const COHORT_CAP = 12;

/**
 * Assign a user to an open cohort with fewer than COHORT_CAP members. If none
 * exists, create a new cohort named cohort_<timestamp> and add the user.
 *
 * Requires a service-role client to bypass RLS — meant for server actions or
 * /api routes only.
 *
 * Returns the cohort id the user ended up in.
 */
export async function assignUserToCohort(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  // Skip if user is already in a cohort.
  const { data: existing } = await admin
    .from("cohort_members")
    .select("cohort_id")
    .eq("user_id", userId)
    .limit(1);
  if (existing && existing.length > 0 && existing[0].cohort_id) {
    return existing[0].cohort_id as string;
  }

  // Find an open cohort under cap. status='open' is the canonical flag; fall
  // back to is_open for installs that haven't run 002 yet.
  const { data: openCohorts } = await admin
    .from("cohorts")
    .select("id, status, is_open")
    .or("status.eq.open,is_open.eq.true")
    .order("created_at", { ascending: true });

  let chosenId: string | null = null;
  for (const c of openCohorts ?? []) {
    const { count } = await admin
      .from("cohort_members")
      .select("user_id", { count: "exact", head: true })
      .eq("cohort_id", c.id);
    if ((count ?? 0) < COHORT_CAP) {
      chosenId = c.id as string;
      break;
    }
  }

  if (!chosenId) {
    const name = `cohort_${Date.now()}`;
    const { data: created, error } = await admin
      .from("cohorts")
      .insert({ name, creator_id: userId, is_open: true, status: "open" })
      .select("id")
      .single();
    if (error || !created) {
      throw new Error(`cohort create failed: ${error?.message ?? "unknown"}`);
    }
    chosenId = created.id as string;
    // The cohort trigger adds the creator as a member automatically, so we're done.
    return chosenId;
  }

  await admin
    .from("cohort_members")
    .upsert(
      { user_id: userId, cohort_id: chosenId },
      { onConflict: "user_id,cohort_id", ignoreDuplicates: true },
    );

  return chosenId;
}
