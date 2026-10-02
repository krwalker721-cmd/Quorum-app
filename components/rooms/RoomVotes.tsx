"use client";

import { useState } from "react";
import ui from "@/components/ui/sleek.module.css";
import { META, PANEL, optLabel, type DecisionOption } from "./kit";

/** A choice put to the team. Collab calls these decisions; Sprints call them votes. */
export type RoomDecision = {
  id: string;
  title: string;
  description: string | null;
  options: DecisionOption[];
  status: string;
  winning_option: string | null;
};

export type RoomBallot = { decision_id: string; user_id: string; option_chosen: string };

export type RoomVotesLabels = {
  emptyTitle: string;
  emptySub: string;
  add: string;
  submit: string;
};

const COLLAB_LABELS: RoomVotesLabels = {
  emptyTitle: "No decisions yet.",
  emptySub: "Put a choice to the team. It closes when everyone has voted.",
  add: "Add a decision",
  submit: "Open decision",
};

/**
 * A room's votes: each open choice with its tally, decided ones with the
 * winner, and the form to open a new one. The room owns the data: `onCreate`
 * resolves true once the vote is saved, `onVote` records the viewer's ballot.
 */
export default function RoomVotes({
  decisions,
  votes,
  memberCount,
  currentUserId,
  onCreate,
  onVote,
  labels = COLLAB_LABELS,
  readOnly = false,
  strictUnanimous = false,
}: {
  decisions: RoomDecision[];
  votes: RoomBallot[];
  memberCount: number;
  currentUserId: string;
  onCreate: (input: { title: string; description: string | null; options: string[] }) => Promise<boolean>;
  onVote: (decision: RoomDecision, option: string) => void;
  labels?: RoomVotesLabels;
  /** No new votes and no ballots (the room has closed). */
  readOnly?: boolean;
  /**
   * "Unanimous" only when everyone chose the winner. Off for the Collab room,
   * which says it whenever everyone has voted (kept as it was; flagged).
   */
  strictUnanimous?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [busy, setBusy] = useState(false);

  const optionCount = optionsText.split("\n").filter((s) => s.trim()).length;

  async function submit() {
    if (!title.trim()) return;
    const opts = optionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (opts.length < 2) return;
    setBusy(true);
    const ok = await onCreate({ title: title.trim(), description: description.trim() || null, options: opts });
    setBusy(false);
    if (ok) {
      setTitle("");
      setDescription("");
      setOptionsText("");
      setOpen(false);
    }
  }

  return (
    <div className="space-y-3">
      {decisions.length === 0 && !open && (
        <div style={{ ...PANEL, padding: "18px 20px" }}>
          <div className={ui.empty}>
            <p className={ui.emptyTitle}>{labels.emptyTitle}</p>
            <p className={ui.emptySub}>
              {labels.emptySub}
            </p>
          </div>
        </div>
      )}
      {decisions.map((d) => {
        const decisionVotes = votes.filter((v) => v.decision_id === d.id);
        const myVote = decisionVotes.find((v) => v.user_id === currentUserId)?.option_chosen ?? null;
        const tally: Record<string, number> = {};
        decisionVotes.forEach((v) => {
          tally[v.option_chosen] = (tally[v.option_chosen] ?? 0) + 1;
        });
        const totalMembers = memberCount;
        const totalVoted = decisionVotes.length;
        const decided = d.status === "decided";
        return (
          <div key={d.id} className={ui.tile} style={{ padding: "16px 18px" }}>
            <div className="flex items-start justify-between gap-3">
              <h4 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: "var(--text-primary)" }}>
                {d.title}
              </h4>
              <span
                className={`${ui.chip} ${decided ? "" : ui.chipAmber} shrink-0`}
                style={
                  decided
                    ? { color: "#4ade80", borderColor: "rgba(34, 197, 94, 0.35)", background: "rgba(34, 197, 94, 0.08)" }
                    : undefined
                }
              >
                {decided ? "Decided" : "Open"}
              </span>
            </div>
            {d.description && (
              <p
                className="whitespace-pre-wrap"
                style={{ fontSize: 12, lineHeight: 1.55, color: "var(--text-secondary)", marginTop: 6 }}
              >
                {d.description}
              </p>
            )}
            {decided && d.winning_option ? (
              <p style={{ fontSize: 13, marginTop: 12 }}>
                <span style={{ color: "#4ade80" }}>✓ {d.winning_option}</span>
                <span style={META}>
                  {" "}
                  · {(strictUnanimous ? (tally[d.winning_option] ?? 0) === totalMembers : totalVoted === totalMembers)
                    ? "Unanimous"
                    : `${tally[d.winning_option] ?? 0} of ${totalMembers} votes`}
                </span>
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
                  {d.options.map((o) => {
                    const label = optLabel(o);
                    const active = myVote === label;
                    return (
                      <button
                        type="button"
                        key={label}
                        onClick={() => onVote(d, label)}
                        aria-pressed={active}
                        disabled={readOnly || undefined}
                        className={`${ui.pill}${active ? ` ${ui.pillActive}` : ""}`}
                      >
                        {label}
                        {tally[label] ? ` · ${tally[label]}` : ""}
                      </button>
                    );
                  })}
                </div>
                <p style={{ ...META, marginTop: 10 }}>
                  {totalVoted} of {totalMembers} voted
                </p>
              </>
            )}
          </div>
        );
      })}

      {readOnly ? null : open ? (
        <div className="space-y-3" style={{ ...PANEL, padding: 16 }}>
          <input
            placeholder="What needs deciding?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className={`${ui.search} w-full`}
          />
          <textarea
            rows={2}
            placeholder="Context (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${ui.search} w-full`}
            style={{ resize: "vertical" }}
          />
          <textarea
            rows={3}
            placeholder={"Options, one per line (at least two)"}
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            className={`${ui.search} w-full`}
            style={{ resize: "vertical" }}
          />
          <div className="flex justify-end items-center gap-3">
            <button type="button" onClick={() => setOpen(false)} className={ui.textBtn} style={{ fontSize: 12 }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !title.trim() || optionCount < 2}
              className={ui.primaryBtn}
            >
              {labels.submit}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${ui.ghostBtn} w-full`}>
          {labels.add}
        </button>
      )}
    </div>
  );
}
