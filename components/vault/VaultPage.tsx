"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VaultHeader from "./VaultHeader";
import VaultStatStrip from "./VaultStatStrip";
import LibraryTab from "./LibraryTab";
import NotesTab from "./NotesTab";
import CommunityWisdomTab from "./CommunityWisdomTab";
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

  // sync tab â†’ URL
  useEffect(() => {
    const params = new URLSearchParams(Array.from(sp?.entries() ?? []));
    if (tab === "library") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(`/vault${qs ? `?${qs}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Live stat updates via realtime â€” every relevant insert nudges the count.
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
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <VaultHeader />
      <VaultStatStrip
        savedByCommunity={liveStats.savedByCommunity}
        notesWritten={liveStats.notesWritten}
        wisdomPreserved={liveStats.wisdomPreserved}
      />

      <Tabs tab={tab} setTab={setTab} />

      <div className="mt-6">
        {tab === "library" && (
          <LibraryTab
            items={library}
            currentUserId={currentUserId}
            communitySaved={liveStats.savedByCommunity}
          />
        )}
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
    </div>
  );
}

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const list: { id: Tab; label: string }[] = useMemo(
    () => [
      { id: "library", label: "library" },
      { id: "notes", label: "notes" },
      { id: "community_wisdom", label: "community_wisdom" },
    ],
    [],
  );
  return (
    <div className="flex items-center gap-2 mt-5 border-b" style={{ borderColor: "var(--border)" }}>
      {list.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="font-mono lowercase text-[0.72rem] px-3 py-2 transition-colors"
            style={{
              color: active ? "var(--text-primary)" : "var(--text-faint)",
              borderBottom: active ? "2px solid #e8702a" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
