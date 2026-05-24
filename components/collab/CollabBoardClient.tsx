"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/stage";
import NewProjectModal from "./NewProjectModal";
import RespondModal from "./RespondModal";
import SkillModal from "./SkillModal";
import BookmarkButton from "@/components/BookmarkButton";
import PulseBar, { type PulseEvent } from "./PulseBar";
import YourWorkspace, { type WorkspaceProject } from "./YourWorkspace";

type Author = { id: string; full_name: string | null; stage: string | null; username: string | null };

export type ProjectRow = {
  id: string;
  author: Author | null;
  title: string;
  description: string | null;
  category: string | null;
  looking_for: string | null;
  status: string;
  post_type: string;
  created_at: string;
  skills: string[];
  interest_count: number;
  is_member: boolean;
  owner_id: string | null;
};

type SkillEntry = {
  skill: string;
  members: { id: string; full_name: string | null; stage: string | null; username: string | null }[];
};

const CATEGORY_COLOR: Record<string, string> = {
  growth: "#e8702a",
  fundraising: "#38bdf8",
  hiring: "#707070",
  product: "#707070",
  ops: "#707070",
};

type Tab = "projects" | "needs" | "skills";

export default function CollabBoardClient({
  currentUserId,
  initialTab,
  projects,
  needs,
  skillIndex,
  workspaceProjects,
  initialPulseEvents,
}: {
  currentUserId: string;
  initialTab: Tab;
  projects: ProjectRow[];
  needs: ProjectRow[];
  skillIndex: SkillEntry[];
  workspaceProjects: WorkspaceProject[];
  initialPulseEvents: PulseEvent[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [newOpen, setNewOpen] = useState(false);
  const [newType, setNewType] = useState<"project" | "need">("project");
  const [respondFor, setRespondFor] = useState<ProjectRow | null>(null);
  const [skillFor, setSkillFor] = useState<SkillEntry | null>(null);

  function openNew(type: "project" | "need") {
    setNewType(type);
    setNewOpen(true);
  }

  return (
    <>
      <PulseBar initialEvents={initialPulseEvents} />
      {/* Tabs row */}
      <div
        className="flex items-center justify-between px-6 pt-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-1">
          {(["projects", "needs", "skills"] as const).map((t) => {
            const active = tab === t;
            const label = t === "skills" ? "skills_index" : t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="font-mono lowercase text-[0.7rem] px-3 py-2"
                style={{
                  color: active ? "#e8702a" : "var(--text-muted)",
                  borderBottom: active ? "2px solid #e8702a" : "2px solid transparent",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {tab !== "skills" && (
          <button
            onClick={() => openNew(tab === "needs" ? "need" : "project")}
            className="font-mono lowercase text-[0.7rem] px-3 py-1.5 mb-2 hover:opacity-90"
            style={{ background: "#e8702a", color: "#000" }}
          >
            + post a {tab === "needs" ? "need" : "project"}
          </button>
        )}
      </div>

      <div className="px-6 py-6">
        {tab === "projects" && (
          <>
            <YourWorkspace projects={workspaceProjects} />
            <ProjectsList
              rows={projects}
              currentUserId={currentUserId}
              onRespond={setRespondFor}
            />
          </>
        )}
        {tab === "needs" && <NeedsList rows={needs} currentUserId={currentUserId} />}
        {tab === "skills" && <SkillsIndex entries={skillIndex} onOpen={setSkillFor} />}
      </div>

      {newOpen && (
        <NewProjectModal
          userId={currentUserId}
          postType={newType}
          onClose={() => setNewOpen(false)}
          onCreated={() => router.refresh()}
        />
      )}
      {respondFor && (
        <RespondModal
          project={respondFor}
          userId={currentUserId}
          onClose={() => setRespondFor(null)}
          onResponded={() => {
            setRespondFor(null);
            router.refresh();
          }}
        />
      )}
      {skillFor && <SkillModal entry={skillFor} onClose={() => setSkillFor(null)} />}
    </>
  );
}

function ProjectsList({
  rows,
  currentUserId,
  onRespond,
}: {
  rows: ProjectRow[];
  currentUserId: string;
  onRespond: (p: ProjectRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="font-mono lowercase text-xs text-text-faint">no projects yet. be the first to post â†’</p>
    );
  }
  return (
    <div className="space-y-3 max-w-3xl">
      {rows.map((p) => (
        <ProjectCard key={p.id} project={p} currentUserId={currentUserId} onRespond={onRespond} />
      ))}
    </div>
  );
}

function ProjectCard({
  project,
  currentUserId,
  onRespond,
}: {
  project: ProjectRow;
  currentUserId: string;
  onRespond: (p: ProjectRow) => void;
}) {
  const closed = project.status === "closed";
  const isMember = project.is_member || project.owner_id === currentUserId;
  const catColor = project.category ? CATEGORY_COLOR[project.category] ?? "#707070" : "#707070";

  const inner = (
    <article
      className="group relative p-4 border block"
      style={{
        background: "var(--card-elev)",
        borderColor: "var(--border-amber)",
        cursor: isMember ? "pointer" : "default",
      }}
    >
      <BookmarkButton itemType="project" itemId={project.id} />
      <header className="flex items-center gap-3 mb-3">
        <Avatar
          name={project.author?.full_name}
          stage={project.author?.stage}
          username={project.author?.username}
          size={32}
        />
        <div className="flex-1 min-w-0">
          <p className="font-mono lowercase text-xs text-text-primary truncate">
            {project.author?.full_name?.toLowerCase() ?? "â€”"}
          </p>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint">
            {timeAgo(project.created_at)} ago
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
            style={{
              border: `1px solid ${closed ? "#707070" : "#22c55e"}`,
              color: closed ? "#707070" : "#22c55e",
            }}
          >
            {closed ? "closed" : "open"}
          </span>
          {project.category && (
            <span
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
              style={{ border: `1px solid ${catColor}`, color: catColor }}
            >
              {project.category}
            </span>
          )}
        </div>
      </header>

      <h3 className="font-sans text-text-primary text-lg font-bold lowercase">{project.title}</h3>
      {project.description && (
        <p className="text-text-secondary text-[0.92rem] mt-2 whitespace-pre-wrap leading-relaxed">
          {project.description}
        </p>
      )}

      {(project.skills?.length > 0 || project.looking_for) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {project.skills.slice(0, 6).map((s) => (
            <span
              key={s}
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
              style={{
                background: "rgba(56,189,248,0.12)",
                color: "#38bdf8",
                border: "1px solid rgba(56,189,248,0.3)",
              }}
            >
              {s.toLowerCase()}
            </span>
          ))}
          {project.looking_for && (
            <span
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
              style={{
                background: "var(--card)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              looking_for: {project.looking_for}
            </span>
          )}
        </div>
      )}

      <footer className="flex items-center justify-between mt-4">
        <span className="font-mono lowercase text-[0.65rem] text-text-faint">
          â†³ {project.interest_count} interested
        </span>
        {closed ? (
          <span
            className="font-mono lowercase text-[0.65rem] px-2 py-0.5"
            style={{ border: "1px solid #707070", color: "#707070" }}
          >
            filled
          </span>
        ) : isMember ? (
          <span className="font-mono lowercase text-[0.7rem]" style={{ color: "#e8702a" }}>
            open room â†’
          </span>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRespond(project);
            }}
            className="font-mono lowercase text-[0.7rem] px-3 py-1 hover:opacity-90"
            style={{ background: "#e8702a", color: "#000" }}
          >
            respond â†’
          </button>
        )}
      </footer>
    </article>
  );

  if (isMember && !closed) {
    return (
      <Link href={`/collab/${project.id}`} className="block hover:opacity-95">
        {inner}
      </Link>
    );
  }
  return inner;
}

function NeedsList({ rows, currentUserId }: { rows: ProjectRow[]; currentUserId: string }) {
  if (rows.length === 0) {
    return (
      <p className="font-mono lowercase text-xs text-text-faint">no needs posted yet.</p>
    );
  }
  return (
    <div className="space-y-3 max-w-3xl">
      {rows.map((n) => {
        const isQuick = n.category === "quick_ask";
        const badgeColor = isQuick ? "#e8702a" : "#707070";
        return (
          <article
            key={n.id}
            className="group relative p-4 border"
            style={{ background: "var(--card-elev)", borderColor: "var(--border-amber)" }}
          >
            <BookmarkButton itemType="project" itemId={n.id} />
            <header className="flex items-center gap-3 mb-3">
              <Avatar
                name={n.author?.full_name}
                stage={n.author?.stage}
                username={n.author?.username}
                size={32}
              />
              <div className="flex-1 min-w-0">
                <p className="font-mono lowercase text-xs text-text-primary truncate">
                  {n.author?.full_name?.toLowerCase() ?? "â€”"}
                </p>
                <p className="font-mono lowercase text-[0.65rem] text-text-faint">
                  {timeAgo(n.created_at)} ago
                </p>
              </div>
              <span
                className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
                style={{ border: `1px solid ${badgeColor}`, color: badgeColor }}
              >
                {isQuick ? "quick_ask" : "need"}
              </span>
            </header>
            <h3 className="font-sans text-text-primary text-base font-bold lowercase">{n.title}</h3>
            {n.description && (
              <p className="text-text-secondary text-[0.9rem] mt-2 whitespace-pre-wrap leading-relaxed">
                {n.description}
              </p>
            )}
            {n.looking_for && (
              <div className="mt-3">
                <span
                  className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                >
                  {n.looking_for}
                </span>
              </div>
            )}
            <footer className="flex justify-end mt-4">
              {n.owner_id === currentUserId ? (
                <span className="font-mono lowercase text-[0.65rem] text-text-faint">your post</span>
              ) : (
                <Link
                  href={`/messages?to=${n.owner_id}`}
                  className="font-mono lowercase text-[0.7rem] px-3 py-1 hover:opacity-90"
                  style={{ background: "#e8702a", color: "#000" }}
                >
                  respond â†’
                </Link>
              )}
            </footer>
          </article>
        );
      })}
    </div>
  );
}

function SkillsIndex({
  entries,
  onOpen,
}: {
  entries: SkillEntry[];
  onOpen: (e: SkillEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="font-mono lowercase text-xs text-text-faint">
        no skills listed yet. founders can add skills from their profile.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {entries.map((e) => (
        <button
          key={e.skill}
          onClick={() => onOpen(e)}
          className="p-4 border text-left hover:border-amber transition-colors"
          style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono lowercase text-sm text-text-primary">{e.skill.toLowerCase()}</span>
            <span
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
              style={{ border: "1px solid #e8702a", color: "#e8702a" }}
            >
              {e.members.length}
            </span>
          </div>
          <div className="flex -space-x-2">
            {e.members.slice(0, 6).map((m) => (
              <div key={m.id} className="ring-2" style={{ /* avatar handles its own ring */ }}>
                <Avatar name={m.full_name} stage={m.stage} size={26} />
              </div>
            ))}
            {e.members.length > 6 && (
              <span
                className="ml-3 font-mono lowercase text-[0.6rem] text-text-faint self-end"
              >
                +{e.members.length - 6}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
