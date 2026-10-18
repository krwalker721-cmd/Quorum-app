"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TabPill, TabPillRow } from "@/components/ui/TabPill";
import RoomThread from "@/components/rooms/RoomThread";
import RoomVotes from "@/components/rooms/RoomVotes";
import { realtimeDb, sprintDb } from "@/lib/hackathons/actions";
import type { SprintPhase, SprintState, SprintTiming } from "@/lib/hackathons/sprint";
import {
  BALLOT_COLUMNS,
  MESSAGE_COLUMNS,
  VOTE_COLUMNS,
  type MemberActivity,
  type RoomBallotRow,
  type RoomData,
  type RoomDocRow,
  type RoomLinkRow,
  type RoomMessageRow,
  type RoomSubmission,
  type RoomVoteRow,
} from "@/lib/hackathons/room";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import { MembersStrip, RoomTitle } from "./RoomHeader";
import { ChecklistPanel, FeedbackPanel, type TeamFeedback } from "./RoomSide";
import DeadlineWarning from "@/components/hackathon/submission/DeadlineWarning";
import TeamDocs, { type RemoteDocChange } from "./TeamDocs";
import TeamLinks from "./TeamLinks";
import { roomError } from "./roomError";

// A team's private room (Phase 6): thread, docs, links and votes, built from
// the Collab room's pieces (components/rooms) on the Sprint's own tables, and
// laid out like a Collab project room (2026-10-17): the conversation on the
// left; on the right a vote callout, members, what to do, the presentation,
// the submission and recent activity.
//
// Live: one realtime channel per room table, filtered to this team, on a
// connection signed in as the member (realtimeDb; an anonymous socket would
// have every event dropped by RLS). Deletions can't be filtered by team, so
// docs and links have an unfiltered DELETE channel that carries ids only.
// Coming back to the tab after a while re-reads everything from the server.

type Tab = "thread" | "docs" | "links" | "votes";
const TABS: Tab[] = ["thread", "docs", "links", "votes"];
const TAB_LABEL: Record<Tab, string> = { thread: "Thread", docs: "Docs", links: "Links", votes: "Votes" };

const VOTE_LABELS = {
  emptyTitle: "No votes yet.",
  emptySub: "Put a choice to the team. It closes once everyone has voted.",
  add: "Start a vote",
  submit: "Open vote",
};

/** How often the room tells the database the member has it open. */
const SEEN_EVERY_MS = 5 * 60_000;

function upsert<T extends { id: string }>(list: T[], row: T, prepend = false): T[] {
  const i = list.findIndex((x) => x.id === row.id);
  if (i === -1) return prepend ? [row, ...list] : [...list, row];
  const next = list.slice();
  next[i] = { ...list[i], ...row };
  return next;
}

