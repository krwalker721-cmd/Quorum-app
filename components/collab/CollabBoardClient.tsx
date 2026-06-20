"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { usePaywall } from "@/hooks/usePaywall";
import PaywallModal from "@/components/PaywallModal";
import { timeAgo } from "@/lib/stage";
import NewProjectModal from "./NewProjectModal";
import RespondModal from "./RespondModal";
import SkillModal from "./SkillModal";
import NeedDetailModal from "./NeedDetailModal";
import NeedApplicationsPanel from "./NeedApplicationsPanel";
import ProjectDetailModal from "./ProjectDetailModal";
import JoinRequestModal from "./JoinRequestModal";
import BookmarkButton from "@/components/BookmarkButton";
import EmptyStateUpgradeLine from "@/components/EmptyStateUpgradeLine";
import PulseBar, { type PulseEvent } from "./PulseBar";
import YourWorkspace, { type WorkspaceProject } from "./YourWorkspace";
import ProjectMenu from "./ProjectMenu";
import StagePill from "@/components/cohort/StagePill";

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
  const { paywallState, checkAndGate, closePaywall } = usePaywall();
  // Whether collab creation is locked for this user (free tier, no active trial).
  // Drives the read-only indicators and info bar; the actual block runs through
  // checkAndGate so it stays authoritative.
  const [collabLocked, setCollabLocked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setCollabLocked(d.tier === "free" && d.status !== "trialing");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
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

  async function openNew(type: "project" | "need") {
    // Paywall gate — collab creation is a Member feature (free cap is 0, so this
    // always fires the paywall for free users).
    const allowed = await checkAndGate("collab_posts");
    if (!allowed) return;
    setNewType(type);
    setNewOpen(true);
  }

  const [bannerVisible, setBannerVisible] = useState(!!errorBanner);

  return (
    <>
      <PulseBar initialEvents={initialPulseEvents} />
      {collabLocked && (
        <div
          style={{
            background: "rgba(88,166,255,0.04)",
            borderBottom: "1px solid rgba(88,166,255,0.1)",
            padding: "8px 16px",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10,
            color: "#484f58",
            letterSpacing: "0.05em",
          }}
        >
          // collab board is read-only on the free tier — upgrade to post projects, needs, and skills
        </div>
      )}
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
            title={collabLocked ? "Member feature" : undefined}
            className="font-mono lowercase text-[0.7rem] px-3 py-1.5 mb-2 hover:opacity-90"
            style={
              collabLocked
                ? {
                    background: "transparent",
                    color: "#484f58",
                    border: "1px solid #21262d",
                    borderRadius: 5,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }
                : { background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }
            }
          >
            {collabLocked && (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#484f58"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            )}
            + post a {tab === "needs" ? "need" : "project"}
            {collabLocked && <span style={{ color: "#484f58" }}>// member</span>}
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
          onCreated={() => {
            fetch("/api/usage/increment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ feature: "collab_posts" }),
            }).catch(() => {});
            router.refresh();
          }}
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
      {paywallState.isOpen && (
        <PaywallModal
          isOpen={paywallState.isOpen}
          onClose={closePaywall}
          feature={paywallState.feature!}
          currentUsage={paywallState.currentUsage}
          limit={paywallState.limit}
          hadTrial={paywallState.hadTrial}
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
      <div className="empty-panel max-w-3xl">
        <span className="empty-panel-glyph" aria-hidden>▣</span>
        <p className="empty-panel-title">no projects on the board yet.</p>
        <p className="empty-panel-sub">
          someone has to go first — post what you&apos;re building and who you need.
        </p>
        <EmptyStateUpgradeLine>
          Upgrade to Member to post projects, needs, and find co-builders.
        </EmptyStateUpgradeLine>
      </div>
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
  onOpenDetail,
  onDeleted,
}: {
  project: ProjectRow;
  currentUserId: string;
  onRespond: (p: ProjectRow) => void;
  onDeleted: (id: string) => void;
  onOpenDetail: (p: ProjectRow) => void;
}) {
  const router = useRouter();
  const closed = project.status === "closed";
  const isMember = project.is_member || project.owner_id === currentUserId;
  const isOwner = project.owner_id === currentUserId;

  // Primary card action: members open the workspace, others open the detail
  // modal (which holds the existing request-to-join flow).
  function primaryAction() {
    if (isMember) router.push(`/collab/${project.id}`);
    else onOpenDetail(project);
  }

  return (
    <div
      className="project-intro-card group"
      style={{ position: "relative" }}
      onClick={primaryAction}
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
        <div
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <ProjectMenu
            projectId={project.id}
            itemLabel="project"
            onDeleted={() => onDeleted(project.id)}
          />
        </div>
      )}

      {/* Header — like a post header */}
      <div className="project-card-header">
        <div className="project-avatar-wrap" onClick={(e) => e.stopPropagation()}>
          <Avatar
            name={project.author?.full_name}
            stage={project.author?.stage}
            username={project.author?.username}
            size={32}
          />
        </div>
        <div className="project-author-info">
          <div className="project-author-row">
            <span className="project-author-name">
              {project.author?.full_name?.toLowerCase() ?? "—"}
            </span>
            <span className="project-author-action">started a project</span>
          </div>
          <span className="project-timestamp">{timeAgo(project.created_at)} ago</span>
        </div>
        {project.category && (
          <span className={`tag tag-${project.category}`}>{project.category}</span>
        )}
      </div>

      {/* Project title — bold like a post title */}
      <div className="project-title">{project.title}</div>

      {/* Description */}
      {project.description && (
        <div className="project-description">{project.description}</div>
      )}

      {/* Skills needed pills */}
      {project.skills?.length > 0 && (
        <div className="project-skills-row">
          {project.skills.slice(0, 6).map((skill) => (
            <span key={skill} className="skill-pill">
              {skill.toLowerCase()}
            </span>
          ))}
        </div>
      )}

      {/* Interest + status row */}
      <div className="project-meta-row">
        <div className="project-members-stack">
          <span className="project-member-count">{project.interest_count} interested</span>
        </div>
        <div className="project-status">
          <div
            className="status-dot"
            style={closed ? { background: "#6e7681", boxShadow: "none" } : undefined}
          />
          <span className="status-label" style={closed ? { color: "#6e7681" } : undefined}>
            {closed ? "closed" : "open"}
          </span>
        </div>
      </div>

      {/* CTA footer — clear pull to join */}
      <div className="project-card-footer">
        <span className="project-looking-for">
          {project.looking_for
            ? `looking for ${project.looking_for}`
            : `${project.interest_count} interested`}
        </span>
        {isMember ? (
          <button
            className="project-open-btn"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/collab/${project.id}`);
            }}
          >
            open project →
          </button>
        ) : (
          <button
            className="project-join-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(project);
            }}
          >
            request to join →
          </button>
        )}
      </div>
    </div>
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
      <div className="empty-panel max-w-3xl">
        <span className="empty-panel-glyph" aria-hidden>◇</span>
        <p className="empty-panel-title">no asks posted yet.</p>
        <p className="empty-panel-sub">
          need an advisor, a contractor, or a second brain? say it here — this room exists to be asked.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3 max-w-3xl">
      {rows.map((n) => {
        const isOwner = n.owner_id === currentUserId;
        const appCount = n.application_count ?? 0;
        const helpType = n.category ?? "need";
        const firstName = n.author?.full_name?.toLowerCase().split(" ")[0] ?? "them";
        return (
          <div
            key={n.id}
            className="need-card group"
            style={{ position: "relative" }}
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

            {/* Header */}
            <div className="need-card-header">
              <div onClick={(e) => e.stopPropagation()}>
                <Avatar
                  name={n.author?.full_name}
                  stage={n.author?.stage}
                  username={n.author?.username}
                  size={30}
                />
              </div>
              <div className="need-author-info">
                <div className="need-author-row">
                  <span className="need-author-name">
                    {n.author?.full_name?.toLowerCase() ?? "—"}
                  </span>
                  <span className="need-author-action">needs help</span>
                </div>
                <div className="need-author-meta">
                  <span className="need-timestamp">{timeAgo(n.created_at)} ago</span>
                  {n.author?.stage && <span>·</span>}
                  <StagePill stage={n.author?.stage ?? null} />
                </div>
              </div>
              <span className={`tag tag-need-${helpType}`}>{helpType}</span>
            </div>

            {/* Title */}
            <div className="need-title">{n.title}</div>

            {/* Description */}
            {n.description && <div className="need-description">{n.description}</div>}

            {/* Skill tags */}
            {n.skills?.length > 0 && (
              <div className="need-tags-row">
                {n.skills.map((tag) => (
                  <span key={tag} className="skill-pill">
                    {tag.toLowerCase()}
                  </span>
                ))}
              </div>
            )}

            {/* Footer CTA */}
            <div className="need-card-footer">
              <span className="need-applicants">
                {appCount > 0 ? `${appCount} applied` : "be the first to respond"}
              </span>
              {!isOwner ? (
                <button
                  className="need-message-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail(n);
                  }}
                >
                  message {firstName} →
                </button>
              ) : (
                <button
                  className="need-view-applications-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewApplications(n);
                  }}
                >
                  view applications →
                </button>
              )}
            </div>
          </div>
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
  // Scale the per-card activity bar against the most-followed skill.
  const maxCount = Math.max(1, ...entries.map((e) => e.members.length));

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
              <div className="skills-grid">
                {items.map((e) => (
                  <SkillCard key={e.skill} entry={e} maxCount={maxCount} onOpen={onOpen} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const stageColor = (stage: string): string =>
  (({
    idea: "#38bdf8",
    "pre-seed": "#f59e0b",
    seed: "#22c55e",
    "series-a": "#a78bfa",
    series_a: "#a78bfa",
  } as Record<string, string>)[stage] ?? "#f59e0b");

// Most common founder stage for this skill — drives the accent + activity bar.
function topStageFor(members: SkillMember[]): string {
  const counts: Record<string, number> = {};
  for (const m of members) {
    if (m.stage) counts[m.stage] = (counts[m.stage] ?? 0) + 1;
  }
  let best = "pre-seed";
  let bestN = 0;
  for (const [stage, n] of Object.entries(counts)) {
    if (n > bestN) {
      best = stage;
      bestN = n;
    }
  }
  return best;
}

function SkillCard({
  entry,
  maxCount,
  onOpen,
}: {
  entry: SkillEntry;
  maxCount: number;
  onOpen: (e: SkillEntry) => void;
}) {
  const founderCount = entry.members.length;
  const topStage = topStageFor(entry.members);
  const activeCount = entry.members.filter((m) => m.what_they_are_building).length;
  const category = categoryFor(entry.skill);
  const accent = stageColor(topStage);

  return (
    <div className="skill-card" onClick={() => onOpen(entry)}>
      {/* Top accent bar — color based on most common stage for this skill */}
      <div className="skill-accent-bar" style={{ background: accent }} />

      {/* Card content */}
      <div className="skill-card-body">
        {/* Title + count */}
        <div className="skill-card-top">
          <div className="skill-name">{entry.skill.toLowerCase()}</div>
          <span className="skill-count">{founderCount}</span>
        </div>

        {/* Stage badge */}
        <div className="skill-stage-row">
          <StagePill stage={topStage} />
          <span className="skill-active-label">
            {activeCount > 0 ? `${activeCount} active` : "none active"}
          </span>
        </div>

        {/* Avatar stack */}
        <div className="skill-avatars">
          {entry.members.slice(0, 5).map((f) => (
            <span key={f.id} className="skill-av">
              <Avatar name={f.full_name} stage={f.stage} username={f.username} size={22} />
            </span>
          ))}
          {founderCount > 5 && (
            <div className="skill-av-overflow">+{founderCount - 5}</div>
          )}
        </div>

        {/* Activity bar */}
        <div className="skill-activity-bar">
          <div
            className="skill-activity-fill"
            style={{ width: `${(founderCount / maxCount) * 100}%`, background: accent }}
          />
        </div>

        <div className="skill-card-footer">{category} · click to see all founders</div>
      </div>
    </div>
  );
}
