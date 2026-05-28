"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/stage";
import NewProjectModal from "./NewProjectModal";
import RespondModal from "./RespondModal";
import SkillModal from "./SkillModal";
import NeedDetailModal from "./NeedDetailModal";
import NeedApplicationsPanel from "./NeedApplicationsPanel";
import ProjectDetailModal from "./ProjectDetailModal";
import JoinRequestModal from "./JoinRequestModal";
import BookmarkButton from "@/components/BookmarkButton";
import PulseBar, { type PulseEvent } from "./PulseBar";
import YourWorkspace, { type WorkspaceProject } from "./YourWorkspace";
import ProjectMenu from "./ProjectMenu";

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
  application_count?: number;
  pending_requests?: number;
  is_member: boolean;
  owner_id: string | null;
};

type SkillMember = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
  what_they_are_building?: string | null;
};

type SkillEntry = {
  skill: string;
  members: SkillMember[];
};

const SKILL_CATEGORY_MAP: Record<string, string> = {
  // growth
  growth: "growth", seo: "growth", marketing: "growth", "go-to-market": "growth", gtm: "growth",
  ads: "growth", content: "growth", "paid-ads": "growth", "performance-marketing": "growth",
  // fundraising
  fundraising: "fundraising", pitch: "fundraising", investors: "fundraising", finance: "fundraising",
  // technical
  react: "technical", typescript: "technical", javascript: "technical", python: "technical",
  rust: "technical", go: "technical", swift: "technical", kotlin: "technical", node: "technical",
  "node.js": "technical", nextjs: "technical", "next.js": "technical", backend: "technical",
  frontend: "technical", devops: "technical", infrastructure: "technical", aws: "technical",
  database: "technical", postgres: "technical", supabase: "technical", ai: "technical", ml: "technical",
  // product
  product: "product", design: "product", ux: "product", ui: "product", research: "product",
  // hiring
  hiring: "hiring", recruiting: "hiring", "talent-acquisition": "hiring",
  // operations
  ops: "operations", operations: "operations", finance_ops: "operations", legal: "operations",
};

const CATEGORY_ORDER = [
  "growth",
  "fundraising",
  "technical",
  "product",
  "hiring",
  "operations",
  "other",
];

function categoryFor(skill: string): string {
  return SKILL_CATEGORY_MAP[skill.toLowerCase()] ?? "other";
}

