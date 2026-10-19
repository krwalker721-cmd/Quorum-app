"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import HandshakeButton from "@/components/HandshakeButton";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import { parseDbTime, timeAgo } from "@/lib/stage";
import JoinRequestsWidget, { type JoinRequest } from "./JoinRequestsWidget";
import { TabPill, TabPillRow } from "@/components/ui/TabPill";
import RoomThread from "@/components/rooms/RoomThread";
import RoomItemCard from "@/components/rooms/RoomItemCard";
import RoomVotes from "@/components/rooms/RoomVotes";
import { META, PANEL, getDomain, isValidUrl, sentence, type DecisionOption } from "@/components/rooms/kit";

type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
  role: string | null;
  joined_at: string;
};

type Message = {
  id: string;
  sender_id: string;
  content: string;
  is_system: boolean | null;
  created_at: string;
};

type Doc = {
  id: string;
  added_by: string | null;
  title: string;
  description: string | null;
  external_url?: string | null;
  doc_type?: string | null;
  created_at: string;
};

type Decision = {
  id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  options: DecisionOption[];
  status: string;
  winning_option: string | null;
  created_at: string;
};

type Vote = {
  id: string;
  decision_id: string;
  user_id: string;
  option_chosen: string;
};

type Tab = "thread" | "docs" | "decisions";

const TAB_LABEL: Record<Tab, string> = {
  thread: "Thread",
  docs: "Docs",
  decisions: "Decisions",
};

