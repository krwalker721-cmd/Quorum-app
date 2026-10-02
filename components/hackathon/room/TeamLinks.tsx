"use client";

import { useState } from "react";
import ui from "@/components/ui/sleek.module.css";
import RoomItemCard from "@/components/rooms/RoomItemCard";
import { PANEL, getDomain, isValidUrl } from "@/components/rooms/kit";
import { sprintDb } from "@/lib/hackathons/actions";
import { timeAgo } from "@/lib/stage";
import { LINK_COLUMNS, type RoomLinkRow } from "@/lib/hackathons/room";
import { roomError } from "./roomError";

// The team's links: the repo, the deploy, the Figma file. Cards match the
// Collab room's. Whoever added a link can take it away.
export default function TeamLinks({
  teamId,
  links,
  nameOf,
  viewerId,
  writable,
  onAdded,
  onDeleted,
}: {
  teamId: string;
  links: RoomLinkRow[];
  nameOf: (id: string | null) => string;
  viewerId: string;
  writable: boolean;
  onAdded: (l: RoomLinkRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setUrl("");
    setLabel("");
    setError(null);
    setOpen(false);
  }

  async function add() {
    const u = url.trim();
    if (!isValidUrl(u)) {
      setError("Enter a valid link, starting with http:// or https://.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: e } = await sprintDb()
      .from("hackathon_team_links")
      .insert({ team_id: teamId, url: u, label: label.trim() || null })
      .select(LINK_COLUMNS)
      .single();
    setBusy(false);
    if (e || !data) {
      setError(roomError(e));
      return;
    }
    onAdded(data as RoomLinkRow);
    reset();
  }

  async function remove(l: RoomLinkRow) {
    if (!window.confirm(`Remove ${l.label || getDomain(l.url) || "this link"}?`)) return;
    const { error: e } = await sprintDb().from("hackathon_team_links").delete().eq("id", l.id);
    if (e) setError(roomError(e));
    else onDeleted(l.id);
  }

  return (
    <div className="space-y-3">
      {links.length === 0 && !open && (
        <div style={{ ...PANEL, padding: "18px 20px" }}>
          <div className={ui.empty}>
            <p className={ui.emptyTitle}>No links yet.</p>
            <p className={ui.emptySub}>The repo, the deploy, the design file: keep them one tap away.</p>
          </div>
        </div>
      )}
      {links.map((l) => {
        const domain = getDomain(l.url);
        return (
          <RoomItemCard
            key={l.id}
            link
            title={l.label || domain || l.url}
            href={l.url}
            meta={
              <>
                {domain ? `${domain} · ` : ""}
                {nameOf(l.created_by)} · {timeAgo(l.created_at)} ago
              </>
            }
            action={
              writable && l.created_by === viewerId ? (
                <button
                  type="button"
                  onClick={() => remove(l)}
                  aria-label={`Remove ${l.label || domain}`}
                  title="Remove link"
                  className={`${ui.textBtn} px-1 hover:!text-red-400`}
                >
                  ✕
                </button>
              ) : undefined
            }
          />
        );
      })}

      {error && !open && <p style={{ fontSize: 12, color: "#f87171" }}>{error}</p>}

      {!writable ? null : open ? (
        <div className="space-y-3" style={{ ...PANEL, padding: 16 }}>
          <input
            placeholder="Paste a link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            inputMode="url"
            className={`${ui.search} w-full`}
          />
          <input
            placeholder="What is this? (optional)"
            value={label}
            maxLength={200}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            className={`${ui.search} w-full`}
          />
          {error && <p style={{ fontSize: 12, color: "#f87171" }}>{error}</p>}
          <div className="flex justify-end items-center gap-3">
            <button type="button" onClick={reset} className={ui.textBtn} style={{ fontSize: 12 }}>
              Cancel
            </button>
            <button type="button" onClick={add} disabled={busy || !url.trim()} className={ui.primaryBtn}>
              Add link
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${ui.ghostBtn} w-full`}>
          Add a link
        </button>
      )}
    </div>
  );
}
