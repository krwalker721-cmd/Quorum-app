import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CohortNav from "@/components/cohort/CohortNav";
import CohortRoomClient from "@/components/cohort/CohortRoomClient";

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
    .select("id, full_name, stage, username, trust_score")
    .eq("id", user.id)
    .single();

  const { data: membersRaw } = await supabase
    .from("profiles")
    .select("id, full_name, stage, username, trust_score")
    .eq("status", "approved")
    .neq("id", user.id)
    .order("created_at", { ascending: true });

  const members = [me, ...(membersRaw ?? [])].filter(Boolean) as {
    id: string;
    full_name: string | null;
    stage: string | null;
    username: string | null;
    trust_score: number | null;
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
      "id, author_id, content, room_type, tag, is_anonymous, post_type, reply_count, created_at"
    )
    .eq("post_type", "cohort")
    .order("created_at", { ascending: false })
    .limit(80);

  const authorMap = new Map(members.map((m) => [m.id, m]));
  const posts = (postsRaw ?? []).map((p) => ({
    ...p,
    author: authorMap.get(p.author_id ?? "") ?? null,
  }));

  // user's cohorts (for the invite button)
  const { data: memberships } = await supabase
    .from("cohort_members")
    .select("cohorts:cohort_id (id, name)")
    .eq("user_id", user.id);
  type Row = { cohorts: { id: string; name: string } | null };
  const myCohorts =
    (memberships as Row[] | null)
      ?.map((m) => m.cohorts)
      .filter((c): c is { id: string; name: string } => Boolean(c)) ?? [];

  const roomName = myCohorts[0]?.name ?? "the cohort";

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
      />
    </>
  );
}
