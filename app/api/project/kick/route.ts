import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Remove a member from a project. Only the project creator (projects.owner_id)
// may do this, and never themselves. Notifies the removed member.
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const projectId: string | undefined = body?.project_id;
  const targetUserId: string | undefined = body?.user_id;
  if (!projectId || !targetUserId) {
    return NextResponse.json({ error: "missing project_id or user_id" }, { status: 400 });
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "cannot remove yourself" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the caller owns this project.
  const { data: project } = await admin
    .from("projects")
    .select("id, owner_id, title, name")
    .eq("id", projectId)
    .single();
  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error: delErr } = await admin
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", targetUserId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  const projectName = project.title ?? project.name ?? "a project";
  await admin.from("notifications").insert({
    user_id: targetUserId,
    kind: "project_removed",
    message: `you have been removed from ${projectName}`,
    payload: { project_id: projectId },
  });

  return NextResponse.json({ ok: true });
}
