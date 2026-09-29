"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { sprintDb } from "@/lib/hackathons/actions";

// Keeps the join queue live while registration is open: any change to this
// Sprint's teams, memberships, registrations, requests or invitations that
// the viewer is allowed to see (realtime respects RLS) reloads the page's data,
// a second after the last one. Spectators can't see other people's
// registrations, so a slow timer catches the counts up for them.

const TABLES = [
  "hackathon_teams",
  "hackathon_team_members",
  "hackathon_registrations",
  "hackathon_team_join_requests",
  "hackathon_team_invitations",
];

export default function QueueLive({ sprintId }: { sprintId: string }) {
  const router = useRouter();

  useEffect(() => {
    const db = sprintDb();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 1000);
    };

    let channel = db.channel(`sprint-queue-${sprintId}`);
    for (const table of TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `hackathon_id=eq.${sprintId}` }, refresh);
    }
    channel.subscribe();

    const slow = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 45_000);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(slow);
      db.removeChannel(channel);
    };
  }, [sprintId, router]);

  return null;
}