export default function TeamRoomClient({
  sprint,
  room,
  viewerId,
  isMember,
  writable,
  initialTab,
  checkedInAt,
  feedback,
}: {
  sprint: {
    id: string;
    number: number;
    state: SprintState;
    phase: SprintPhase;
    theme: string | null;
    rules: string | null;
    timing: SprintTiming;
  };
  room: RoomData;
  viewerId: string;
  isMember: boolean;
  writable: boolean;
  initialTab?: string;
  /** The viewer's kickoff check-in, for the checklist. */
  checkedInAt: string | null;
  /** After the reveal: the peer reviews' feedback, anonymous (036); null before. */
  feedback: TeamFeedback[] | null;
}) {
  const router = useRouter();
  const teamId = room.team.id;
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "thread");
  const [messages, setMessages] = useState(room.messages);
  const [docs, setDocs] = useState(room.docs);
  const [links, setLinks] = useState(room.links);
  const [votes, setVotes] = useState(room.votes);
  const [ballots, setBallots] = useState(room.ballots);
  const [activity, setActivity] = useState(() => new Map(room.activity.map((a) => [a.user_id, a])));
  const [submittedAt, setSubmittedAt] = useState(room.submission?.completed_at ?? null);
  const [submission, setSubmission] = useState<RoomSubmission>(room.submission);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [remoteDoc, setRemoteDoc] = useState<RemoteDocChange | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A fresh read from the server (a refresh, a phase change) replaces what we have.
  useEffect(() => {
    setMessages(room.messages);
    setDocs(room.docs);
    setLinks(room.links);
    setVotes(room.votes);
    setBallots(room.ballots);
    setActivity(new Map(room.activity.map((a) => [a.user_id, a])));
    setSubmittedAt(room.submission?.completed_at ?? null);
    setSubmission(room.submission);
  }, [room]);

  const names = useMemo(() => new Map(room.members.map((m) => [m.id, m.full_name ?? m.username ?? "Founder"])), [room.members]);
  const nameOf = (id: string | null) => (id ? names.get(id) ?? "A former teammate" : "Someone");

  // Realtime.
  const routerRef = useRef(router);
  routerRef.current = router;
  useEffect(() => {
    let stopped = false;
    let cleanup = () => {};
    (async () => {
      const db = await realtimeDb();
      if (stopped) return;
      const filter = `team_id=eq.${teamId}`;
      const on = (table: string, handle: (p: { eventType: string; new: any; old: any }) => void, filtered = true) =>
        db
          .channel(`room-${table}-${filtered ? teamId : `del-${teamId}`}`)
          .on(
            "postgres_changes" as any,
            filtered ? { event: "*", schema: "public", table, filter } : { event: "DELETE", schema: "public", table },
            handle as any,
          )
          .subscribe();

      const channels = [
        on("hackathon_team_messages", (p) => {
          if (p.eventType === "DELETE") return;
          const row = p.new as RoomMessageRow;
          setMessages((list) => upsert(list, row));
        }),
        on("hackathon_team_docs", (p) => {
          if (p.eventType === "DELETE") return;
          const { content: _content, team_id: _team, ...meta } = p.new;
          setDocs((list) => upsert(list, meta as RoomDocRow, true).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
          if (p.eventType === "UPDATE") {
            setRemoteDoc({ id: meta.id, updated_at: meta.updated_at, updated_by: meta.updated_by, title: meta.title });
          }
        }),
        on("hackathon_team_docs", (p) => {
          const id = p.old?.id as string | undefined;
          if (id) setDocs((list) => list.filter((d) => d.id !== id));
        }, false),
        on("hackathon_team_links", (p) => {
          if (p.eventType === "INSERT") setLinks((list) => upsert(list, p.new as RoomLinkRow, true));
        }),
        on("hackathon_team_links", (p) => {
          const id = p.old?.id as string | undefined;
          if (id) setLinks((list) => list.filter((l) => l.id !== id));
        }, false),
        on("hackathon_team_votes", (p) => {
          if (p.eventType !== "DELETE") setVotes((list) => upsert(list, p.new as RoomVoteRow, true));
        }),
        on("hackathon_team_ballots", (p) => {
          if (p.eventType !== "DELETE") setBallots((list) => upsert(list, p.new as RoomBallotRow));
        }),
        on("hackathon_team_member_activity", (p) => {
          if (p.eventType === "DELETE") return;
          const a = p.new as MemberActivity;
          setActivity((m) => new Map(m).set(a.user_id, { ...m.get(a.user_id), ...a }));
        }),
        // The submission (and its deck), as teammates change it.
        on("hackathon_submissions", (p) => {
          if (p.eventType !== "DELETE") setSubmission(p.new as RoomSubmission);
        }),
        on("hackathon_team_pulse", (p) => {
          if (p.eventType !== "DELETE") setSubmittedAt((p.new.submitted_at as string | null) ?? null);
        }),
        // Someone joined (an admin moved them in): read the roster again.
        on("hackathon_team_members", (p) => {
          if (p.eventType === "INSERT") routerRef.current.refresh();
        }),
      ];
      cleanup = () => channels.forEach((c) => db.removeChannel(c));
    })();
    return () => {
      stopped = true;
      cleanup();
    };
  }, [teamId]);

  // Back after a while (a sleeping laptop drops the socket): read it all again.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30_000) routerRef.current.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // "Seen": when the room opens and every few minutes while it's in view,
  // with this browser's time zone (so night hours don't count as quiet).
  useEffect(() => {
    if (!isMember) return;
    const tz = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return null;
      }
    })();
    const seen = () => {
      if (document.visibilityState !== "visible") return;
      void sprintDb().rpc("hackathon_room_seen", { p_team_id: teamId, p_time_zone: tz });
    };
    seen();
    const t = setInterval(seen, SEEN_EVERY_MS);
    document.addEventListener("visibilitychange", seen);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", seen);
    };
  }, [isMember, teamId]);

  async function send(text: string) {
    setNotice(null);
    const { data, error } = await sprintDb()
      .from("hackathon_team_messages")
      .insert({ team_id: teamId, user_id: viewerId, body: text })
      .select(MESSAGE_COLUMNS)
      .single();
    if (error || !data) {
      setNotice(roomError(error));
      return false;
    }
    setMessages((list) => upsert(list, data as RoomMessageRow));
    return true;
  }

  async function createVote(input: { title: string; description: string | null; options: string[] }) {
    setNotice(null);
    const { data, error } = await sprintDb()
      .from("hackathon_team_votes")
      .insert({ team_id: teamId, title: input.title, description: input.description, options: input.options })
      .select(VOTE_COLUMNS)
      .single();
    if (error || !data) {
      setNotice(roomError(error));
      return false;
    }
    setVotes((list) => upsert(list, data as RoomVoteRow, true));
    return true;
  }

  // The database records the ballot and closes the vote once everyone has
  // voted (migration 019); the closing arrives over realtime.
  async function castBallot(voteId: string, option: string) {
    setNotice(null);
    const mine = ballots.find((b) => b.vote_id === voteId && b.user_id === viewerId);
    const db = sprintDb();
    const { data, error } = mine
      ? await db.from("hackathon_team_ballots").update({ option_chosen: option }).eq("id", mine.id).select(BALLOT_COLUMNS).single()
      : await db
          .from("hackathon_team_ballots")
          .insert({ vote_id: voteId, team_id: teamId, user_id: viewerId, option_chosen: option })
          .select(BALLOT_COLUMNS)
          .single();
    if (error || !data) {
      setNotice(roomError(error));
      return;
    }
    setBallots((list) => upsert(list, data as RoomBallotRow));
    const { data: vote } = await db.from("hackathon_team_votes").select(VOTE_COLUMNS).eq("id", voteId).single();
    if (vote) setVotes((list) => upsert(list, vote as RoomVoteRow));
  }

  async function sleep(until: number | null): Promise<string | null> {
    const { error } = await sprintDb().rpc("hackathon_room_sleep", {
      p_team_id: teamId,
      p_until: until === null ? null : new Date(until).toISOString(),
    });
    if (error) return error.message;
    const { data } = await sprintDb()
      .from("hackathon_team_member_activity")
      .select("user_id, last_active_at, last_seen_at, time_zone, sleeping_until")
      .eq("team_id", teamId)
      .eq("user_id", viewerId)
      .maybeSingle();
    if (data) setActivity((m) => new Map(m).set(viewerId, data as MemberActivity));
    return null;
  }

  const openForMe = votes.filter((v) => v.status === "open" && !ballots.some((b) => b.vote_id === v.id && b.user_id === viewerId));
  const closedNote = writable ? null : closedReason(sprint.state, isMember);
  const counts: Record<Tab, number | null> = {
    thread: null,
    docs: docs.length || null,
    links: links.length || null,
    votes: votes.length || null,
  };

  return (
    <>
      <RoomTitle sprint={sprint} team={room.team} />
      <MembersStrip sprint={sprint} members={room.members} activity={activity} viewerId={viewerId} writable={writable} onSleep={sleep} />

      {isMember && (
        <DeadlineWarning
          endsAt={sprint.timing.ends_at}
          live={sprint.state === "live"}
          complete={Boolean(submittedAt)}
          href={`/hackathon/${sprint.number}/team/${room.team.slug}/submission`}
        />
      )}

      {closedNote && (
        <p
          role="status"
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 14,
          }}
        >
          {closedNote}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4 items-start">
      <div className="min-w-0 space-y-4">
        <div style={{ overflowX: "auto" }} className="scroll-thin">
          <TabPillRow>
            {TABS.map((t) => (
              <TabPill
                sleek
                key={t}
                active={tab === t}
                onClick={() => {
                  setTab(t);
                  setNotice(null);
                }}
              >
                {TAB_LABEL[t]}
                {t === "votes" && writable && openForMe.length > 0 ? (
                  <span style={{ color: "#f8c56a", marginLeft: 6 }}>{openForMe.length}</span>
                ) : counts[t] ? (
                  <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>{counts[t]}</span>
                ) : null}
              </TabPill>
            ))}
          </TabPillRow>
        </div>

        {tab !== "thread" && notice && <p style={{ fontSize: 12, color: "#f87171" }}>{notice}</p>}

        {tab === "thread" && (
          <RoomThread
            messages={messages.map((m) => ({
              id: m.id,
              authorId: m.user_id,
              body: m.body,
              isSystem: m.is_system,
              createdAt: m.created_at,
              deleted: Boolean(m.deleted_at),
            }))}
            currentUserId={viewerId}
            nameOf={(id) => names.get(id) ?? "A former teammate"}
            onSend={send}
            notice={
              notice ? (
                <p style={{ fontSize: 12, color: "#f87171", padding: "8px 14px 0" }}>{notice}</p>
              ) : undefined
            }
            closed={
              closedNote ? (
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", borderTop: "1px solid rgba(255, 255, 255, 0.06)", padding: "14px 16px" }}>
                  {isMember ? "The thread is read-only now." : "Only the team can post here."}
                </p>
              ) : undefined
            }
          />
        )}
        {tab === "docs" && (
          <TeamDocs
            teamId={teamId}
            docs={docs}
            nameOf={nameOf}
            viewerId={viewerId}
            writable={writable}
            remote={remoteDoc}
            openId={openDoc}
            onOpen={setOpenDoc}
            onCreated={(d) => setDocs((list) => upsert(list, d, true))}
            onDeleted={(id) => setDocs((list) => list.filter((d) => d.id !== id))}
          />
        )}
        {tab === "links" && (
          <TeamLinks
            teamId={teamId}
            links={links}
            nameOf={nameOf}
            viewerId={viewerId}
            writable={writable}
            onAdded={(l) => setLinks((list) => upsert(list, l, true))}
            onDeleted={(id) => setLinks((list) => list.filter((l) => l.id !== id))}
          />
        )}
        {tab === "votes" && (
          <RoomVotes
            decisions={votes}
            votes={ballots.map((b) => ({ decision_id: b.vote_id, user_id: b.user_id, option_chosen: b.option_chosen }))}
            memberCount={room.members.length}
            currentUserId={viewerId}
            onCreate={createVote}
            onVote={(d, option) => void castBallot(d.id, option)}
            labels={VOTE_LABELS}
            readOnly={!writable}
          />
        )}
      </div>

      {/* Right column, like a Collab project room's: kept short and in view. */}
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
        {writable && openForMe.length > 0 && (
          <Tile gradient kicker="A vote needs you" kickerColor="#f8c56a">
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-primary)" }}>{openForMe[0].title}</p>
            <button type="button" onClick={() => setTab("votes")} className={ui.primaryBtn} style={{ marginTop: 14 }}>
              Cast your vote →
            </button>
          </Tile>
        )}
        {feedback && <FeedbackPanel feedback={feedback} />}
        <ChecklistPanel
          sprint={sprint}
          team={room.team}
          checkedInAt={checkedInAt}
          isMember={isMember}
          docs={docs}
          links={links}
          votes={votes}
          submission={submission}
          onSubmissionChanged={setSubmission}
        />
      </aside>
      </div>
    </>
  );
}

function closedReason(state: SprintState, isMember: boolean): string {
  if (!isMember) return "You're viewing this room as an admin. Only the team can post or edit here.";
  switch (state) {
    case "paused":
      return "The Sprint is paused, so the room is read-only until it resumes.";
    case "cancelled":
      return "This Sprint was cancelled. The room is read-only; everything in it stays here for your team.";
    case "revealed":
      return "The results are out, so the room is read-only now. Everything in it stays here for your team.";
    default:
      return "The room is read-only right now.";
  }
}
