// Recognition system — server-side helpers.
//
// These are best-effort calculations. They run on the server and are designed
// to be cheap (a handful of indexed queries per profile / cohort load).
// Nothing in here is leaderboard data — it's mirror data and quiet markers.

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------- shared helpers ----------

function startOfISOWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function weekKey(d: Date): string {
  const w = startOfISOWeek(d);
  return `${w.getFullYear()}-${w.getMonth()}-${w.getDate()}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

// ---------- activity weeks (shared by depth ring + longest streak) ----------

async function fetchActivityWeeks(
  supabase: SupabaseClient,
  userId: string,
  sinceDays: number | null,
): Promise<Set<string>> {
  const sinceISO = sinceDays
    ? new Date(Date.now() - sinceDays * 86_400_000).toISOString()
    : null;

  const postsQ = supabase
    .from("posts")
    .select("created_at")
    .eq("author_id", userId);
  if (sinceISO) postsQ.gte("created_at", sinceISO);

  const checkinsQ = supabase
    .from("check_ins")
    .select("created_at")
    .eq("user_id", userId);
  if (sinceISO) checkinsQ.gte("created_at", sinceISO);

  const [{ data: posts }, { data: checkins }] = await Promise.all([
    postsQ,
    checkinsQ,
  ]);

  const weeks = new Set<string>();
  for (const p of posts ?? []) weeks.add(weekKey(new Date(p.created_at)));
  for (const c of checkins ?? []) weeks.add(weekKey(new Date(c.created_at)));
  return weeks;
}

// ---------- layer 1: visible to others ----------

/**
 * Depth ring — 4+ consecutive weeks of activity (post or check-in) in the
 * last 30 days. Avatar gets a subtle second outer ring.
 */
export async function hasDepthRing(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const weeks = await fetchActivityWeeks(supabase, userId, 35);
  // build the 4 most recent week keys
  const now = startOfISOWeek(new Date());
  for (let i = 0; i < 4; i++) {
    const w = new Date(now);
    w.setDate(w.getDate() - i * 7);
    if (!weeks.has(weekKey(w))) return false;
  }
  return true;
}

/** Handshake count — total handshakes the user has been part of. */
export async function getHandshakeCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("handshakes")
    .select("id", { count: "exact", head: true })
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`);
  return count ?? 0;
}

/** Cohort tenure (days) — show after 60+. */
export async function getCohortTenureDays(
  supabase: SupabaseClient,
  userId: string,
  cohortId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("cohort_members")
    .select("joined_at")
    .eq("user_id", userId)
    .eq("cohort_id", cohortId)
    .maybeSingle();
  if (!data?.joined_at) return null;
  const days = daysBetween(new Date(data.joined_at), new Date());
  return days >= 60 ? days : null;
}

/** Question responder — 10+ replies to question-tagged cohort posts. */
export async function isQuestionResponder(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  // Pull this user's replies and the room_type of each parent post.
  const { data } = await supabase
    .from("post_replies")
    .select("post_id, posts!inner(room_type)")
    .eq("author_id", userId)
    .eq("posts.room_type", "question")
    .limit(11);
  return (data?.length ?? 0) >= 10;
}

