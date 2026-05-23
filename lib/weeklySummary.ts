import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeeklySummaryData } from "@/components/WeeklySummaryCard";

type Member = { id: string; full_name: string | null; username: string | null };

function previousWeekRange() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysSinceMonday = (day + 6) % 7;
  const thisMondayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday,
  );
  const lastMonday = new Date(thisMondayUTC - 7 * 86_400_000);
  const lastSundayEnd = new Date(thisMondayUTC - 1);
  const weekKey = lastMonday.toISOString().slice(0, 10);
  return {
    startISO: lastMonday.toISOString(),
    endISO: lastSundayEnd.toISOString(),
    weekKey,
  };
}

/**
 * Returns the weekly summary data when the server clock says it's Mon/Tue,
 * otherwise returns null. The client component also re-checks local day-of-week
 * and is the final authority on whether to render.
 */
export async function buildWeeklySummary(
  supabase: SupabaseClient,
  args: {
    userId: string;
    fullName: string | null;
    cohortMemberIds: string[];
    authorMap: Map<string, Member>;
  },
): Promise<WeeklySummaryData | null> {
  const dayUTC = new Date().getUTCDay();
  // Allow Sun (0), Mon (1), Tue (2), Wed (3) to cover most TZ edge cases — the
  // client component is the final gate and will hide on non-Mon/Tue locally.
  if (dayUTC !== 0 && dayUTC !== 1 && dayUTC !== 2 && dayUTC !== 3) return null;

  const { startISO, endISO, weekKey } = previousWeekRange();
  const firstName = (args.fullName ?? "").trim().split(/\s+/)[0] || "there";

  const headCount = async (table: string, filters: (q: any) => any) => {
    const q = filters(supabase.from(table).select("id", { count: "exact", head: true }));
    const { count } = await q;
    return count ?? 0;
  };

  const [
    posts_this_week,
    replies_given,
    messages_sent,
    items_saved,
    notes_written,
    decisions_voted,
    handshakes_logged,
    checkInRes,
    mostDiscussedRes,
    helpedRes,
  ] = await Promise.all([
    headCount("posts", (q) =>
      q.eq("author_id", args.userId).gte("created_at", startISO).lte("created_at", endISO),
    ),
    headCount("post_replies", (q) =>
      q.eq("author_id", args.userId).gte("created_at", startISO).lte("created_at", endISO),
    ),
    headCount("messages", (q) =>
      q.eq("sender_id", args.userId).gte("created_at", startISO).lte("created_at", endISO),
    ),
    headCount("saved_items", (q) =>
      q.eq("user_id", args.userId).gte("created_at", startISO).lte("created_at", endISO),
    ),
    headCount("notes", (q) =>
      q.eq("user_id", args.userId).gte("updated_at", startISO).lte("updated_at", endISO),
    ),
    headCount("decision_votes", (q) =>
      q.eq("user_id", args.userId).gte("created_at", startISO).lte("created_at", endISO),
    ),
    headCount("handshakes", (q) =>
      q.eq("initiator_id", args.userId).gte("created_at", startISO).lte("created_at", endISO),
    ),
    supabase
      .from("check_ins")
      .select("id, weekly_win")
      .eq("user_id", args.userId)
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("posts")
      .select("id, content, reply_count, tag")
      .eq("author_id", args.userId)
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("reply_count", { ascending: false })
      .limit(1),
    supabase
      .from("post_replies")
      .select("post_id, posts!inner(content, author_id)")
      .eq("author_id", args.userId)
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .limit(1),
  ]);

  const check_in_row = checkInRes.data?.[0] ?? null;
  const check_in = Boolean(check_in_row);
  const mostDiscussed = mostDiscussedRes.data?.[0] ?? null;
  const helped: any = helpedRes.data?.[0] ?? null;

  // win post = a post tagged "growth" with reply_count or any post — we use
  // a heuristic: a post in this week with reply_count >= 3, treated as a "win".
  const hadWinPost = !!mostDiscussed && (mostDiscussed.reply_count ?? 0) >= 3;

  const greetingKind: WeeklySummaryData["greetingKind"] = check_in
    ? "checkin"
    : helped
    ? "helper"
    : hadWinPost
    ? "win"
    : posts_this_week === 0 && replies_given === 0
    ? "quiet"
    : "default";

  // Highlights — priority order, take first 3
  const highlights: WeeklySummaryData["highlights"] = [];

  if (check_in && check_in_row?.weekly_win) {
    highlights.push({
      label: "your win for the week",
      content: String(check_in_row.weekly_win).slice(0, 200),
    });
  }

  if (mostDiscussed && (mostDiscussed.reply_count ?? 0) > 0) {
    highlights.push({
      label: "your most discussed post",
      content: String(mostDiscussed.content ?? "").slice(0, 80),
    });
  }

  if (helped) {
    const helpedAuthorId: string | undefined = helped.posts?.author_id;
    const helpedAuthor = helpedAuthorId ? args.authorMap.get(helpedAuthorId) : null;
    const username =
      helpedAuthor?.username || helpedAuthor?.full_name?.split(/\s+/)[0] || "someone";
    const content = String(helped.posts?.content ?? "").slice(0, 60);
    if (content) {
      highlights.push({
        label: `you helped ${username} this week`,
        content,
      });
    }
  }

  if (highlights.length < 3 && args.cohortMemberIds.length > 0) {
    const { data: cohortCheckins } = await supabase
      .from("check_ins")
      .select("user_id")
      .in("user_id", args.cohortMemberIds)
      .gte("created_at", startISO)
      .lte("created_at", endISO);
    const uniqueCheckedIn = new Set((cohortCheckins ?? []).map((r) => r.user_id));
    const totalCohort = args.cohortMemberIds.length;
    const checkedIn = uniqueCheckedIn.size;
    if (checkedIn > 0) {
      highlights.push({
        label: "your cohort",
        content:
          checkedIn === totalCohort
            ? "your full cohort showed up this week."
            : `${checkedIn} of your ${totalCohort} cohort members checked in this week.`,
      });
    }
  }

  if (highlights.length < 3 && (items_saved > 0 || notes_written > 0)) {
    highlights.push({
      label: "in your vault",
      content: `you saved ${items_saved} thing${items_saved === 1 ? "" : "s"} and wrote ${notes_written} note${notes_written === 1 ? "" : "s"}.`,
    });
  }

  const finalHighlights = highlights.slice(0, 3);
  const { startISO: weekStartISO, endISO: weekEndISO } = { startISO, endISO };

  return {
    firstName,
    weekStart: weekStartISO,
    weekEnd: weekEndISO,
    weekKey,
    stats: {
      posts_this_week,
      replies_given,
      check_in,
      messages_sent,
      items_saved,
      notes_written,
      decisions_voted,
      handshakes_logged,
    },
    highlights: finalHighlights,
    greetingKind,
  };
}
