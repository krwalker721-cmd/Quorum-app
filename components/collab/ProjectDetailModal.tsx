"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import ui from "@/components/ui/sleek.module.css";
import type { ProjectRow } from "./CollabBoardClient";

type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
};

function sentence(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

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
  const muted = { fontSize: 12, color: "var(--text-muted)" } as const;

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={project.title}
        className="modal-shell w-full max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell-head">
          <div className="min-w-0">
            <p className="modal-kicker">Project</p>
            <h3 className="modal-title">{project.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close">
            Esc
          </button>
        </div>

        <div className="modal-shell-body">
          {project.description && (
            <p className="whitespace-pre-wrap" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              {project.description}
            </p>
          )}

          {(project.category || project.looking_for) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {project.category && (
                <span className={`${ui.chip} ${ui.chipAmber}`}>{sentence(project.category)}</span>
              )}
              {project.looking_for && (
                <span className={ui.chip}>Looking for {project.looking_for}</span>
              )}
            </div>
          )}

          {project.skills && project.skills.length > 0 && (
            <div>
              <p style={{ ...muted, marginBottom: 8 }}>The founder&apos;s skills</p>
              <div className="flex flex-wrap gap-1.5">
                {project.skills.slice(0, 10).map((s) => (
                  <span key={s} className={ui.chip}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: 16 }}>
            <p style={{ ...muted, marginBottom: 10 }}>
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {members.slice(0, 8).map((m) => (
                <Avatar key={m.id} name={m.full_name} stage={m.stage} username={m.username} size={30} />
              ))}
              {memberCount > 8 && <span style={muted}>+{memberCount - 8}</span>}
            </div>
          </div>
        </div>

        <div className="modal-shell-foot">
          {isMember ? (
            <Link href={`/collab/${project.id}`} className="btn-primary">
              Open project →
            </Link>
          ) : existingRequest === "pending" ? (
            <span style={{ ...muted, padding: "8px 4px" }}>Request pending</span>
          ) : existingRequest === "declined" ? (
            <span style={{ ...muted, padding: "8px 4px" }}>Request declined</span>
          ) : (
            <button type="button" onClick={() => onRequestJoin(project)} className="btn-primary">
              Request to join →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
