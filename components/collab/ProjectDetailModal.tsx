"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import type { ProjectRow } from "./CollabBoardClient";

type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
};

export default function ProjectDetailModal({
  project,
  currentUserId,
  onClose,
  onRequestJoin,
}: {
  project: ProjectRow;
  currentUserId: string;
  onClose: () => void;
  onRequestJoin: (p: ProjectRow) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [existingRequest, setExistingRequest] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("project_members")
        .select("profiles!inner(id, full_name, stage, username)")
        .eq("project_id", project.id);
      const list = ((data ?? []) as any[]).map((r) => r.profiles).filter(Boolean);
      setMembers(list);
      setMemberCount(list.length);

      const { data: existing } = await supabase
        .from("join_requests")
        .select("status")
        .eq("project_id", project.id)
        .eq("requester_id", currentUserId)
        .maybeSingle();
      if (existing) setExistingRequest(existing.status);
    })();
  }, [project.id, currentUserId]);

  const isMember = project.is_member || project.owner_id === currentUserId;

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="modal-shell w-full max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell-head">
          <div className="min-w-0">
            <p className="modal-kicker">project</p>
            <h3 className="modal-title">{project.title}</h3>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="close">
            esc
          </button>
        </div>

        <div className="modal-shell-body">
        {project.description && (
          <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {project.category && (
            <span
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5 rounded-full"
              style={{ border: "1px solid #f59e0b", color: "#f59e0b" }}
            >
              {project.category}
            </span>
          )}
          {project.looking_for && (
            <span
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5 rounded-full"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              looking_for: {project.looking_for}
            </span>
          )}
        </div>

        {project.skills && project.skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.skills.slice(0, 10).map((s) => (
              <span
                key={s}
                className="font-mono lowercase text-[0.6rem] px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(56,189,248,0.12)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56,189,248,0.3)",
                }}
              >
                {s.toLowerCase()}
              </span>
            ))}
          </div>
        )}

        <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-2">
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {members.slice(0, 8).map((m) => (
              <Avatar
                key={m.id}
                name={m.full_name}
                stage={m.stage}
                username={m.username}
                size={28}
              />
            ))}
            {memberCount > 8 && (
              <span className="font-mono lowercase text-[0.6rem] text-text-faint">
                +{memberCount - 8}
              </span>
            )}
          </div>
        </div>
        </div>

        <div className="modal-shell-foot">
          {isMember ? (
            <Link href={`/collab/${project.id}`} className="btn-primary">
              open project →
            </Link>
          ) : existingRequest === "pending" ? (
            <span className="font-mono lowercase text-[0.7rem] text-text-faint px-4 py-2">
              request pending
            </span>
          ) : existingRequest === "declined" ? (
            <span className="font-mono lowercase text-[0.7rem] text-text-faint px-4 py-2">
              request declined
            </span>
          ) : (
            <button onClick={() => onRequestJoin(project)} className="btn-primary">
              request to join →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
