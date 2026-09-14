"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import { timeAgo } from "@/lib/stage";
import { usePresence } from "@/components/PresenceProvider";

export type WorkspaceMember = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
};

export type WorkspaceProject = {
  id: string;
  title: string;
  category: string | null;
  members: WorkspaceMember[];
  last_activity_at: string | null;
  last_activity_label: string; // e.g. "thread updated", "decision added", "doc added"
  doc_count: number;
  decision_count: number;
  message_count: number;
  needs_vote: boolean;
};

const MAX_FACES = 5;

function count(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function sentence(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// The collab board's side tile: the projects you're a member of, most recently
// active first.
export default function YourWorkspace({
  projects,
}: {
  projects: WorkspaceProject[];
}) {
  const online = usePresence();
  return (
    <Tile
      kicker="Your projects"
      right={projects.length > 0 ? count(projects.length, "project") : undefined}
    >
      {projects.length === 0 ? (
        <div className={ui.empty}>
          <p className={ui.emptyTitle}>You&apos;re not in any projects yet.</p>
          <p className={ui.emptySub}>Start one, or request to join one on the board.</p>
        </div>
      ) : (
        <div className="space-y-1" style={{ margin: "0 -10px" }}>
          {projects.map((p) => (
            <WorkspaceRow key={p.id} project={p} online={online} />
          ))}
        </div>
      )}
    </Tile>
  );
}

function WorkspaceRow({ project, online }: { project: WorkspaceProject; online: Set<string> }) {
  const meta = { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 } as const;
  return (
    <div className={ui.row} style={{ padding: 10 }}>
      <Link href={`/collab/${project.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <span
            className="truncate"
            style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35 }}
          >
            {project.title}
          </span>
          {project.category && (
            <span className={`${ui.chip} shrink-0`}>{sentence(project.category)}</span>
          )}
        </div>

        <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
          <div className="flex -space-x-2">
            {project.members.slice(0, MAX_FACES).map((m) => (
              <span
                key={m.id}
                className="relative inline-block rounded-full"
                style={{ border: "1.5px solid var(--bg-surface)" }}
              >
                <Avatar name={m.full_name} stage={m.stage} size={24} />
                {online.has(m.id) && (
                  <span
                    aria-label="online"
                    className="absolute"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#22c55e",
                      bottom: 0,
                      right: 0,
                      boxShadow: "0 0 0 1.5px var(--bg-surface)",
                    }}
                  />
                )}
              </span>
            ))}
          </div>
          {project.members.length > MAX_FACES && (
            <span style={meta}>+{project.members.length - MAX_FACES}</span>
          )}
          {project.last_activity_at && (
            <span className="truncate" style={meta}>
              {sentence(project.last_activity_label)} {timeAgo(project.last_activity_at)} ago
            </span>
          )}
        </div>

        <p style={{ ...meta, marginTop: 6 }}>
          {count(project.doc_count, "doc")} · {count(project.decision_count, "decision")} ·{" "}
          {count(project.message_count, "message")}
        </p>
      </Link>

      {/* A sibling of the row's link, not nested inside it. */}
      {project.needs_vote && (
        <Link
          href={`/collab/${project.id}?tab=decisions`}
          className={`${ui.chip} ${ui.chipAmber} inline-block`}
          style={{ marginTop: 8 }}
        >
          A decision needs your vote
        </Link>
      )}
    </div>
  );
}
