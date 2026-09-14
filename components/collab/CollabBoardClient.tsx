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
import { TabPill, TabPillRow } from "@/components/ui/TabPill";
import ui from "@/components/ui/sleek.module.css";
import { onOpenComposer } from "@/lib/tour-bus";

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

// "quick_ask" → "Quick ask", "co-founder" → "Co-founder".
function sentence(s: string): string {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type Tab = "projects" | "needs" | "skills";

const TAB_LABEL: Record<Tab, string> = {
  projects: "Projects",
  needs: "Needs",
  skills: "Skills",
};

const TAB_SUB: Record<Tab, string> = {
  projects: "Projects looking for builders",
  needs: "Founders asking for help",
  skills: "Who can help with what",
};

const NAME: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: "var(--text-primary)" };
const META: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)" };
const CARD_TITLE: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  lineHeight: 1.35,
  color: "var(--text-primary)",
  marginTop: 12,
};
const CARD_BODY: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "var(--text-secondary)",
  marginTop: 6,
};

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
  const { paywallState, checkAndGate, openPaywall, closePaywall } = usePaywall();
  // Whether collab creation is locked for this user. Drives the read-only
  // indicators and info bar; the actual block runs through checkAndGate so it
  // stays authoritative. Reads the entitlement bit rather than comparing tier
  // strings — a card-free trial reports tier "free" and must not read as locked.
  const [collabLocked, setCollabLocked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setCollabLocked(!d.hasFullAccess);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [tab, setTab] = useState<Tab>(initialTab);
  // Keep the tab in step with `?tab=` when the URL changes under us. The guided
  // tour walks the board by pushing /collab?tab=…, and a client-side nav to the
  // same route would otherwise keep this state at its original value.
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  // Sentence starter handed in by the guided tour; seeds NewProjectModal.
  const [tourDraft, setTourDraft] = useState("");
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
    // The board itself is open to every tier; only *creating* is capped. This
    // enforces the collab_posts usage cap (free tier's cap is 0, so the paywall
    // fires for free users on create — viewing is never gated).
    const allowed = await checkAndGate("collab_posts");
    if (!allowed) return;
    setNewType(type);
    setNewOpen(true);
  }

  // The guided tour can open the project composer with a starter already typed.
  useEffect(() => {
    return onOpenComposer("collab-project", (text) => {
      setTourDraft(text);
      setTab("projects");
      setNewType("project");
      setNewOpen(true);
    });
  }, []);

  const [bannerVisible, setBannerVisible] = useState(!!errorBanner);

  return (
    <>
      <div
        className={`page-pad ${ui.pageGlow}`}
        style={{ padding: "28px 32px 40px", maxWidth: 1280, margin: "0 auto" }}
      >
        {errorBanner && bannerVisible && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={{
              marginBottom: 20,
              borderRadius: 10,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.06)",
            }}
          >
            <p style={{ fontSize: 13, color: "#f87171" }}>{errorBanner}</p>
            <button
              type="button"
              onClick={() => setBannerVisible(false)}
              className={ui.textBtn}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap" style={{ marginBottom: 20 }}>
          <div className="min-w-0">
            <h1
              className={ui.titleGradient}
              style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
            >
              Collab board
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>{TAB_SUB[tab]}</p>
            <PulseBar initialEvents={initialPulseEvents} />
          </div>
          {tab !== "skills" && (
            <span data-tour-id="collab-new" style={{ display: "inline-flex" }}>
              <button
                type="button"
                onClick={() => openNew(tab === "needs" ? "need" : "project")}
                className={`${ui.primaryBtn} inline-flex items-center gap-2`}
                style={collabLocked ? { opacity: 0.6 } : undefined}
              >
                {collabLocked && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                )}
                New {tab === "needs" ? "need" : "project"}
              </button>
            </span>
          )}
        </div>

        {collabLocked && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            The board is read-only without a membership. Reactivate to post projects, needs, and
            skills.
          </p>
        )}

        <div data-tour-id="collab-tabs" style={{ marginBottom: 18 }}>
          <TabPillRow>
            {(["projects", "needs", "skills"] as const).map((t) => (
              <TabPill sleek key={t} active={tab === t} onClick={() => setTab(t)}>
                {TAB_LABEL[t]}
              </TabPill>
            ))}
          </TabPillRow>
        </div>

        <div data-tour-id="collab-list">
          {tab === "skills" ? (
            <SkillsIndex entries={skillIndex} onOpen={setSkillFor} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4 items-start">
              <div className="min-w-0">
                {tab === "projects" ? (
                  <ProjectsList
                    rows={visibleProjects}
                    currentUserId={currentUserId}
                    onRespond={setRespondFor}
                    onDeleted={onItemDeleted}
                    onOpenDetail={setProjectDetail}
                  />
                ) : (
                  <NeedsList
                    rows={visibleNeeds}
                    currentUserId={currentUserId}
                    onDeleted={onItemDeleted}
                    onOpenDetail={setNeedDetail}
                    onViewApplications={setNeedApplicationsFor}
                  />
                )}
              </div>
              {/* Your own projects come first on a phone, where the list would
                  otherwise bury them. */}
              <aside className="order-first lg:order-none min-w-0">
                <YourWorkspace projects={workspaceProjects} />
              </aside>
            </div>
          )}
        </div>
      </div>

      {newOpen && (
        <NewProjectModal
          userId={currentUserId}
          postType={newType}
          initialTitle={tourDraft}
          onClose={() => {
            setNewOpen(false);
            setTourDraft("");
          }}
          onCreated={() => {
            // Usage is incremented server-side by /api/collab.
            router.refresh();
          }}
          onUpgradeRequired={() => {
            setNewOpen(false);
            openPaywall("collab_posts");
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
          hadTrial={paywallState.hadTrial}
        />
      )}
    </>
  );
}

