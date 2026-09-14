"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";

export type JoinRequest = {
  id: string;
  project_id: string;
  requester_id: string;
  reason: string;
  what_they_offer: string | null;
  status: string;
  created_at: string;
  requester: {
    id: string;
    full_name: string | null;
    stage: string | null;
    username: string | null;
  } | null;
};

export default function JoinRequestsWidget({
  projectId,
  projectTitle,
  initialRequests,
}: {
  projectId: string;
  projectTitle: string;
  initialRequests: JoinRequest[];
}) {
  const router = useRouter();
  const [requests, setRequests] = useState<JoinRequest[]>(initialRequests);
  const [busy, setBusy] = useState<string | null>(null);

  async function approve(req: JoinRequest) {
    if (!req.requester_id) return;
    setBusy(req.id);
    const supabase = createClient();
    const { error: updErr } = await supabase
      .from("join_requests")
      .update({ status: "approved" })
      .eq("id", req.id);
    if (updErr) {
      setBusy(null);
      return;
    }
    await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: req.requester_id, role: "member" });
    await supabase.from("notifications").insert({
      user_id: req.requester_id,
      type: "join_request_approved",
      kind: "join_request_approved",
      message: `your request to join "${projectTitle}" was approved`,
      source_id: projectId,
      source_type: "project",
    });
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    setBusy(null);
    router.refresh();
  }

  async function decline(req: JoinRequest) {
    if (!req.requester_id) return;
    setBusy(req.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("join_requests")
      .update({ status: "declined" })
      .eq("id", req.id);
    if (error) {
      setBusy(null);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: req.requester_id,
      type: "join_request_declined",
      kind: "join_request_declined",
      message: `your request to join "${projectTitle}" was not accepted this time`,
      source_id: projectId,
      source_type: "project",
    });
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    setBusy(null);
    router.refresh();
  }

  return (
    <Tile
      kicker="Join requests"
      right={requests.length > 0 ? `${requests.length} pending` : undefined}
    >
      {requests.length === 0 ? (
        <p className={ui.emptySub} style={{ marginTop: 0 }}>
          No pending requests.
        </p>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Avatar
                  name={r.requester?.full_name}
                  stage={r.requester?.stage}
                  username={r.requester?.username}
                  size={30}
                />
                <p
                  className="min-w-0 flex-1 truncate"
                  style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}
                >
                  {r.requester?.full_name ?? "—"}
                </p>
                <StagePill sleek stage={r.requester?.stage ?? null} />
              </div>
              <p
                className="whitespace-pre-wrap"
                style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)" }}
              >
                {r.reason}
              </p>
              {r.what_they_offer && (
                <span className={`${ui.chip} inline-block`}>Offers: {r.what_they_offer}</span>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => decline(r)}
                  disabled={busy === r.id}
                  className={ui.ghostBtn}
                  style={{ padding: "6px 12px" }}
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => approve(r)}
                  disabled={busy === r.id}
                  className={ui.primaryBtn}
                  style={{ padding: "6px 12px" }}
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Tile>
  );
}
