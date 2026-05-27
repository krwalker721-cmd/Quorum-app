import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CohortNav from "@/components/cohort/CohortNav";
import CohortRoomClient from "@/components/cohort/CohortRoomClient";
import NoCohortEmptyState from "@/components/cohort/NoCohortEmptyState";
import {
  loadRosterFlags,
  postsMovedTheRoomBatch,
  type RosterFlags,
} from "@/lib/recognition";

export const dynamic = "force-dynamic";

function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // Monday as week start
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default async function CohortPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  const { data: me } = await supabase
    .from("profiles")
    .select("id, full_name, stage, username, trust_score, created_at")
    .eq("id", user.id)
    .single();

  const { data: membersRaw } = await supabase
    .from("profiles")
    .select("id, full_name, stage, username, trust_score, created_at")
    .eq("status", "approved")
    .neq("id", user.id)
    .order("created_at", { ascending: true });

  const members = [me, ...(membersRaw ?? [])].filter(Boolean) as {
    id: string;
    full_name: string | null;
    stage: string | null;
    username: string | null;
    trust_score: number | null;
    created_at: string | null;
  }[];

  // weekly check-ins
  const weekStart = startOfWeek(new Date()).toISOString();
  const { data: checkins } = await supabase
    .from("check_ins")
    .select("user_id, weekly_win, decision, blocker, created_at")
    .gte("created_at", weekStart)
    .order("created_at", { ascending: false });

  const checkinByUser = new Map<string, any>();
  for (const c of checkins ?? []) {
    if (!checkinByUser.has(c.user_id)) checkinByUser.set(c.user_id, c);
  }

  // cohort posts
  const { data: postsRaw } = await supabase
    .from("posts")
    .select(
      "id, author_id, content, room_type, tag, is_anonymous, post_type, reply_count, created_at, local_hour"
    )
    .eq("post_type", "cohort")
    .order("created_at", { ascending: false })
    .limit(80);

  const authorMap = new Map(members.map((m) => [m.id, m]));
  const movedSet = await postsMovedTheRoomBatch(
    supabase,
    (postsRaw ?? []).map((p) => ({ id: p.id, created_at: p.created_at })),
  );
  const posts = (postsRaw ?? []).map((p) => ({
    ...p,
    author: authorMap.get(p.author_id ?? "") ?? null,
    movedTheRoom: movedSet.has(p.id),
  }));

  // user's cohorts (for the invite button)
  const { data: memberships } = await supabase
    .from("cohort_members")
    .select("cohort_id")
    .eq("user_id", user.id);

  const cohortIds =
    (memberships ?? [])
      .map((m: any) => m.cohort_id as string | null)
      .filter((id): id is string => !!id);

  let myCohorts: { id: string; name: string }[] = [];
  if (cohortIds.length > 0) {
    const { data: cohortRows } = await supabase
      .from("cohorts")
      .select("id, name")
      .in("id", cohortIds);
    myCohorts = (cohortRows ?? []) as { id: string; name: string }[];
  }

  const roomName = myCohorts[0]?.name ?? "the cohort";
  const cohortId = myCohorts[0]?.id ?? null;

  // Load roster recognition flags in parallel (depth ring, question responder,
  // tenure days, consistency ghost shimmer, vouched dot).
  const flagsList = await Promise.all(
    members.map((m) => loadRosterFlags(supabase, m, cohortId)),
  );
  const rosterFlags: Record<string, RosterFlags> = {};
  members.forEach((m, i) => {
    rosterFlags[m.id] = flagsList[i];
  });

  if (myCohorts.length === 0) {
    return (
      <>
        <TopBar
          title="cohort"
          tier={(profile?.tier ?? "free").toUpperCase()}
          userId={user.id}
        />
        <NoCohortEmptyState />
      </>
    );
  }

  return (
    <>
      <TopBar
        title="cohort"
        tier={(profile?.tier ?? "free").toUpperCase()}
        userId={user.id}
      />
      <CohortNav />
      <CohortRoomClient
        currentUserId={user.id}
        members={members}
        checkinByUserJson={Object.fromEntries(checkinByUser)}
        posts={posts as any}
        roomName={roomName}
        myCohorts={myCohorts}
        rosterFlags={rosterFlags}
      />
    </>
  );
}
