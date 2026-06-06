import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CohortNav from "@/components/cohort/CohortNav";
import NoCohortEmptyState from "@/components/cohort/NoCohortEmptyState";
import CohortSelectionScreen, {
  type CohortSummary,
} from "@/components/cohort/CohortSelectionScreen";

export const dynamic = "force-dynamic";

export default async function CohortPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
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

  const { data: memberships } = await supabase
    .from("cohort_members")
    .select("cohort_id")
    .eq("user_id", user.id);

  const cohortIds = (memberships ?? [])
    .map((m: any) => m.cohort_id as string | null)
    .filter((id): id is string => !!id);

  // STATE 1 — not in any cohort: full-screen empty state.
  if (cohortIds.length === 0) {
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

  // STATE 2 — exactly one cohort: drop straight into that room.
  if (cohortIds.length === 1) {
    redirect(`/cohort/${cohortIds[0]}`);
  }

  // STATE 3 — multiple cohorts: build summaries for the selection screen.
  const { data: cohortRows } = await supabase
    .from("cohorts")
    .select("id, name")
    .in("id", cohortIds);

  const { data: memberRows } = await supabase
    .from("cohort_members")
    .select("cohort_id, user_id")
    .in("cohort_id", cohortIds);

  const memberIds = Array.from(
    new Set((memberRows ?? []).map((m: any) => m.user_id).filter(Boolean)),
  ) as string[];

  const { data: profiles } = memberIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, stage, username")
        .in("id", memberIds)
    : { data: [] as any[] };
  const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  // Last activity per cohort = most recent cohort post.
  const { data: lastPosts } = await supabase
    .from("posts")
    .select("cohort_id, created_at")
    .eq("post_type", "cohort")
    .in("cohort_id", cohortIds)
    .order("created_at", { ascending: false });

  const lastActivity = new Map<string, string>();
  for (const p of lastPosts ?? []) {
    if (p.cohort_id && !lastActivity.has(p.cohort_id)) {
      lastActivity.set(p.cohort_id, p.created_at);
    }
  }

  const cohorts: CohortSummary[] = (cohortRows ?? []).map((c: any) => {
    const mems = (memberRows ?? []).filter((m: any) => m.cohort_id === c.id);
    const members = mems
      .map((m: any) => profMap.get(m.user_id))
      .filter(Boolean) as CohortSummary["members"];
    return {
      id: c.id,
      name: c.name,
      memberCount: mems.length,
      members: members.slice(0, 4),
      lastActivity: lastActivity.get(c.id) ?? null,
    };
  });

  return (
    <>
      <TopBar
        title="cohort"
        tier={(profile?.tier ?? "free").toUpperCase()}
        userId={user.id}
      />
      <CohortNav />
      <CohortSelectionScreen
        cohorts={cohorts}
        currentUserId={user.id}
        error={searchParams?.error ?? null}
      />
    </>
  );
}