const CATEGORY_COLOR: Record<string, string> = {
  growth: "#f59e0b",
  fundraising: "#38bdf8",
  hiring: "#6e7681",
  product: "#6e7681",
  ops: "#6e7681",
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
  errorBanner,
}: {
  currentUserId: string;
  initialTab: Tab;
  projects: ProjectRow[];
  needs: ProjectRow[];
  skillIndex: SkillEntry[];
  workspaceProjects: WorkspaceProject[];
  initialPulseEvents: PulseEvent[];
  errorBanner?: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [newOpen, setNewOpen] = useState(false);
  const [newType, setNewType] = useState<"project" | "need">("project");
  const [respondFor, setRespondFor] = useState<ProjectRow | null>(null);
  const [skillFor, setSkillFor] = useState<SkillEntry | null>(null);
  const [needDetail, setNeedDetail] = useState<ProjectRow | null>(null);
  const [needApplicationsFor, setNeedApplicationsFor] = useState<ProjectRow | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectRow | null>(null);
  const [joinRequestFor, setJoinRequestFor] = useState<ProjectRow | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const visibleProjects = projects.filter((p) => !removedIds.has(p.id));
  const visibleNeeds = needs.filter((p) => !removedIds.has(p.id));
  function onItemDeleted(id: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    // background refresh so server state catches up
    router.refresh();
  }

  function openNew(type: "project" | "need") {
    setNewType(type);
    setNewOpen(true);
  }

  const [bannerVisible, setBannerVisible] = useState(!!errorBanner);

  return (
    <>
      <PulseBar initialEvents={initialPulseEvents} />
      {errorBanner && bannerVisible && (
        <div
          className="mx-6 mt-3 px-4 py-2 border flex items-center justify-between"
          style={{
            background: "rgba(248, 81, 73, 0.08)",
            borderColor: "rgba(248, 81, 73, 0.45)",
          }}
        >
          <span className="font-mono lowercase text-[0.7rem]" style={{ color: "#f85149" }}>
            {errorBanner}
          </span>
          <button
            onClick={() => setBannerVisible(false)}
            className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-primary"
            aria-label="dismiss"
          >
            ✕
          </button>
        </div>
      )}
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
                  color: active ? "#f59e0b" : "var(--text-muted)",
                  borderBottom: active ? "2px solid #f59e0b" : "2px solid transparent",
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
            style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
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
              rows={visibleProjects}
              currentUserId={currentUserId}
              onRespond={setRespondFor}
              onDeleted={onItemDeleted}
              onOpenDetail={setProjectDetail}
            />
          </>
        )}
        {tab === "needs" && (
          <NeedsList
            rows={visibleNeeds}
            currentUserId={currentUserId}
            onDeleted={onItemDeleted}
            onOpenDetail={setNeedDetail}
            onViewApplications={setNeedApplicationsFor}
          />
        )}
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
      {needDetail && (
        <NeedDetailModal
          need={needDetail}
          currentUserId={currentUserId}
          onClose={() => setNeedDetail(null)}
        />
      )}
      {needApplicationsFor && (
        <NeedApplicationsPanel
          needId={needApplicationsFor.id}
          needTitle={needApplicationsFor.title}
          onClose={() => setNeedApplicationsFor(null)}
        />
      )}
      {projectDetail && (
        <ProjectDetailModal
          project={projectDetail}
          currentUserId={currentUserId}
          onClose={() => setProjectDetail(null)}
          onRequestJoin={(p) => {
            setProjectDetail(null);
            setJoinRequestFor(p);
          }}
        />
      )}
      {joinRequestFor && (
        <JoinRequestModal
          project={joinRequestFor}
          currentUserId={currentUserId}
          onClose={() => setJoinRequestFor(null)}
          onSent={() => setJoinRequestFor(null)}
        />
      )}
    </>
  );
}

function ProjectsList({
  rows,
  currentUserId,
  onRespond,
  onDeleted,
  onOpenDetail,
}: {
  rows: ProjectRow[];
  currentUserId: string;
  onRespond: (p: ProjectRow) => void;
  onDeleted: (id: string) => void;
  onOpenDetail: (p: ProjectRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="font-mono lowercase text-xs text-text-faint">no projects yet. be the first to post </p>
    );
  }
  return (
    <div className="space-y-3 max-w-3xl">
      {rows.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          currentUserId={currentUserId}
          onRespond={onRespond}
          onDeleted={onDeleted}
          onOpenDetail={onOpenDetail}
        />
      ))}
    </div>
  );
}

