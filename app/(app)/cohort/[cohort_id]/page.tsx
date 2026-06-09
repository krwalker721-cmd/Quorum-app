import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CohortNav from "@/components/cohort/CohortNav";
import CohortRoomClient from "@/components/cohort/CohortRoomClient";
import {
  loadRosterFlags,
  postsMovedTheRoomBatch,
  type RosterFlags,
} from "@/lib/recognition";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
  trust_score: number | null;
  created_at: string | null;
};

function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday as week start
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default async function CohortRoomPage({
  params,
}: {
  params: { cohort_id: string };
}) {
  const cohortId = params.cohort_id;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Membership guard — accessing a cohort you don't belong to bounces you back
  // to the selection screen with an error.
  const { data: membership } = await supabase
    .from("cohort_members")
    .select("cohort_id, is_creator")
    .eq("user_id", user.id)
    .eq("cohort_id", cohortId)
    .maybeSingle();
  if (!membership) redirect("/cohort?error=not_member");
  const isCreator = (membership as any).is_creator === true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  // All of my cohorts — only used to decide whether to show the breadcrumb.
  const { data: myMemberships } = await supabase
    .from("cohort_members")
    .select("cohort_id")
    .eq("user_id", user.id);
  const myCohortCount = (myMemberships ?? []).filter(
    (m: any) => !!m.cohort_id,
  ).length;

  // This cohort.
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, name")
    .eq("id", cohortId)
    .single();
  const roomName = cohort?.name ?? "the cohort";

  // Members of THIS cohort only.
  const { data: memberRows } = await supabase
    .from("cohort_members")
    .select("user_id")
    .eq("cohort_id", cohortId);
  const memberIds = Array.from(
    new Set((memberRows ?? []).map((m: any) => m.user_id).filter(Boolean)),
  ) as string[];

  const { data: memberProfiles } = memberIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, stage, username, trust_score, created_at")
        .in("id", memberIds)
    : { data: [] as any[] };

  // Keep the viewer at the top of the roster.
  const me = (memberProfiles ?? []).find((m: any) => m.id === user.id) ?? null;
  const others = (memberProfiles ?? []).filter((m: any) => m.id !== user.id);
  const members = [me, ...others].filter(Boolean) as Member[];

  // Check-ins this week — for THIS cohort's members only.
  const weekStart = startOfWeek(new Date()).toISOString();
  const { data: checkins } = memberIds.length
    ? await supabase
        .from("check_ins")
        .select("user_id, weekly_win, decision, blocker, created_at")
        .in("user_id", memberIds)
        .gte("created_at", weekStart)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const checkinByUser = new Map<string, any>();
  for (const c of checkins ?? []) {
    if (!checkinByUser.has(c.user_id)) checkinByUser.set(c.user_id, c);
  }

  // Posts in THIS cohort room only.
  const { data: postsRaw } = await supabase
    .from("posts")
    .select(
      "id, author_id, content, room_type, tag, is_anonymous, post_type, reply_count, created_at, local_hour, cohort_id",
    )
    .eq("post_type", "cohort")
    .eq("cohort_id", cohortId)
    .is("parent_post_id", null)
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

  const flagsList = await Promise.all(
    members.map((m) => loadRosterFlags(supabase, m, cohortId)),
  );
  const rosterFlags: Record<string, RosterFlags> = {};
  members.forEach((m, i) => {
    rosterFlags[m.id] = flagsList[i];
  });

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
        cohortId={cohortId}
        members={members}
        checkinByUserJson={Object.fromEntries(checkinByUser)}
        posts={posts as any}
        roomName={roomName}
        myCohorts={[{ id: cohortId, name: roomName }]}
        showBreadcrumb={myCohortCount > 1}
        rosterFlags={rosterFlags}
        isCreator={isCreator}
      />
    </>
  );
}
