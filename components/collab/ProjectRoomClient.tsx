"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import HandshakeButton from "@/components/HandshakeButton";
import { timeAgo } from "@/lib/stage";

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
  created_at: string;
};

type DecisionOption = string | { label: string };

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

function optLabel(o: DecisionOption) {
  return typeof o === "string" ? o : o.label;
}

export default function ProjectRoomClient({
  currentUserId,
  project,
  members,
  messages: initialMessages,
  docs: initialDocs,
  decisions: initialDecisions,
  votes: initialVotes,
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
  initialTab: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [decisions, setDecisions] = useState<Decision[]>(initialDecisions);
  const [votes, setVotes] = useState<Vote[]>(initialVotes);

  const memberMap = new Map(members.map((m) => [m.id, m]));

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

  return (
    <>
      {/* Sub header bar */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/collab"
            className="font-mono lowercase text-[0.7rem] text-text-faint hover:text-text-primary"
          >
            â† collab_board
          </Link>
          <span className="text-text-faint">/</span>
          <h2 className="font-sans lowercase text-text-primary text-base truncate">{project.title}</h2>
          <span
            className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
            style={{
              border: `1px solid ${project.status === "closed" ? "#6e7681" : "#22c55e"}`,
              color: project.status === "closed" ? "#6e7681" : "#22c55e",
            }}
          >
            {project.status === "closed" ? "closed" : "active"}
          </span>
        </div>
        <HandshakeProjectButton
          currentUserId={currentUserId}
          projectTitle={project.title}
          members={members.filter((m) => m.id !== currentUserId)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 py-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Project info section */}
          <div
            className="p-5 border"
            style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
          >
            <h1 className="font-sans lowercase text-text-primary text-xl font-bold">{project.title}</h1>
            {project.description && (
              <p className="text-text-secondary text-sm mt-3 leading-relaxed whitespace-pre-wrap">
                {project.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {members.map((m) => (
                <Avatar
                  key={m.id}
                  name={m.full_name}
                  stage={m.stage}
                  username={m.username}
                  size={24}
                />
              ))}
              <span className="font-mono lowercase text-[0.65rem] text-text-faint ml-2">
                started {new Date(project.created_at).toLocaleDateString()}
              </span>
              {project.category && (
                <span
                  className="font-mono lowercase text-[0.6rem] px-2 py-0.5 ml-auto"
                  style={{ border: "1px solid #f59e0b", color: "#f59e0b" }}
                >
                  {project.category}
                </span>
              )}
              {project.looking_for && (
                <span
                  className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                >
                  {project.looking_for}
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
            {(["thread", "docs", "decisions"] as const).map((t) => {
              const active = tab === t;
              const label = t === "docs" ? "shared_docs" : t;
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
        <aside className="space-y-4">
          <div className="p-4 border" style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}>
            <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-3">members</p>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar
                    name={m.full_name}
                    stage={m.stage}
                    username={m.username}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono lowercase text-[0.7rem] text-text-primary truncate">
                      {m.full_name?.toLowerCase() ?? "â€”"}
                    </p>
                    {m.role && (
                      <p className="font-mono lowercase text-[0.6rem] text-text-faint">{m.role}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="p-4 border"
            style={{ background: "rgba(88, 166, 255, 0.06)", borderColor: "rgba(88, 166, 255, 0.35)" }}
          >
            <p className="font-mono lowercase text-[0.65rem]" style={{ color: "#58a6ff" }}>
              â—ˆ log handshake
            </p>
            <p className="font-mono lowercase text-[0.7rem] text-text-muted mt-2">
              capture a commitment scoped to this project.
            </p>
            <HandshakeProjectButton
              currentUserId={currentUserId}
              projectTitle={project.title}
              members={members.filter((m) => m.id !== currentUserId)}
              variant="link"
            />
          </div>

          <ActivityWidget
            messages={messages}
            docs={docs}
            decisions={decisions}
            memberMap={memberMap}
          />

          <div className="p-4 border" style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}>
            <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-3">progress</p>
            <ProgressRow label="decisions" value={decisions.filter((d) => d.status === "decided").length} total={decisions.length} />
            <ProgressRow label="shared_docs" value={docs.length} />
            <ProgressRow label="messages" value={messages.filter((m) => !m.is_system).length} />
          </div>
        </aside>
      </div>
    </>
  );
}

function ProgressRow({ label, value, total }: { label: string; value: number; total?: number }) {
  const pct = total && total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between">
        <span className="font-mono lowercase text-[0.65rem] text-text-muted">{label}</span>
        <span className="font-mono lowercase text-[0.65rem] text-text-primary">
          {value}
          {total !== undefined && total > 0 && `/${total}`}
        </span>
      </div>
      {total !== undefined && total > 0 && (
        <div className="h-1 mt-1" style={{ background: "var(--border)" }}>
          <div className="h-1" style={{ background: "#f59e0b", width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function HandshakeProjectButton({
  currentUserId,
  projectTitle,
  members,
  variant = "button",
}: {
  currentUserId: string;
  projectTitle: string;
  members: Member[];
  variant?: "button" | "link";
}) {
  const [target, setTarget] = useState(members[0] ?? null);
  if (!target) {
    return variant === "link" ? (
      <span className="font-mono lowercase text-[0.65rem] text-text-faint mt-3 block">
        log agreement â†’ (no co-members yet)
      </span>
    ) : null;
  }
  return (
    <div className={variant === "link" ? "mt-3" : ""}>
      <HandshakeButton
        currentUserId={currentUserId}
        recipientId={target.id}
        recipientName={target.full_name}
        defaultAgreement={`re: ${projectTitle}\n\n`}
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
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("project_messages").insert({
      project_id: projectId,
      sender_id: currentUserId,
      content: trimmed,
    });
    setBusy(false);
    if (!error) setText("");
  }

  return (
    <div
      className="flex flex-col border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border)", minHeight: 500 }}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-thin" style={{ maxHeight: 600 }}>
        {messages.length === 0 ? (
          <p className="font-mono lowercase text-xs text-text-faint">no messages yet. say hello.</p>
        ) : (
          messages.map((m) => {
            if (m.is_system) {
              return (
                <p
                  key={m.id}
                  className="font-mono lowercase text-[0.65rem] text-text-faint italic text-center"
                >
                  {m.content} Â· {timeAgo(m.created_at)} ago
                </p>
              );
            }
            const mine = m.sender_id === currentUserId;
            const sender = memberMap.get(m.sender_id);
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} gap-2`}>
                {!mine && (
                  <Avatar
                    name={sender?.full_name}
                    stage={sender?.stage}
                    username={sender?.username}
                    size={26}
                  />
                )}
                <div
                  className="max-w-[72%] px-3 py-2"
                  style={{
                    background: mine ? "rgba(245, 158, 11,0.12)" : "var(--card)",
                    border: `1px solid ${mine ? "rgba(245, 158, 11,0.35)" : "var(--border)"}`,
                  }}
                >
                  {!mine && (
                    <p className="font-mono lowercase text-[0.6rem] text-text-faint">
                      {sender?.full_name?.toLowerCase() ?? "â€”"}
                    </p>
                  )}
                  <p className="text-text-primary text-sm whitespace-pre-wrap leading-snug">{m.content}</p>
                  <p className="font-mono lowercase text-[0.55rem] text-text-faint mt-1">
                    {timeAgo(m.created_at)} ago
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t p-3 flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="messageâ€¦"
          className="flex-1 px-3 py-2 text-text-primary"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        />
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          className="font-mono lowercase text-[0.7rem] px-4 py-2 hover:opacity-90 disabled:opacity-50"
          style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
        >
          send
        </button>
      </div>
    </div>
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shared_docs")
      .insert({
        project_id: projectId,
        added_by: currentUserId,
        title: title.trim(),
        description: description.trim() || null,
      })
      .select("id, added_by, title, description, created_at")
      .single();
    setBusy(false);
    if (!error && data) {
      onAdded(data as Doc);
      setTitle("");
      setDescription("");
      setOpen(false);
    }
  }

  return (
    <div className="space-y-3">
      {docs.length === 0 && !open && (
        <p className="font-mono lowercase text-xs text-text-faint">no shared docs yet.</p>
      )}
      {docs.map((d) => {
        const adder = d.added_by ? memberMap.get(d.added_by) : null;
        return (
          <div
            key={d.id}
            className="p-4 border flex items-start gap-3"
            style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
          >
            <span className="font-mono text-lg" style={{ color: "#f59e0b" }}>
              â–¤
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-text-primary text-sm lowercase">{d.title.toLowerCase()}</p>
              <p className="font-mono lowercase text-[0.6rem] text-text-faint mt-1">
                {adder?.full_name?.toLowerCase() ?? "someone"} Â· {timeAgo(d.created_at)} ago
              </p>
              {d.description && (
                <p className="text-text-secondary text-xs mt-2 leading-relaxed whitespace-pre-wrap">
                  {d.description}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {open ? (
        <div
          className="p-4 border space-y-3"
          style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        >
          <input
            placeholder="document title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 text-text-primary"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          />
          <textarea
            rows={3}
            placeholder="description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-text-primary"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="font-mono lowercase text-[0.7rem] px-3 py-1 text-text-faint hover:text-text-primary"
            >
              cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !title.trim()}
              className="font-mono lowercase text-[0.7rem] px-3 py-1 hover:opacity-90 disabled:opacity-50"
              style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
            >
              add â†’
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full p-4 font-mono lowercase text-xs text-text-faint hover:text-text-primary"
          style={{ border: "1px dashed var(--border)" }}
        >
          + add shared doc
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
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    const opts = optionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (opts.length < 2) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("decisions")
      .insert({
        project_id: projectId,
        created_by: currentUserId,
        title: title.trim(),
        description: description.trim() || null,
        options: opts,
        status: "open",
      })
      .select("id, created_by, title, description, options, status, winning_option, created_at")
      .single();
    setBusy(false);
    if (!error && data) {
      onAdded(data as Decision);
      setTitle("");
      setDescription("");
      setOptionsText("");
      setOpen(false);
    }
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
    <div className="space-y-3">
      {decisions.length === 0 && !open && (
        <p className="font-mono lowercase text-xs text-text-faint">no decisions yet.</p>
      )}
      {decisions.map((d) => {
        const decisionVotes = votes.filter((v) => v.decision_id === d.id);
        const myVote = decisionVotes.find((v) => v.user_id === currentUserId)?.option_chosen ?? null;
        const tally: Record<string, number> = {};
        decisionVotes.forEach((v) => {
          tally[v.option_chosen] = (tally[v.option_chosen] ?? 0) + 1;
        });
        const totalMembers = members.length;
        const totalVoted = decisionVotes.length;
        return (
          <div
            key={d.id}
            className="p-4 border"
            style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-sans text-text-primary text-sm lowercase">{d.title.toLowerCase()}</h4>
              <span
                className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
                style={{
                  border: `1px solid ${d.status === "decided" ? "#22c55e" : "#f59e0b"}`,
                  color: d.status === "decided" ? "#22c55e" : "#f59e0b",
                }}
              >
                {d.status}
              </span>
            </div>
            {d.description && (
              <p className="text-text-secondary text-xs mt-1 mb-3 leading-relaxed whitespace-pre-wrap">
                {d.description}
              </p>
            )}
            {d.status === "decided" && d.winning_option ? (
              <p className="font-mono lowercase text-xs mt-2">
                <span style={{ color: "#22c55e" }}>â†’ {d.winning_option}</span>{" "}
                <span className="text-text-faint">
                  Â· {totalVoted === totalMembers ? "unanimous" : `${tally[d.winning_option] ?? 0}/${totalMembers} voted`}
                </span>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                {d.options.map((o) => {
                  const label = optLabel(o);
                  const active = myVote === label;
                  return (
                    <button
                      key={label}
                      onClick={() => vote(d, label)}
                      className="font-mono lowercase text-[0.65rem] px-3 py-1"
                      style={{
                        border: `1px solid ${active ? "#f59e0b" : "var(--border)"}`,
                        color: active ? "#f59e0b" : "var(--text-muted)",
                        background: active ? "rgba(245, 158, 11,0.08)" : "transparent",
                      }}
                    >
                      {label.toLowerCase()} {tally[label] ? `Â· ${tally[label]}` : ""}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {open ? (
        <div
          className="p-4 border space-y-3"
          style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        >
          <input
            placeholder="decision title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 text-text-primary"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          />
          <textarea
            rows={2}
            placeholder="context (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-text-primary"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          />
          <textarea
            rows={3}
            placeholder="options (one per line, min 2)"
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            className="w-full px-3 py-2 text-text-primary"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="font-mono lowercase text-[0.7rem] px-3 py-1 text-text-faint hover:text-text-primary"
            >
              cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !title.trim()}
              className="font-mono lowercase text-[0.7rem] px-3 py-1 hover:opacity-90 disabled:opacity-50"
              style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
            >
              open decision â†’
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full p-4 font-mono lowercase text-xs text-text-faint hover:text-text-primary"
          style={{ border: "1px dashed var(--border)" }}
        >
          + add decision
        </button>
      )}
    </div>
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
      text: `${who?.username ?? "someone"} opened decision: ${d.title}`,
    });
  }
  entries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const recent = entries.slice(0, 6);

  return (
    <div className="p-4 border" style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}>
      <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-3">recent_activity</p>
      {recent.length === 0 ? (
        <p className="font-mono lowercase text-[0.7rem] text-text-faint">no activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {recent.map((e, i) => (
            <li key={i} className="font-mono lowercase text-[0.65rem] text-text-muted leading-snug">
              {e.text} Â· <span className="text-text-faint">{timeAgo(e.ts)} ago</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