function ProjectCard({
  project,
  currentUserId,
  onRespond,
  onDeleted,
  onOpenDetail,
}: {
  project: ProjectRow;
  currentUserId: string;
  onRespond: (p: ProjectRow) => void;
  onDeleted: (id: string) => void;
  onOpenDetail: (p: ProjectRow) => void;
}) {
  const closed = project.status === "closed";
  const isMember = project.is_member || project.owner_id === currentUserId;
  const isOwner = project.owner_id === currentUserId;
  const catColor = project.category ? CATEGORY_COLOR[project.category] ?? "#6e7681" : "#6e7681";

  const inner = (
    <article
      className="group relative p-4 border block"
      style={{
        background: "var(--card-elev)",
        borderColor: "var(--border-amber)",
        cursor: "pointer",
      }}
    >
      <BookmarkButton itemType="project" itemId={project.id} />
      {isOwner && (project.pending_requests ?? 0) > 0 && (
        <span
          className="absolute top-2 left-2 z-10 font-mono lowercase text-[0.55rem] px-2 py-0.5"
          style={{
            background: "rgba(245, 158, 11, 0.18)",
            color: "#f59e0b",
            border: "1px solid rgba(245, 158, 11, 0.55)",
            borderRadius: 999,
          }}
          title={`${project.pending_requests} pending request${project.pending_requests === 1 ? "" : "s"}`}
        >
          {project.pending_requests} pending
        </span>
      )}
      {isOwner && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <ProjectMenu
            projectId={project.id}
            itemLabel="project"
            onDeleted={() => onDeleted(project.id)}
          />
        </div>
      )}
      <header className="flex items-center gap-3 mb-3">
        <Avatar
          name={project.author?.full_name}
          stage={project.author?.stage}
          username={project.author?.username}
          size={32}
        />
        <div className="flex-1 min-w-0">
          <p className="font-mono lowercase text-xs text-text-primary truncate">
            {project.author?.full_name?.toLowerCase() ?? "—"}
          </p>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint">
            {timeAgo(project.created_at)} ago
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
            style={{
              border: `1px solid ${closed ? "#6e7681" : "#22c55e"}`,
              color: closed ? "#6e7681" : "#22c55e",
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
           {project.interest_count} interested
        </span>
        {closed ? (
          <span
            className="font-mono lowercase text-[0.65rem] px-2 py-0.5"
            style={{ border: "1px solid #6e7681", color: "#6e7681" }}
          >
            filled
          </span>
        ) : isMember ? (
          <span className="font-mono lowercase text-[0.7rem]" style={{ color: "#f59e0b" }}>
            open project →
          </span>
        ) : (
          <span className="font-mono lowercase text-[0.7rem]" style={{ color: "#f59e0b" }}>
            view details →
          </span>
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
  return (
    <button
      type="button"
      onClick={() => onOpenDetail(project)}
      className="block w-full text-left hover:opacity-95"
    >
      {inner}
    </button>
  );
}

function NeedsList({
  rows,
  currentUserId,
  onDeleted,
  onOpenDetail,
  onViewApplications,
}: {
  rows: ProjectRow[];
  currentUserId: string;
  onDeleted: (id: string) => void;
  onOpenDetail: (n: ProjectRow) => void;
  onViewApplications: (n: ProjectRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="font-mono lowercase text-xs text-text-faint">no needs posted yet.</p>
    );
  }
  return (
    <div className="space-y-3 max-w-3xl">
      {rows.map((n) => {
        const isQuick = n.category === "quick_ask";
        const badgeColor = isQuick ? "#f59e0b" : "#6e7681";
        const isOwner = n.owner_id === currentUserId;
        const appCount = n.application_count ?? 0;
        return (
          <article
            key={n.id}
            className="group relative p-4 border"
            style={{ background: "var(--card-elev)", borderColor: "var(--border-amber)", cursor: "pointer" }}
            onClick={() => onOpenDetail(n)}
          >
            <BookmarkButton itemType="project" itemId={n.id} />
            {isOwner && (
              <div
                className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <ProjectMenu
                  projectId={n.id}
                  itemLabel="need"
                  onDeleted={() => onDeleted(n.id)}
                />
              </div>
            )}
            <header className="flex items-center gap-3 mb-3">
              <Avatar
                name={n.author?.full_name}
                stage={n.author?.stage}
                username={n.author?.username}
                size={32}
              />
              <div className="flex-1 min-w-0">
                <p className="font-mono lowercase text-xs text-text-primary truncate">
                  {n.author?.full_name?.toLowerCase() ?? "—"}
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
              <p className="text-text-secondary text-[0.9rem] mt-2 whitespace-pre-wrap leading-relaxed line-clamp-3">
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
            <footer className="flex items-center justify-between mt-4">
              <span className="font-mono lowercase text-[0.65rem] text-text-faint">
                {appCount} application{appCount === 1 ? "" : "s"}
              </span>
              {isOwner ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewApplications(n);
                  }}
                  className="font-mono lowercase text-[0.7rem] px-3 py-1 hover:opacity-90"
                  style={{
                    background: "rgba(245, 158, 11, 0.18)",
                    color: "#f59e0b",
                    border: "1px solid rgba(245, 158, 11, 0.55)",
                    borderRadius: 5,
                  }}
                >
                  view applications →
                </button>
              ) : (
                <span className="font-mono lowercase text-[0.7rem]" style={{ color: "#f59e0b" }}>
                  apply →
                </span>
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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"count" | "alpha">("count");

  if (entries.length === 0) {
    return (
      <p className="font-mono lowercase text-xs text-text-faint">
        no skills listed yet. add yours from your profile.
      </p>
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? entries.filter((e) => e.skill.toLowerCase().includes(q)) : entries;

  const groups = new Map<string, SkillEntry[]>();
  for (const e of filtered) {
    const cat = categoryFor(e.skill);
    const arr = groups.get(cat) ?? [];
    arr.push(e);
    groups.set(cat, arr);
  }
  // Sort within each group
  for (const [k, arr] of groups) {
    arr.sort((a, b) =>
      sort === "alpha"
        ? a.skill.localeCompare(b.skill)
        : b.members.length - a.members.length || a.skill.localeCompare(b.skill)
    );
    groups.set(k, arr);
  }

  const orderedCats = CATEGORY_ORDER.filter((c) => (groups.get(c) ?? []).length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search skills..."
          className="flex-1 min-w-[200px] px-3 py-2 font-mono lowercase text-[0.7rem] text-text-primary"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        />
        <div className="flex items-center gap-1 border" style={{ borderColor: "var(--border)" }}>
          {(["count", "alpha"] as const).map((k) => {
            const active = sort === k;
            return (
              <button
                key={k}
                onClick={() => setSort(k)}
                className="font-mono lowercase text-[0.65rem] px-3 py-2"
                style={{
                  color: active ? "#f59e0b" : "var(--text-muted)",
                  background: active ? "rgba(245, 158, 11, 0.08)" : "transparent",
                }}
              >
                {k === "count" ? "most founders" : "alphabetical"}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="font-mono lowercase text-xs text-text-faint">
          no skills match &quot;{q}&quot;.
        </p>
      ) : (
        orderedCats.map((cat) => {
          const items = groups.get(cat) ?? [];
          return (
            <div key={cat}>
              <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-2">
                # {cat}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((e) => (
                  <SkillCard key={e.skill} entry={e} onOpen={onOpen} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function SkillCard({
  entry,
  onOpen,
}: {
  entry: SkillEntry;
  onOpen: (e: SkillEntry) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={() => onOpen(entry)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="p-4 border text-left transition-all"
      style={{
        background: "var(--card-elev)",
        borderColor: hover ? "rgba(245, 158, 11, 0.65)" : "var(--border)",
        transform: hover ? "scale(1.015)" : "scale(1)",
        boxShadow: hover ? "0 0 18px rgba(245, 158, 11, 0.15)" : "none",
      }}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <span
          className="font-mono lowercase text-[0.7rem] px-2.5 py-1 truncate"
          style={{
            border: "1px solid rgba(245, 158, 11, 0.45)",
            color: "#f59e0b",
            background: "rgba(245, 158, 11, 0.08)",
          }}
        >
          {entry.skill.toLowerCase()}
        </span>
        <span className="font-mono lowercase text-[0.65rem] text-text-faint shrink-0">
          {entry.members.length} founder{entry.members.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex items-center -space-x-2">
        {entry.members.slice(0, 6).map((m) => (
          <Avatar
            key={m.id}
            name={m.full_name}
            stage={m.stage}
            username={m.username}
            size={26}
          />
        ))}
        {entry.members.length > 6 && (
          <span className="pl-4 font-mono lowercase text-[0.6rem] text-text-faint self-end">
            +{entry.members.length - 6}
          </span>
        )}
      </div>
    </button>
  );
}