export default function ProjectRoomClient({
  currentUserId,
  project,
  members: initialMembers,
  messages: initialMessages,
  docs: initialDocs,
  decisions: initialDecisions,
  votes: initialVotes,
  joinRequests,
  isOwner,
  initialTab,
}: {
  currentUserId: string;
  project: {
    id: string;
    owner_id: string | null;
    title: string;
    description: string | null;
    category: string | null;
    looking_for: string | null;
    status: string;
    created_at: string;
  };
  members: Member[];
  messages: Message[];
  docs: Doc[];
  decisions: Decision[];
  votes: Vote[];
  joinRequests: JoinRequest[];
  isOwner: boolean;
  initialTab: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [decisions, setDecisions] = useState<Decision[]>(initialDecisions);
  const [votes, setVotes] = useState<Vote[]>(initialVotes);

  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Open decisions this user hasn't voted on yet — drives the amber tab count
  // and the "a decision needs your vote" rail tile.
  const myVotedDecisionIds = new Set(
    votes.filter((v) => v.user_id === currentUserId).map((v) => v.decision_id),
  );
  const openForMe = decisions.filter(
    (d) => d.status === "open" && !myVotedDecisionIds.has(d.id),
  );

  // Realtime: subscribe to project_messages inserts
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`project_messages_${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id]);

  // Realtime: membership removals. If I'm removed, bounce me out; otherwise drop
  // the removed member from the roster live.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`project_members_${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "project_members",
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          const removed = payload.old as { user_id?: string };
          if (!removed?.user_id) return;
          if (removed.user_id === currentUserId) {
            router.replace("/collab?error=removed");
          } else {
            setMembers((prev) => prev.filter((m) => m.id !== removed.user_id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id, currentUserId, router]);

  async function kickMember(target: Member) {
    if (
      !window.confirm(
        `Remove ${target.full_name ?? "this member"} from this project? They will lose access to the project room.`,
      )
    ) {
      return;
    }
    const res = await fetch("/api/project/kick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: project.id, user_id: target.id }),
    });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== target.id));
    } else {
      const j = await res.json().catch(() => ({}));
      window.alert(j?.error ?? "Could not remove member.");
    }
  }

  const closed = project.status === "closed";
  // created_at can arrive zoneless (UTC); parseDbTime keeps the day right
  // near midnight.
  const started = parseDbTime(project.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const decidedCount = decisions.filter((d) => d.status === "decided").length;
  const messageCount = messages.filter((m) => !m.is_system).length;

  return (
    <div
      className={"page-pad"}
      style={{ padding: "16px 26px 22px", maxWidth: 1280, margin: "0 auto" }}
    >
      <Link href="/collab" className={ui.tileLink}>
        ← Collab board
      </Link>

      {/* Header */}
      <div style={{ marginTop: 12, marginBottom: 20 }}>
        <h1
          className={`${ui.titleGradient} ${ui.balance}`}
          style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
        >
          {project.title}
        </h1>
        <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap" style={{ marginTop: 10 }}>
          <span
            className="inline-flex items-center gap-1.5"
            style={{ fontSize: 12, color: closed ? "var(--text-muted)" : "var(--green)" }}
          >
            <span
              aria-hidden
              className={ui.quietDot}
              style={closed ? undefined : { background: "#22c55e", opacity: 1 }}
            />
            {closed ? "Closed" : "Active"}
          </span>
          {project.category && <span className={ui.chip}>{sentence(project.category)}</span>}
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Started {started}</span>
          {project.looking_for && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Looking for {project.looking_for}
            </span>
          )}
        </div>
        {project.description && (
          <p
            className="whitespace-pre-wrap"
            style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)", marginTop: 12, maxWidth: "72ch" }}
          >
            {project.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="min-w-0 space-y-4">
          <TabPillRow>
            {(["thread", "docs", "decisions"] as const).map((t) => (
              <TabPill sleek key={t} active={tab === t} onClick={() => setTab(t)}>
                {TAB_LABEL[t]}
                {t === "decisions" && openForMe.length > 0 && (
                  <span style={{ color: "#f8c56a", marginLeft: 6 }}>{openForMe.length}</span>
                )}
              </TabPill>
            ))}
          </TabPillRow>

          {tab === "thread" && (
            <ThreadTab
              projectId={project.id}
              currentUserId={currentUserId}
              messages={messages}
              memberMap={memberMap}
            />
          )}
          {tab === "docs" && (
            <DocsTab
              projectId={project.id}
              currentUserId={currentUserId}
              docs={docs}
              memberMap={memberMap}
              onAdded={(d) => setDocs([d, ...docs])}
            />
          )}
          {tab === "decisions" && (
            <DecisionsTab
              projectId={project.id}
              currentUserId={currentUserId}
              decisions={decisions}
              votes={votes}
              members={members}
              onAdded={(d) => setDecisions([d, ...decisions])}
              onVoted={(v, decided) => {
                setVotes([...votes.filter((x) => !(x.decision_id === v.decision_id && x.user_id === v.user_id)), v]);
                if (decided) {
                  setDecisions((prev) =>
                    prev.map((dx) =>
                      dx.id === decided.id ? { ...dx, status: "decided", winning_option: decided.winning_option } : dx
                    )
                  );
                }
              }}
            />
          )}
        </div>

        {/* Right column */}
        <aside className="min-w-0 space-y-4">
          {openForMe.length > 0 && (
            <Tile gradient kicker="A decision needs your vote" kickerColor="#f8c56a">
              <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-primary)" }}>
                {openForMe[0].title}
              </p>
              <button
                type="button"
                onClick={() => setTab("decisions")}
                className={ui.primaryBtn}
                style={{ marginTop: 14 }}
              >
                Cast your vote →
              </button>
            </Tile>
          )}

          <Tile kicker="Members" right={`${members.length}`}>
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.id} className="group/member flex items-center gap-3">
                  <Avatar name={m.full_name} stage={m.stage} username={m.username} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate" style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      {m.full_name ?? "—"}
                      {m.id === project.owner_id && (
                        <span style={{ fontSize: 11.5, color: "#f8c56a", marginLeft: 6 }}>Owner</span>
                      )}
                      {m.id === currentUserId && (
                        <span style={{ ...META, marginLeft: 6 }}>You</span>
                      )}
                    </p>
                    {m.role && <p style={META}>{sentence(m.role)}</p>}
                  </div>
                  {isOwner && m.id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => kickMember(m)}
                      title={`Remove ${m.full_name ?? "member"}`}
                      aria-label={`Remove ${m.full_name ?? "member"}`}
                      className={`${ui.textBtn} px-1 sm:opacity-0 sm:group-hover/member:opacity-100 focus:opacity-100 hover:!text-red-400`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Tile>

          <Tile kicker="Handshake">
            <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-secondary)" }}>
              Log a commitment you made with someone on this project.
            </p>
            <HandshakeProjectButton
              currentUserId={currentUserId}
              projectId={project.id}
              projectTitle={project.title}
              members={members.filter((m) => m.id !== currentUserId)}
            />
          </Tile>

          {isOwner && (
            <JoinRequestsWidget
              projectId={project.id}
              projectTitle={project.title}
              initialRequests={joinRequests}
            />
          )}

          <ActivityWidget
            messages={messages}
            docs={docs}
            decisions={decisions}
            memberMap={memberMap}
          />

          <Tile kicker="Progress">
            <ProgressRow label="Decisions made" value={decidedCount} total={decisions.length} />
            <ProgressRow label="Shared docs" value={docs.length} />
            <ProgressRow label="Messages" value={messageCount} />
          </Tile>
        </aside>
      </div>
    </div>
  );
}

