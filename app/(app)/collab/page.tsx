import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CollabBoardClient from "@/components/collab/CollabBoardClient";
import LockedCollabBoard from "@/components/collab/LockedCollabBoard";
import type { WorkspaceProject, WorkspaceMember } from "@/components/collab/YourWorkspace";
import type { PulseEvent } from "@/components/collab/PulseBar";

export const dynamic = "force-dynamic";

export default async function CollabPage({
  searchParams,
}: {
  searchParams: { tab?: string; error?: string };
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

  let authorsRaw: any[] = [];
  if (authorIds.length > 0) {
    const withSkills = await supabase
      .from("profiles")
      .select("id, full_name, stage, username, skills")
      .in("id", authorIds);
    if (withSkills.error) {
      const base = await supabase
        .from("profiles")
        .select("id, full_name, stage, username")
        .in("id", authorIds);
      authorsRaw = (base.data ?? []).map((a: any) => ({ ...a, skills: [] }));
    } else {
      authorsRaw = withSkills.data ?? [];
    }
  }

  const authorMap = new Map((authorsRaw ?? []).map((a: any) => [a.id, a]));

  // Skills for each author (used in project pills) — read from profiles.skills
  const skillsByAuthor = new Map<string, string[]>();
  for (const row of (authorsRaw ?? []) as any[]) {
    if (Array.isArray(row.skills)) skillsByAuthor.set(row.id, row.skills as string[]);
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

  // Pending join request counts on my owned projects (visible only to owner)
  const myOwnedIds = (projectsRaw ?? [])
    .filter((p: any) => p.owner_id === user.id)
    .map((p: any) => p.id);
  const { data: pendingJoinRaw } =
    myOwnedIds.length > 0
      ? await supabase
          .from("join_requests")
          .select("project_id")
          .eq("status", "pending")
          .in("project_id", myOwnedIds)
      : { data: [] as any[] };
  const pendingJoinCount = new Map<string, number>();
  for (const r of pendingJoinRaw ?? []) {
    pendingJoinCount.set(
      (r as any).project_id,
      (pendingJoinCount.get((r as any).project_id) ?? 0) + 1
    );
  }

  // Application counts (needs only)
  const needIds = (needsRaw ?? []).map((n: any) => n.id);
  const { data: applicationsRaw } =
    needIds.length > 0
      ? await supabase.from("need_applications").select("need_id").in("need_id", needIds)
      : { data: [] as any[] };
  const applicationCount = new Map<string, number>();
  for (const r of applicationsRaw ?? []) {
    applicationCount.set((r as any).need_id, (applicationCount.get((r as any).need_id) ?? 0) + 1);
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
      application_count: applicationCount.get(p.id) ?? 0,
      pending_requests: pendingJoinCount.get(p.id) ?? 0,
      is_member: myMemberSet.has(p.id),
      owner_id: p.owner_id,
    }));

  const projects = hydrate(projectsRaw ?? []);
  const needs = hydrate(needsRaw ?? []);

  // Skills index — aggregate from profiles.skills across all approved members.
  // Tolerate the skills column not existing yet (migration not run).
  let allProfilesWithSkills: any[] = [];
  {
    const res = await supabase
      .from("profiles")
      .select("id, full_name, stage, username, skills, what_they_are_building")
      .eq("status", "approved");
    if (res.error) {
      allProfilesWithSkills = [];
    } else {
      allProfilesWithSkills = res.data ?? [];
    }
  }

  type SkillMember = {
    id: string;
    full_name: string | null;
    stage: string | null;
    username: string | null;
    what_they_are_building?: string | null;
  };
  const skillGroups = new Map<string, SkillMember[]>();
  for (const p of (allProfilesWithSkills ?? []) as any[]) {
    const arr: string[] = Array.isArray(p.skills) ? p.skills : [];
    for (const raw of arr) {
      const skill = (raw ?? "").toString().trim().toLowerCase();
      if (!skill) continue;
      const list = skillGroups.get(skill) ?? [];
      if (!list.find((m) => m.id === p.id)) {
        list.push({
          id: p.id,
          full_name: p.full_name,
          stage: p.stage,
          username: p.username,
          what_they_are_building: p.what_they_are_building,
        });
      }
      skillGroups.set(skill, list);
    }
  }
  const skillIndex = Array.from(skillGroups.entries())
    .map(([skill, members]) => ({ skill, members }))
    .sort((a, b) => b.members.length - a.members.length);

  // ─── your_workspace ────────────────────────────────────────────────────────
  const { data: myMemberships } = await supabase
    .from("project_members")
    .select("project_id, projects!inner(id, title, name, category, status, post_type)")
    .eq("user_id", user.id);

  const myProjectIds = (myMemberships ?? [])
    .map((r: any) => r.projects?.id)
    .filter(Boolean) as string[];

  const workspaceProjects: WorkspaceProject[] = [];
  if (myProjectIds.length > 0) {
    const [allMembersRes, msgCountsRes, docCountsRes, decisionsRes, votesRes, lastMsgRes, lastDocRes, lastDecRes] =
      await Promise.all([
        supabase
          .from("project_members")
          .select("project_id, profiles!inner(id, full_name, stage, username)")
          .in("project_id", myProjectIds),
        supabase
          .from("project_messages")
          .select("project_id, is_system")
          .in("project_id", myProjectIds),
        supabase
          .from("shared_docs")
          .select("project_id")
          .in("project_id", myProjectIds),
        supabase
          .from("decisions")
          .select("id, project_id, status, created_at")
          .in("project_id", myProjectIds),
        supabase
          .from("decision_votes")
          .select("decision_id, user_id")
          .eq("user_id", user.id),
        supabase
          .from("project_messages")
          .select("project_id, created_at")
          .in("project_id", myProjectIds)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("shared_docs")
          .select("project_id, created_at")
          .in("project_id", myProjectIds)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("decisions")
          .select("project_id, created_at")
          .in("project_id", myProjectIds)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

    const membersByProject = new Map<string, WorkspaceMember[]>();
    for (const row of (allMembersRes.data ?? []) as any[]) {
      const list = membersByProject.get(row.project_id) ?? [];
      const p = row.profiles;
      if (p && !list.find((x) => x.id === p.id)) {
        list.push({ id: p.id, full_name: p.full_name, stage: p.stage, username: p.username });
      }
      membersByProject.set(row.project_id, list);
    }

    const msgCount = new Map<string, number>();
    for (const r of (msgCountsRes.data ?? []) as any[]) {
      if (r.is_system) continue;
      msgCount.set(r.project_id, (msgCount.get(r.project_id) ?? 0) + 1);
    }
    const docCount = new Map<string, number>();
    for (const r of (docCountsRes.data ?? []) as any[]) {
      docCount.set(r.project_id, (docCount.get(r.project_id) ?? 0) + 1);
    }
    const decCount = new Map<string, number>();
    const openDecisionsByProject = new Map<string, string[]>();
    for (const d of (decisionsRes.data ?? []) as any[]) {
      decCount.set(d.project_id, (decCount.get(d.project_id) ?? 0) + 1);
      if (d.status === "open") {
        const arr = openDecisionsByProject.get(d.project_id) ?? [];
        arr.push(d.id);
        openDecisionsByProject.set(d.project_id, arr);
      }
    }
    const myVotedDecisions = new Set(
      ((votesRes.data ?? []) as any[]).map((v) => v.decision_id)
    );

    const lastByProject = new Map<string, { ts: string; label: string }>();
    function consider(projId: string, ts: string | null, label: string) {
      if (!ts) return;
      const cur = lastByProject.get(projId);
      if (!cur || new Date(ts).getTime() > new Date(cur.ts).getTime()) {
        lastByProject.set(projId, { ts, label });
      }
    }
    for (const r of (lastMsgRes.data ?? []) as any[]) consider(r.project_id, r.created_at, "thread updated");
    for (const r of (lastDocRes.data ?? []) as any[]) consider(r.project_id, r.created_at, "doc added");
    for (const r of (lastDecRes.data ?? []) as any[]) consider(r.project_id, r.created_at, "decision added");

    for (const row of (myMemberships ?? []) as any[]) {
      const proj = row.projects;
      if (!proj) continue;
      const openIds = openDecisionsByProject.get(proj.id) ?? [];
      const needsVote = openIds.some((id) => !myVotedDecisions.has(id));
      const last = lastByProject.get(proj.id);
      workspaceProjects.push({
        id: proj.id,
        title: proj.title ?? proj.name ?? "untitled",
        category: proj.category,
        members: membersByProject.get(proj.id) ?? [],
        last_activity_at: last?.ts ?? null,
        last_activity_label: last?.label ?? "no activity yet",
        doc_count: docCount.get(proj.id) ?? 0,
        decision_count: decCount.get(proj.id) ?? 0,
        message_count: msgCount.get(proj.id) ?? 0,
        needs_vote: needsVote,
      });
    }

    workspaceProjects.sort((a, b) => {
      const at = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const bt = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      return bt - at;
    });
  }

  // ─── seed pulse events (last 10 minutes) ───────────────────────────────────
  const sinceIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const [recentProjsRes, recentMsgsRes, recentDocsRes, recentDecsRes, recentHsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, owner_id, post_type, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("project_messages")
      .select("id, sender_id, project_id, is_system, created_at")
      .eq("is_system", false)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("shared_docs")
      .select("id, added_by, project_id, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("decisions")
      .select("id, created_by, project_id, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("handshakes")
      .select("id, initiator_id, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const pulseUserIds = new Set<string>();
  const pulseProjectIds = new Set<string>();
  for (const r of (recentProjsRes.data ?? []) as any[]) if (r.owner_id) pulseUserIds.add(r.owner_id);
  for (const r of (recentMsgsRes.data ?? []) as any[]) {
    if (r.sender_id) pulseUserIds.add(r.sender_id);
    if (r.project_id) pulseProjectIds.add(r.project_id);
  }
  for (const r of (recentDocsRes.data ?? []) as any[]) {
    if (r.added_by) pulseUserIds.add(r.added_by);
    if (r.project_id) pulseProjectIds.add(r.project_id);
  }
  for (const r of (recentDecsRes.data ?? []) as any[]) {
    if (r.created_by) pulseUserIds.add(r.created_by);
    if (r.project_id) pulseProjectIds.add(r.project_id);
  }
  for (const r of (recentHsRes.data ?? []) as any[]) if (r.initiator_id) pulseUserIds.add(r.initiator_id);

  const pulseUserMap = new Map<string, { username: string | null; full_name: string | null }>();
  if (pulseUserIds.size > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .in("id", Array.from(pulseUserIds));
    for (const p of (data ?? []) as any[]) {
      pulseUserMap.set(p.id, { username: p.username, full_name: p.full_name });
    }
  }
  const pulseProjectMap = new Map<string, string>();
  if (pulseProjectIds.size > 0) {
    const { data } = await supabase
      .from("projects")
      .select("id, title, name")
      .in("id", Array.from(pulseProjectIds));
    for (const p of (data ?? []) as any[]) {
      pulseProjectMap.set(p.id, (p.title ?? p.name ?? "a project").toLowerCase());
    }
  }
  const uname = (id: string | null) => {
    if (!id) return "someone";
    const p = pulseUserMap.get(id);
    return ((p?.username ?? p?.full_name ?? "someone") || "someone").toLowerCase();
  };

  const initialPulseEvents: PulseEvent[] = [];
  for (const r of (recentProjsRes.data ?? []) as any[]) {
    initialPulseEvents.push({
      id: `proj-${r.id}`,
      ts: r.created_at,
      username: uname(r.owner_id),
      text: r.post_type === "need" ? "posted a new need" : "posted a new project",
    });
  }
  for (const r of (recentMsgsRes.data ?? []) as any[]) {
    initialPulseEvents.push({
      id: `msg-${r.id}`,
      ts: r.created_at,
      username: uname(r.sender_id),
      text: "replied in",
      projectName: pulseProjectMap.get(r.project_id) ?? "a project",
    });
  }
  for (const r of (recentDocsRes.data ?? []) as any[]) {
    initialPulseEvents.push({
      id: `doc-${r.id}`,
      ts: r.created_at,
      username: uname(r.added_by),
      text: "added a doc to",
      projectName: pulseProjectMap.get(r.project_id) ?? "a project",
    });
  }
  for (const r of (recentDecsRes.data ?? []) as any[]) {
    initialPulseEvents.push({
      id: `dec-${r.id}`,
      ts: r.created_at,
      username: uname(r.created_by),
      text: "posted a decision in",
      projectName: pulseProjectMap.get(r.project_id) ?? "a project",
    });
  }
  for (const r of (recentHsRes.data ?? []) as any[]) {
    initialPulseEvents.push({
      id: `hs-${r.id}`,
      ts: r.created_at,
      username: uname(r.initiator_id),
      text: "logged a handshake",
    });
  }
  initialPulseEvents.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <>
      <TopBar title="collab_board" tier={tierLabel} userId={user.id} />
      <CollabBoardClient
        currentUserId={user.id}
        initialTab={searchParams.tab === "needs" ? "needs" : searchParams.tab === "skills" ? "skills" : "projects"}
        projects={projects}
        needs={needs}
        skillIndex={skillIndex}
        workspaceProjects={workspaceProjects}
        initialPulseEvents={initialPulseEvents.slice(0, 30)}
        errorBanner={searchParams.error === "access_denied" ? "you don't have access to this project" : null}
      />
    </>
  );
}
