"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";

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
    <div className="p-4 border" style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono lowercase text-[0.65rem] text-text-faint">join_requests</p>
        {requests.length > 0 && (
          <span
            className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
            style={{ border: "1px solid #f59e0b", color: "#f59e0b" }}
          >
            {requests.length}
          </span>
        )}
      </div>
      {requests.length === 0 ? (
        <p className="font-mono lowercase text-[0.7rem] text-text-faint">no pending requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className="p-3 border space-y-2"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  name={r.requester?.full_name}
                  stage={r.requester?.stage}
                  username={r.requester?.username}
                  size={28}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-mono lowercase text-[0.7rem] text-text-primary truncate">
                    {r.requester?.full_name?.toLowerCase() ?? "—"}
                  </p>
                </div>
                <StagePill stage={r.requester?.stage ?? null} />
              </div>
              <p className="text-text-secondary text-xs leading-relaxed whitespace-pre-wrap">
                {r.reason}
              </p>
              {r.what_they_offer && (
                <span
                  className="inline-block font-mono lowercase text-[0.6rem] px-2 py-0.5"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                >
                  offers: {r.what_they_offer}
                </span>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => decline(r)}
                  disabled={busy === r.id}
                  className="font-mono lowercase text-[0.65rem] px-3 py-1 hover:opacity-90 disabled:opacity-50"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                >
                  decline ✗
                </button>
                <button
                  onClick={() => approve(r)}
                  disabled={busy === r.id}
                  className="font-mono lowercase text-[0.65rem] px-3 py-1 hover:opacity-90 disabled:opacity-50"
                  style={{
                    background: "rgba(34, 197, 94, 0.12)",
                    color: "#22c55e",
                    border: "1px solid rgba(34, 197, 94, 0.45)",
                  }}
                >
                  approve ✓
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