function ProgressRow({ label, value, total }: { label: string; value: number; total?: number }) {
  const pct = total && total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between" style={{ fontSize: 12 }}>
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ color: "var(--text-primary)" }}>
          {value}
          {total !== undefined && total > 0 && (
            <span style={{ color: "var(--text-muted)" }}> of {total}</span>
          )}
        </span>
      </div>
      {total !== undefined && total > 0 && (
        <div className={ui.barTrack} style={{ marginTop: 6 }}>
          <div className={ui.barFill} style={{ background: "#f59e0b", width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function HandshakeProjectButton({
  currentUserId,
  projectId,
  projectTitle,
  members,
}: {
  currentUserId: string;
  projectId: string;
  projectTitle: string;
  members: Member[];
}) {
  const [target] = useState(members[0] ?? null);
  if (!target) {
    return (
      <p style={{ ...META, marginTop: 10 }}>You can log one once someone else joins.</p>
    );
  }
  return (
    <div style={{ marginTop: 12 }}>
      <HandshakeButton
        sleek
        currentUserId={currentUserId}
        recipientId={target.id}
        recipientName={target.full_name}
        defaultAgreement={`re: ${projectTitle}\n\n`}
        projectId={projectId}
      />
    </div>
  );
}

function ThreadTab({
  projectId,
  currentUserId,
  messages,
  memberMap,
}: {
  projectId: string;
  currentUserId: string;
  messages: Message[];
  memberMap: Map<string, Member>;
}) {
  async function send(trimmed: string) {
    const supabase = createClient();
    const { error } = await supabase.from("project_messages").insert({
      project_id: projectId,
      sender_id: currentUserId,
      content: trimmed,
    });
    return !error;
  }

  return (
    <RoomThread
      messages={messages.map((m) => ({
        id: m.id,
        authorId: m.sender_id,
        body: m.content,
        isSystem: !!m.is_system,
        createdAt: m.created_at,
      }))}
      currentUserId={currentUserId}
      nameOf={(id) => memberMap.get(id)?.full_name}
      onSend={send}
    />
  );
}

function DocsTab({
  projectId,
  currentUserId,
  docs,
  memberMap,
  onAdded,
}: {
  projectId: string;
  currentUserId: string;
  docs: Doc[];
  memberMap: Map<string, Member>;
  onAdded: (d: Doc) => void;
}) {
  const [open, setOpen] = useState(false);
  // "upload" is a titled note (no file is attached); "link" carries a URL.
  const [activeTab, setActiveTab] = useState<"upload" | "link">("upload");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setUrl("");
    setErr(null);
    setActiveTab("upload");
    setOpen(false);
  }

  async function submitFile() {
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shared_docs")
      .insert({
        project_id: projectId,
        added_by: currentUserId,
        title: title.trim(),
        description: description.trim() || null,
        doc_type: "file",
      })
      .select("id, added_by, title, description, external_url, doc_type, created_at")
      .single();
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (data) {
      onAdded(data as Doc);
      reset();
    }
  }

  async function submitLink() {
    if (!title.trim()) return;
    if (!isValidUrl(url.trim())) {
      setErr("Enter a valid link, starting with http:// or https://.");
      return;
    }
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shared_docs")
      .insert({
        project_id: projectId,
        added_by: currentUserId,
        title: title.trim(),
        description: description.trim() || null,
        external_url: url.trim(),
        doc_type: "link",
      })
      .select("id, added_by, title, description, external_url, doc_type, created_at")
      .single();
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (data) {
      onAdded(data as Doc);
      reset();
    }
  }

  return (
    <div className="space-y-3">
      {docs.length === 0 && !open && (
        <div style={{ ...PANEL, padding: "18px 20px" }}>
          <div className={ui.empty}>
            <p className={ui.emptyTitle}>No shared docs yet.</p>
            <p className={ui.emptySub}>Keep the links and notes your team keeps reaching for here.</p>
          </div>
        </div>
      )}
      {docs.map((d) => {
        const adder = d.added_by ? memberMap.get(d.added_by) : null;
        const isLink = d.doc_type === "link" && !!d.external_url;
        const domain = isLink && d.external_url ? getDomain(d.external_url) : "";
        return (
          <RoomItemCard
            key={d.id}
            link={isLink}
            title={d.title}
            href={isLink && d.external_url ? d.external_url : null}
            meta={
              <>
                {domain ? `${domain} · ` : ""}
                {adder?.full_name ?? "Someone"} · {timeAgo(d.created_at)} ago
              </>
            }
            description={d.description}
          />
        );
      })}

      {open ? (
        <div className="space-y-3" style={{ ...PANEL, padding: 16 }}>
          <TabPillRow>
            {(["upload", "link"] as const).map((t) => (
              <TabPill
                sleek
                key={t}
                active={activeTab === t}
                onClick={() => {
                  setActiveTab(t);
                  setErr(null);
                }}
              >
                {t === "upload" ? "Note" : "Link"}
              </TabPill>
            ))}
          </TabPillRow>
          {activeTab === "link" && (
            <input
              placeholder="Paste a link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
              className={`${ui.search} w-full`}
            />
          )}
          <input
            placeholder={activeTab === "link" ? "What is this?" : "Title"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus={activeTab === "upload"}
            className={`${ui.search} w-full`}
          />
          <textarea
            rows={3}
            placeholder={activeTab === "link" ? "A short description (optional)" : "Notes (optional)"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${ui.search} w-full`}
            style={{ resize: "vertical" }}
          />
          {err && <p style={{ fontSize: 12, color: "#f87171" }}>{err}</p>}
          <div className="flex justify-end items-center gap-3">
            <button type="button" onClick={reset} className={ui.textBtn} style={{ fontSize: 12 }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={activeTab === "link" ? submitLink : submitFile}
              disabled={busy || !title.trim() || (activeTab === "link" && !url.trim())}
              className={ui.primaryBtn}
            >
              {activeTab === "link" ? "Add link" : "Add note"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${ui.ghostBtn} w-full`}>
          Add a shared doc
        </button>
      )}
    </div>
  );
}

function DecisionsTab({
  projectId,
  currentUserId,
  decisions,
  votes,
  members,
  onAdded,
  onVoted,
}: {
  projectId: string;
  currentUserId: string;
  decisions: Decision[];
  votes: Vote[];
  members: Member[];
  onAdded: (d: Decision) => void;
  onVoted: (v: Vote, decided?: { id: string; winning_option: string }) => void;
}) {
  async function submit(input: { title: string; description: string | null; options: string[] }) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("decisions")
      .insert({
        project_id: projectId,
        created_by: currentUserId,
        title: input.title,
        description: input.description,
        options: input.options,
        status: "open",
      })
      .select("id, created_by, title, description, options, status, winning_option, created_at")
      .single();
    if (!error && data) {
      onAdded(data as Decision);
      return true;
    }
    return false;
  }

  async function vote(decision: Decision, option: string) {
    const supabase = createClient();
    const existing = votes.find((v) => v.decision_id === decision.id && v.user_id === currentUserId);
    if (existing) {
      await supabase
        .from("decision_votes")
        .update({ option_chosen: option })
        .eq("id", existing.id);
    } else {
      await supabase.from("decision_votes").insert({
        decision_id: decision.id,
        user_id: currentUserId,
        option_chosen: option,
      });
    }

    // recompute and maybe close
    const others = votes.filter(
      (v) => v.decision_id === decision.id && v.user_id !== currentUserId
    );
    const newVotes = [...others, { id: "tmp", decision_id: decision.id, user_id: currentUserId, option_chosen: option }];
    const allMembersVoted = members.every((m) => newVotes.some((v) => v.user_id === m.id));
    const newRow: Vote = {
      id: existing?.id ?? "tmp",
      decision_id: decision.id,
      user_id: currentUserId,
      option_chosen: option,
    };

    let decided: { id: string; winning_option: string } | undefined;
    if (allMembersVoted && decision.status === "open") {
      const tally: Record<string, number> = {};
      newVotes.forEach((v) => {
        tally[v.option_chosen] = (tally[v.option_chosen] ?? 0) + 1;
      });
      const winner = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (winner) {
        await supabase
          .from("decisions")
          .update({ status: "decided", winning_option: winner })
          .eq("id", decision.id);
        decided = { id: decision.id, winning_option: winner };
      }
    }
    onVoted(newRow, decided);
  }

  return (
    <RoomVotes
      decisions={decisions}
      votes={votes}
      memberCount={members.length}
      currentUserId={currentUserId}
      onCreate={submit}
      onVote={(d, option) => vote(d as Decision, option)}
    />
  );
}

function ActivityWidget({
  messages,
  docs,
  decisions,
  memberMap,
}: {
  messages: Message[];
  docs: Doc[];
  decisions: Decision[];
  memberMap: Map<string, Member>;
}) {
  type Entry = { ts: string; text: string };
  const entries: Entry[] = [];
  for (const m of messages) {
    if (m.is_system) {
      entries.push({ ts: m.created_at, text: m.content });
    }
  }
  for (const d of decisions) {
    const who = d.created_by ? memberMap.get(d.created_by) : null;
    entries.push({
      ts: d.created_at,
      text: `${who?.full_name ?? who?.username ?? "Someone"} opened a decision: ${d.title}`,
    });
  }
  entries.sort((a, b) => parseDbTime(b.ts).getTime() - parseDbTime(a.ts).getTime());
  const recent = entries.slice(0, 6);

  return (
    <Tile kicker="Recent activity">
      {recent.length === 0 ? (
        <p className={ui.emptySub} style={{ marginTop: 0 }}>
          No activity yet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {recent.map((e, i) => (
            <li key={i} style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-secondary)" }}>
              {sentence(e.text)} <span style={META}>· {timeAgo(e.ts)} ago</span>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}
