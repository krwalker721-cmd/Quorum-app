import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import ProjectRoomClient from "@/components/collab/ProjectRoomClient";

export const dynamic = "force-dynamic";

export default async function ProjectRoomPage({
  params,
  searchParams,
}: {
  params: { id: string };
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
  if (tier !== "partner") redirect("/collab");

  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id, title, name, description, category, looking_for, status, post_type, created_at")
    .eq("id", params.id)
    .single();

  if (!project) notFound();

  // membership check
  const { data: myMember } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", project.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!myMember) redirect("/collab?error=access_denied");

  // members
  const { data: memberRows } = await supabase
    .from("project_members")
    .select("user_id, role, joined_at, profiles!inner(id, full_name, stage, username)")
    .eq("project_id", project.id);

  const members = (memberRows ?? []).map((r: any) => ({
    id: r.profiles.id,
    full_name: r.profiles.full_name,
    stage: r.profiles.stage,
    username: r.profiles.username,
    role: r.role,
    joined_at: r.joined_at,
  }));

  // thread
  const { data: messages } = await supabase
    .from("project_messages")
    .select("id, sender_id, content, is_system, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true })
    .limit(500);

  // docs
  const { data: docs } = await supabase
    .from("shared_docs")
    .select("id, added_by, title, description, external_url, doc_type, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  // decisions
  const { data: decisions } = await supabase
    .from("decisions")
    .select("id, created_by, title, description, options, status, winning_option, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  const decisionIds = (decisions ?? []).map((d) => d.id);
  const { data: votes } =
    decisionIds.length > 0
      ? await supabase
          .from("decision_votes")
          .select("id, decision_id, user_id, option_chosen")
          .in("decision_id", decisionIds)
      : { data: [] as any[] };

  const isOwner = project.owner_id === user.id;
  const { data: joinRequestsRaw } = isOwner
    ? await supabase
        .from("join_requests")
        .select(
          "id, project_id, requester_id, reason, what_they_offer, status, created_at, profiles!join_requests_requester_id_fkey(id, full_name, stage, username)"
        )
        .eq("project_id", project.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const joinRequests = ((joinRequestsRaw ?? []) as any[]).map((r) => ({
    id: r.id,
    project_id: r.project_id,
    requester_id: r.requester_id,
    reason: r.reason,
    what_they_offer: r.what_they_offer,
    status: r.status,
    created_at: r.created_at,
    requester: r.profiles
      ? {
          id: r.profiles.id,
          full_name: r.profiles.full_name,
          stage: r.profiles.stage,
          username: r.profiles.username,
        }
      : null,
  }));

  return (
    <>
      <TopBar title="project_room" tier={tier.toUpperCase()} userId={user.id} />
      <ProjectRoomClient
        currentUserId={user.id}
        project={{
          id: project.id,
          owner_id: project.owner_id,
          title: project.title ?? project.name ?? "",
          description: project.description,
          category: project.category,
          looking_for: project.looking_for,
          status: project.status ?? "open",
          created_at: project.created_at,
        }}
        members={members}
        messages={messages ?? []}
        docs={docs ?? []}
        decisions={decisions ?? []}
        votes={votes ?? []}
        joinRequests={joinRequests}
        isOwner={isOwner}
        initialTab={
          searchParams.tab === "docs" ? "docs" : searchParams.tab === "decisions" ? "decisions" : "thread"
        }
      />
    </>
  );
}
