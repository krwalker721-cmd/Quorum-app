import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CollabBoardClient from "@/components/collab/CollabBoardClient";
import LockedCollabBoard from "@/components/collab/LockedCollabBoard";

export const dynamic = "force-dynamic";

export default async function CollabPage({
  searchParams,
}: {
  searchParams: { tab?: string };
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

  const tier = (profile?.tier ?? "free") as string;
  const tierLabel = tier.toUpperCase();

  if (tier !== "tier_2") {
    return (
      <>
        <TopBar title="collab_board" tier={tierLabel} userId={user.id} />
        <LockedCollabBoard />
      </>
    );
  }

  // Projects (post_type = project)
  const { data: projectsRaw } = await supabase
    .from("projects")
    .select(
      "id, owner_id, title, name, description, category, looking_for, status, post_type, created_at"
    )
    .eq("post_type", "project")
    .order("created_at", { ascending: false })
    .limit(80);

  // Needs (post_type = need)
  const { data: needsRaw } = await supabase
    .from("projects")
    .select(
      "id, owner_id, title, name, description, category, looking_for, status, post_type, created_at"
    )
    .eq("post_type", "need")
    .order("created_at", { ascending: false })
    .limit(80);

  const allProjects = [...(projectsRaw ?? []), ...(needsRaw ?? [])];
  const authorIds = Array.from(new Set(allProjects.map((p) => p.owner_id).filter(Boolean) as string[]));
  const projectIds = allProjects.map((p) => p.id);

  const { data: authorsRaw } =
    authorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, stage, username")
          .in("id", authorIds)
      : { data: [] as any[] };

  const authorMap = new Map((authorsRaw ?? []).map((a: any) => [a.id, a]));

  // Skills for each author (used in project pills)
  const { data: skillsRaw } =
    authorIds.length > 0
      ? await supabase.from("user_skills").select("user_id, skill").in("user_id", authorIds)
      : { data: [] as any[] };
  const skillsByAuthor = new Map<string, string[]>();
  for (const row of skillsRaw ?? []) {
    const arr = skillsByAuthor.get((row as any).user_id) ?? [];
    arr.push((row as any).skill);
    skillsByAuthor.set((row as any).user_id, arr);
  }

  // Interest counts + my membership
  const { data: interestsRaw } =
    projectIds.length > 0
      ? await supabase.from("project_interests").select("project_id").in("project_id", projectIds)
      : { data: [] as any[] };
  const interestCount = new Map<string, number>();
  for (const r of interestsRaw ?? []) {
    interestCount.set((r as any).project_id, (interestCount.get((r as any).project_id) ?? 0) + 1);
  }

  const { data: myMembershipRaw } =
    projectIds.length > 0
      ? await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", user.id)
          .in("project_id", projectIds)
      : { data: [] as any[] };
  const myMemberSet = new Set((myMembershipRaw ?? []).map((r: any) => r.project_id));

  const hydrate = (rows: any[]) =>
    rows.map((p: any) => ({
      id: p.id,
      author: authorMap.get(p.owner_id) ?? null,
      title: p.title ?? p.name ?? "",
      description: p.description,
      category: p.category,
      looking_for: p.looking_for,
      status: p.status ?? "open",
      post_type: p.post_type ?? "project",
      created_at: p.created_at,
      skills: skillsByAuthor.get(p.owner_id) ?? [],
      interest_count: interestCount.get(p.id) ?? 0,
      is_member: myMemberSet.has(p.id),
      owner_id: p.owner_id,
    }));

  const projects = hydrate(projectsRaw ?? []);
  const needs = hydrate(needsRaw ?? []);

  // Skills index — aggregate from user_skills across all approved members
  const { data: allSkillsRaw } = await supabase
    .from("user_skills")
    .select("skill, user_id, profiles!inner(id, full_name, stage, username, status)")
    .eq("profiles.status", "approved");

  type SkillMember = { id: string; full_name: string | null; stage: string | null; username: string | null };
  const skillGroups = new Map<string, SkillMember[]>();
  for (const r of (allSkillsRaw ?? []) as any[]) {
    const list = skillGroups.get(r.skill) ?? [];
    if (!list.find((m) => m.id === r.profiles.id)) list.push(r.profiles);
    skillGroups.set(r.skill, list);
  }
  const skillIndex = Array.from(skillGroups.entries())
    .map(([skill, members]) => ({ skill, members }))
    .sort((a, b) => b.members.length - a.members.length);

  return (
    <>
      <TopBar title="collab_board" tier={tierLabel} userId={user.id} />
      <CollabBoardClient
        currentUserId={user.id}
        initialTab={searchParams.tab === "needs" ? "needs" : searchParams.tab === "skills" ? "skills" : "projects"}
        projects={projects}
        needs={needs}
        skillIndex={skillIndex}
      />
    </>
  );
}
