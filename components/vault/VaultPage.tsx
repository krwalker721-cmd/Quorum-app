"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LibraryTab from "./LibraryTab";
import NotesTab from "./NotesTab";
import CommunityWisdomTab from "./CommunityWisdomTab";
import VaultUpgradeNudge from "./VaultUpgradeNudge";
import NoGrid from "@/components/ui/NoGrid";
import { TabPill, TabPillRow } from "@/components/ui/TabPill";
import ui from "@/components/ui/sleek.module.css";
import type { NoteRow, NoteCollectionRow } from "@/lib/vault";

export type LibraryItem = {
  id: string;
  item_type: "pulse_post" | "cohort_post" | "project";
  item_id: string;
  personal_note: string | null;
  created_at: string;
  original: {
    id: string;
    kind: "pulse_post" | "cohort_post" | "project";
    content: string;
    title: string | null;
    author: { id: string; full_name: string | null; stage: string | null; username: string | null } | null;
    created_at: string;
    tag: string | null;
    is_anonymous: boolean;
  } | null;
};

export type WisdomItem = {
  id: string;
  post_id: string;
  approved_at: string;
  nomination_reason: string | null;
  post: {
    content: string;
    tag: string | null;
    reply_count: number;
    author: { id: string; full_name: string | null; stage: string | null; username: string | null } | null;
    created_at: string;
  };
  nominator: { id: string; full_name: string | null; stage: string | null; username: string | null } | null;
};

type Tab = "library" | "notes" | "community_wisdom";

const TABS: { id: Tab; label: string }[] = [
  { id: "library", label: "Library" },
  { id: "notes", label: "Notes" },
  { id: "community_wisdom", label: "Community wisdom" },
];

export default function VaultPage({
  currentUserId,
  initialTab,
  stats,
  library,
  notes,
  collections,
  wisdom,
  topRepliedPulse,
  pulseRecent,
}: {
  currentUserId: string;
  initialTab: Tab;
  stats: { savedByCommunity: number; notesWritten: number; wisdomPreserved: number };
  library: LibraryItem[];
  notes: NoteRow[];
  collections: NoteCollectionRow[];
  wisdom: WisdomItem[];
  topRepliedPulse: {
    id: string;
    content: string;
    tag: string | null;
    reply_count: number;
    author: any;
    created_at: string;
  }[];
  pulseRecent: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [liveStats, setLiveStats] = useState(stats);
  const [livePulseRecent, setLivePulseRecent] = useState(pulseRecent);

  // sync tab  URL
  useEffect(() => {
    const params = new URLSearchParams(Array.from(sp?.entries() ?? []));
    if (tab === "library") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(`/vault${qs ? `?${qs}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Live stat updates via realtime — every relevant insert nudges the count.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("vault:stats")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "saved_items" }, () =>
        setLiveStats((s) => ({ ...s, savedByCommunity: s.savedByCommunity + 1 })),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "saved_items" }, () =>
        setLiveStats((s) => ({ ...s, savedByCommunity: Math.max(0, s.savedByCommunity - 1) })),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes" }, () =>
        setLiveStats((s) => ({ ...s, notesWritten: s.notesWritten + 1 })),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_wisdom" }, () =>
        setLiveStats((s) => ({ ...s, wisdomPreserved: s.wisdomPreserved + 1 })),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: "post_type=eq.pulse" },
        () => setLivePulseRecent((n) => n + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div
      className={"page-pad"}
      style={{ padding: "18px 26px 22px", maxWidth: 1120, margin: "0 auto" }}
    >
      <NoGrid />
      <header style={{ marginBottom: 20 }}>
        <h1
          className={ui.titleGradient}
          style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
        >
          Vault
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
          Save what matters, write what you think, and keep what the community learns.
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          {liveStats.savedByCommunity} saved · {liveStats.notesWritten}{" "}
          {liveStats.notesWritten === 1 ? "note" : "notes"} · {liveStats.wisdomPreserved} in
          community wisdom
        </p>
      </header>

      <TabPillRow>
        {TABS.map((t) => (
          <TabPill sleek key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </TabPill>
        ))}
      </TabPillRow>

      <div style={{ marginTop: 20 }}>
        {tab === "library" && <LibraryTab items={library} />}
        {tab === "notes" && (
          <NotesTab
            currentUserId={currentUserId}
            initialNotes={notes}
            initialCollections={collections}
          />
        )}
        {tab === "community_wisdom" && (
          <CommunityWisdomTab
            items={wisdom}
            topRepliedPulse={topRepliedPulse}
            pulseRecent={livePulseRecent}
          />
        )}
      </div>

      {/* Nudge for accounts with no live entitlement; hidden for paid and trial. */}
      <VaultUpgradeNudge />
    </div>
  );
}