function EmptyTile({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className={ui.tile} style={{ padding: "20px 22px" }}>
      <div className={ui.empty}>
        <p className={ui.emptyTitle}>{title}</p>
        <p className={ui.emptySub}>{sub}</p>
        {children}
      </div>
    </div>
  );
}

// The owner's "…" menu, top right. Hover-revealed on desktop; always shown on
// touch screens, which have no hover.
function OwnerMenu({
  id,
  label,
  onDeleted,
}: {
  id: string;
  label: "project" | "need";
  onDeleted: (id: string) => void;
}) {
  return (
    <div
      className="absolute top-3 right-3 z-10 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      <ProjectMenu projectId={id} itemLabel={label} onDeleted={() => onDeleted(id)} />
    </div>
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
      <EmptyTile
        title="No projects on the board yet."
        sub="Someone has to go first. Post what you're building and who you need."
      >
        <EmptyStateUpgradeLine>
          Upgrade to Member to post projects, needs, and find co-builders.
        </EmptyStateUpgradeLine>
      </EmptyTile>
    );
  }
  return (
    <div className="space-y-3">
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
  const pending = isOwner ? project.pending_requests ?? 0 : 0;

  // Primary card action: members open the workspace, others open the detail
  // modal (which holds the existing request-to-join flow).
  function primaryAction() {
    if (isMember) router.push(`/collab/${project.id}`);
    else onOpenDetail(project);
  }

  return (
    <article
      className={`${ui.tile} group cursor-pointer`}
      style={{ padding: "18px 20px" }}
      onClick={primaryAction}
    >
      {isOwner && <OwnerMenu id={project.id} label="project" onDeleted={onDeleted} />}

      {/* Author line */}
      <div className="flex items-center gap-3" style={isOwner ? { paddingRight: 28 } : undefined}>
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Avatar
            name={project.author?.full_name}
            stage={project.author?.stage}
            username={project.author?.username}
            size={34}
          />
        </div>
        <div className="min-w-0 flex items-center gap-x-1.5 gap-y-1 flex-wrap">
          <span style={NAME}>{project.author?.full_name ?? "—"}</span>
          <span style={META}>started a project · {timeAgo(project.created_at)} ago</span>
          {project.category && <span className={ui.chip}>{sentence(project.category)}</span>}
          {pending > 0 && (
            <span className={`${ui.chip} ${ui.chipAmber}`}>
              {pending} pending {pending === 1 ? "request" : "requests"}
            </span>
          )}
        </div>
      </div>

      <h3 style={CARD_TITLE}>{project.title}</h3>
      {project.description && (
        <p className="whitespace-pre-wrap" style={CARD_BODY}>
          {project.description}
        </p>
      )}

      {project.skills?.length > 0 && (
        <div className="flex flex-wrap gap-1.5" style={{ marginTop: 12 }}>
          {project.skills.slice(0, 6).map((skill) => (
            <span key={skill} className={ui.chip}>
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className={`${ui.cardFoot} flex items-center justify-between gap-3 flex-wrap`}>
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap min-w-0" style={META}>
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: closed ? "var(--text-muted)" : "var(--green)" }}
          >
            <span className={closed ? ui.quietDot : undefined} aria-hidden style={closed ? undefined : { width: 7, height: 7, borderRadius: 999, background: "#22c55e", flexShrink: 0 }} />
            {closed ? "Closed" : "Open"}
          </span>
          <span>{project.interest_count} interested</span>
          {project.looking_for && <span>Looking for {project.looking_for}</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <BookmarkButton itemType="project" itemId={project.id} variant="inline" />
          {isMember ? (
            <button
              type="button"
              className={ui.softBtn}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/collab/${project.id}`);
              }}
            >
              Open project →
            </button>
          ) : (
            <button
              type="button"
              className={ui.ghostBtn}
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail(project);
              }}
            >
              Request to join →
            </button>
          )}
        </div>
      </div>
    </article>
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
      <EmptyTile
        title="No asks posted yet."
        sub="Need an advisor, a contractor, or a second brain? Say it here. This room exists to be asked."
      />
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((n) => {
        const isOwner = n.owner_id === currentUserId;
        const appCount = n.application_count ?? 0;
        const helpType = n.category ?? "need";
        const firstName = n.author?.full_name?.split(" ")[0] || "them";
        return (
          <article
            key={n.id}
            className={`${ui.tile} group cursor-pointer`}
            style={{ padding: "18px 20px" }}
            onClick={() => onOpenDetail(n)}
          >
            {isOwner && <OwnerMenu id={n.id} label="need" onDeleted={onDeleted} />}

            {/* Author line */}
            <div className="flex items-center gap-3" style={isOwner ? { paddingRight: 28 } : undefined}>
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <Avatar
                  name={n.author?.full_name}
                  stage={n.author?.stage}
                  username={n.author?.username}
                  size={34}
                />
              </div>
              <div className="min-w-0 flex items-center gap-x-1.5 gap-y-1 flex-wrap">
                <span style={NAME}>{n.author?.full_name ?? "—"}</span>
                <span style={META}>needs help · {timeAgo(n.created_at)} ago</span>
                <StagePill sleek stage={n.author?.stage ?? null} />
                <span className={ui.chip}>{sentence(helpType)}</span>
              </div>
            </div>

            <h3 style={CARD_TITLE}>{n.title}</h3>
            {n.description && (
              <p className="whitespace-pre-wrap" style={CARD_BODY}>
                {n.description}
              </p>
            )}

            {n.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5" style={{ marginTop: 12 }}>
                {n.skills.map((tag) => (
                  <span key={tag} className={ui.chip}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className={`${ui.cardFoot} flex items-center justify-between gap-3 flex-wrap`}>
              <span style={META}>
                {appCount > 0 ? `${appCount} applied` : "Be the first to respond"}
              </span>
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <BookmarkButton itemType="project" itemId={n.id} variant="inline" />
                {isOwner ? (
                  <button
                    type="button"
                    className={ui.softBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewApplications(n);
                    }}
                  >
                    View applications →
                  </button>
                ) : (
                  <button
                    type="button"
                    className={ui.softBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetail(n);
                    }}
                  >
                    Message {firstName} →
                  </button>
                )}
              </div>
            </div>
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
      <EmptyTile
        title="No skills listed yet."
        sub="Add yours from your profile and you'll show up here."
      />
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? entries.filter((e) => e.skill.toLowerCase().includes(q)) : entries;
  // Scale the per-card meter against the most-listed skill.
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
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills"
          aria-label="Search skills"
          className={`${ui.search} flex-1 min-w-0 w-full sm:w-auto`}
          style={{ maxWidth: 420 }}
        />
        <TabPillRow>
          <TabPill sleek active={sort === "count"} onClick={() => setSort("count")}>
            Most founders
          </TabPill>
          <TabPill sleek active={sort === "alpha"} onClick={() => setSort("alpha")}>
            A–Z
          </TabPill>
        </TabPillRow>
      </div>

      {filtered.length === 0 ? (
        <p className={ui.emptyTitle}>No skills match &ldquo;{query.trim()}&rdquo;.</p>
      ) : (
        orderedCats.map((cat) => (
          <section key={cat}>
            <p className={ui.label} style={{ marginBottom: 10 }}>
              {sentence(cat)}
            </p>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
            >
              {(groups.get(cat) ?? []).map((e) => (
                <SkillCard key={e.skill} entry={e} maxCount={maxCount} onOpen={onOpen} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

const stageColor = (stage: string | null): string =>
  (stage
    ? ({
        idea: "#38bdf8",
        "pre-seed": "#f59e0b",
        seed: "#22c55e",
        "series-a": "#a78bfa",
        series_a: "#a78bfa",
      } as Record<string, string>)[stage]
    : undefined) ?? "#f59e0b";

// Most common founder stage for this skill (null when nobody lists a stage).
function topStageFor(members: SkillMember[]): string | null {
  const counts: Record<string, number> = {};
  for (const m of members) {
    if (m.stage) counts[m.stage] = (counts[m.stage] ?? 0) + 1;
  }
  let best: string | null = null;
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

  return (
    <button
      type="button"
      className={`${ui.tile} text-left w-full`}
      style={{ padding: "16px 18px" }}
      onClick={() => onOpen(entry)}
    >
      <div className="flex items-start justify-between gap-2">
        <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, color: "var(--text-primary)" }}>
          {entry.skill}
        </span>
        <span style={{ ...META, fontSize: 13, whiteSpace: "nowrap" }}>
          {founderCount} {founderCount === 1 ? "founder" : "founders"}
        </span>
      </div>

      <div className="flex items-center gap-2" style={{ marginTop: 12, minHeight: 26 }}>
        <div className="flex -space-x-2">
          {entry.members.slice(0, 5).map((f) => (
            <span key={f.id} className="rounded-full" style={{ border: "1.5px solid var(--bg-surface)" }}>
              <Avatar name={f.full_name} stage={f.stage} size={24} />
            </span>
          ))}
        </div>
        {founderCount > 5 && <span style={META}>+{founderCount - 5}</span>}
        <span className="ml-auto">
          <StagePill sleek stage={topStage} />
        </span>
      </div>

      <div className={ui.barTrack} style={{ marginTop: 14 }}>
        <div
          className={ui.barFill}
          style={{ width: `${(founderCount / maxCount) * 100}%`, background: stageColor(topStage), opacity: 0.8 }}
        />
      </div>

      <p className={ui.tileLink} style={{ marginTop: 12 }}>
        See {founderCount === 1 ? "founder" : "all founders"} →
      </p>
    </button>
  );
}