/** Vouches received — used both for the dot and the "who vouched" popover. */
export async function getVouchers(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  { id: string; full_name: string | null; username: string | null; stage: string | null }[]
> {
  const { data } = await supabase
    .from("vouches")
    .select("voucher:voucher_id(id, full_name, username, stage)")
    .eq("vouched_for_id", userId)
    .order("created_at", { ascending: false });
  return ((data ?? []).map((r: any) => r.voucher).filter(Boolean)) as any;
}

// ---------- layer 2: private mirror metrics ----------

export type Fingerprint = {
  question: number;
  update: number;
  decision: number;
  win: number;
  blocker: number;
  total: number;
};

/** Distribution across the 5 room_type post kinds. */
export async function getCohortFingerprint(
  supabase: SupabaseClient,
  userId: string,
): Promise<Fingerprint> {
  const { data } = await supabase
    .from("posts")
    .select("room_type")
    .eq("author_id", userId)
    .eq("post_type", "cohort")
    .not("room_type", "is", null);
  const fp: Fingerprint = {
    question: 0,
    update: 0,
    decision: 0,
    win: 0,
    blocker: 0,
    total: 0,
  };
  for (const p of data ?? []) {
    const k = p.room_type as keyof Fingerprint;
    if (k in fp && k !== "total") {
      fp[k]++;
      fp.total++;
    }
  }
  return fp;
}

/**
 * Response rate mirror — of the last 10 distinct people this user helped (by
 * replying to their post), how many came back to reply to the same thread
 * afterwards.
 */
export async function getResponseRateMirror(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ returned: number; total: number } | null> {
  const { data: myReplies } = await supabase
    .from("post_replies")
    .select("post_id, created_at, posts!inner(author_id)")
    .eq("author_id", userId)
    .neq("posts.author_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (!myReplies?.length) return null;

  const seen = new Map<
    string,
    { postId: string; helpedAt: string; originalAuthorId: string }
  >(); // key = original author
  for (const r of myReplies as any[]) {
    const oa = r.posts?.author_id as string | undefined;
    if (!oa) continue;
    if (seen.has(oa)) continue;
    seen.set(oa, {
      postId: r.post_id,
      helpedAt: r.created_at,
      originalAuthorId: oa,
    });
    if (seen.size >= 10) break;
  }

  if (seen.size === 0) return null;

  let returned = 0;
  for (const entry of seen.values()) {
    const { count } = await supabase
      .from("post_replies")
      .select("id", { count: "exact", head: true })
      .eq("post_id", entry.postId)
      .eq("author_id", entry.originalAuthorId)
      .gt("created_at", entry.helpedAt);
    if ((count ?? 0) > 0) returned++;
  }
  return { returned, total: seen.size };
}

/** "you're most present on monday evenings" — string sentence or null. */
export async function getMostActiveTime(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: posts } = await supabase
    .from("posts")
    .select("created_at, local_hour")
    .eq("author_id", userId)
    .limit(500);
  if (!posts?.length) return null;

  const bucket: Record<string, number> = {};
  const DAYS = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  for (const p of posts) {
    const d = new Date(p.created_at);
    const day = DAYS[d.getDay()];
    const hour = p.local_hour ?? d.getHours();
    let period: string;
    if (hour < 5) period = "late nights";
    else if (hour < 12) period = "mornings";
    else if (hour < 17) period = "afternoons";
    else if (hour < 21) period = "evenings";
    else period = "nights";
    const key = `${day}|${period}`;
    bucket[key] = (bucket[key] ?? 0) + 1;
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of Object.entries(bucket)) {
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  if (!best || bestN < 3) return null;
  const [day, period] = best.split("|");
  return `you're most present on ${day} ${period}.`;
}

/** Longest streak — consecutive ISO weeks with any post or check-in. */
export async function getLongestStreak(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const weeks = await fetchActivityWeeks(supabase, userId, null);
  if (weeks.size === 0) return 0;

  // Walk back from now, counting consecutive weeks present.
  const start = startOfISOWeek(new Date());
  let best = 0;
  let current = 0;
  // 2 years lookback bound
  for (let i = 0; i < 104; i++) {
    const w = new Date(start);
    w.setDate(w.getDate() - i * 7);
    if (weeks.has(weekKey(w))) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

/** Topics you return to — most common tag across last 20 posts (10+ required). */
export async function getFavoriteTag(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("posts")
    .select("tag")
    .eq("author_id", userId)
    .not("tag", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!data || data.length < 10) return null;
  const counts: Record<string, number> = {};
  for (const p of data) {
    if (!p.tag) continue;
    counts[p.tag] = (counts[p.tag] ?? 0) + 1;
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [t, n] of Object.entries(counts)) {
    if (n > bestN) {
      bestN = n;
      best = t;
    }
  }
  return best;
}

// ---------- layer 3: unpredictable awards ----------

/** 2am — post created in user's local hour 0..3. Falls back to UTC hour. */
export function is2amPost(post: {
  created_at: string;
  local_hour?: number | null;
}): boolean {
  const h =
    post.local_hour ??
    new Date(post.created_at).getUTCHours();
  return h >= 0 && h < 4;
}

/**
 * "Moved the room" — a post that received replies from 3+ distinct
 * cohort members within 48h of being posted. Returns true permanently
 * (we judge by replies in the 48h window, not "in the past 48h").
 */
export async function postMovedTheRoom(
  supabase: SupabaseClient,
  postId: string,
  postCreatedAt: string,
): Promise<boolean> {
  const windowEnd = new Date(
    new Date(postCreatedAt).getTime() + 48 * 3600 * 1000,
  ).toISOString();
  const { data } = await supabase
    .from("post_replies")
    .select("author_id")
    .eq("post_id", postId)
    .lte("created_at", windowEnd);
  const distinct = new Set((data ?? []).map((r: any) => r.author_id));
  return distinct.size >= 3;
}

/** Batch version — given a list of post ids, return the set that moved the room. */
export async function postsMovedTheRoomBatch(
  supabase: SupabaseClient,
  posts: { id: string; created_at: string }[],
): Promise<Set<string>> {
  if (posts.length === 0) return new Set();
  const ids = posts.map((p) => p.id);
  const { data } = await supabase
    .from("post_replies")
    .select("post_id, author_id, created_at")
    .in("post_id", ids);
  const byPost: Record<string, { authors: Set<string>; cutoff: number }> = {};
  for (const p of posts) {
    byPost[p.id] = {
      authors: new Set(),
      cutoff: new Date(p.created_at).getTime() + 48 * 3600 * 1000,
    };
  }
  for (const r of (data ?? []) as any[]) {
    const slot = byPost[r.post_id];
    if (!slot) continue;
    if (new Date(r.created_at).getTime() <= slot.cutoff) {
      slot.authors.add(r.author_id);
    }
  }
  const out = new Set<string>();
  for (const [pid, slot] of Object.entries(byPost)) {
    if (slot.authors.size >= 3) out.add(pid);
  }
  return out;
}

/**
 * Consistency ghost — 8+ consecutive weekly check-ins (no missed week).
 * Subtle shimmer on roster name when true.
 */
export async function hasConsistencyGhost(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("check_ins")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (!data || data.length < 8) return false;

  const weeks = new Set<string>();
  for (const c of data) weeks.add(weekKey(new Date(c.created_at)));

  const start = startOfISOWeek(new Date());
  for (let i = 0; i < 8; i++) {
    const w = new Date(start);
    w.setDate(w.getDate() - i * 7);
    if (!weeks.has(weekKey(w))) return false;
  }
  return true;
}

/**
 * Anniversary — true on the exact calendar date one year after created_at.
 * Compares month + day only (so it triggers every year).
 */
export function isAnniversary(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const c = new Date(createdAt);
  const now = new Date();
  // Must be at least 1 year old.
  if (now.getTime() - c.getTime() < 365 * 86_400_000 - 86_400_000) return false;
  return c.getMonth() === now.getMonth() && c.getDate() === now.getDate();
}

// ---------- batch loader for cohort roster ----------

/**
 * For a list of cohort members, return the lightweight recognition flags
 * needed by the roster: depth ring, question responder, anniversary,
 * consistency ghost, vouched. Tenure is per-member-per-cohort.
 */
export type RosterFlags = {
  depthRing: boolean;
  questionResponder: boolean;
  anniversary: boolean;
  consistencyGhost: boolean;
  vouched: boolean;
  tenureDays: number | null;
};

export async function loadRosterFlags(
  supabase: SupabaseClient,
  member: { id: string; created_at?: string | null },
  cohortId: string | null,
): Promise<RosterFlags> {
  const [depth, qr, ghost, vouched, tenure] = await Promise.all([
    hasDepthRing(supabase, member.id),
    isQuestionResponder(supabase, member.id),
    hasConsistencyGhost(supabase, member.id),
    supabase
      .from("vouches")
      .select("id", { count: "exact", head: true })
      .eq("vouched_for_id", member.id)
      .then((r) => (r.count ?? 0) > 0),
    cohortId ? getCohortTenureDays(supabase, member.id, cohortId) : Promise.resolve(null),
  ]);
  return {
    depthRing: depth,
    questionResponder: qr,
    anniversary: isAnniversary(member.created_at ?? null),
    consistencyGhost: ghost,
    vouched,
    tenureDays: tenure,
  };
}
