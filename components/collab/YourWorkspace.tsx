"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
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

const CATEGORY_COLOR: Record<string, string> = {
  growth: "#dc6414",
  fundraising: "#38bdf8",
  hiring: "#707070",
  product: "#707070",
  ops: "#707070",
};

export default function YourWorkspace({
  projects,
}: {
  projects: WorkspaceProject[];
}) {
  return (
    <section className="max-w-3xl mb-6">
      <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-3">your_workspace</p>
      {projects.length === 0 ? (
        <div
          className="p-5 text-center"
          style={{ border: "1px dashed var(--border)", background: "transparent" }}
        >
          <p className="font-mono lowercase text-xs text-text-faint">
            you're not in any projects yet â€” start one or respond to one below.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <WorkspaceCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <div
        className="flex items-center gap-3 mt-6 mb-3"
        aria-hidden
      >
        <span className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <span className="font-mono lowercase text-[0.65rem] text-text-faint">community_projects</span>
        <span className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>
    </section>
  );
}

function WorkspaceCard({ project }: { project: WorkspaceProject }) {
  const online = usePresence();
  const catColor = project.category ? CATEGORY_COLOR[project.category] ?? "#707070" : "#707070";

  return (
    <Link
      href={`/collab/${project.id}`}
      className="block hover:opacity-95"
    >
      <article
        className="p-5"
        style={{
          background: "var(--card-elev)",
          borderLeft: "3px solid #dc6414",
          borderTop: "1px solid var(--border)",
          borderRight: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-sans text-text-primary text-lg font-bold lowercase truncate">
              {project.title.toLowerCase()}
            </h3>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex -space-x-2">
                {project.members.slice(0, 6).map((m) => (
                  <span key={m.id} className="relative inline-block">
                    <Avatar
                      name={m.full_name}
                      stage={m.stage}
                      size={26}
                    />
                    {online.has(m.id) && (
                      <span
                        aria-label="online"
                        className="absolute"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#22c55e",
                          bottom: 0,
                          right: 0,
                          boxShadow: "0 0 0 1.5px var(--card-elev)",
                        }}
                      />
                    )}
                  </span>
                ))}
                {project.members.length > 6 && (
                  <span className="ml-3 font-mono lowercase text-[0.6rem] text-text-faint self-end">
                    +{project.members.length - 6}
                  </span>
                )}
              </div>
              {project.last_activity_at && (
                <span className="font-mono lowercase text-[0.65rem] text-text-faint">
                  {project.last_activity_label} {timeAgo(project.last_activity_at)} ago
                </span>
              )}
            </div>
          </div>
          {project.category && (
            <span
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5 shrink-0"
              style={{ border: `1px solid ${catColor}`, color: catColor }}
            >
              {project.category}
            </span>
          )}
        </header>

        <footer className="flex items-center justify-between mt-4 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Pill>{project.doc_count} docs</Pill>
            <Pill>Â·</Pill>
            <Pill>{project.decision_count} decisions</Pill>
            <Pill>Â·</Pill>
            <Pill>{project.message_count} messages</Pill>
          </div>
          {project.needs_vote && (
            <Link
              href={`/collab/${project.id}?tab=decisions`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
              style={{
                background: "rgba(220, 100, 20,0.12)",
                border: "1px solid #dc6414",
                color: "#dc6414",
              }}
            >
              decision needs your vote â†’
            </Link>
          )}
        </footer>
      </article>
    </Link>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono lowercase text-[0.6rem]"
      style={{ color: "var(--text-faint)" }}
    >
      {children}
    </span>
  );
}
