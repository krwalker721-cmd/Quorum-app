"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Event = { kind: "post" | "reply"; tag: string | null; username: string | null; at: number };

export default function ActivityTicker({ initialEvents }: { initialEvents: Event[] }) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pulse:ticker")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: "post_type=eq.pulse" },
        async (payload) => {
          const row = payload.new as any;
          const { data: author } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", row.author_id)
            .single();
          setEvents((prev) =>
            [
              {
                kind: "post" as const,
                tag: row.room_type ?? row.tag ?? null,
                username: author?.username ?? null,
                at: Date.now(),
              },
              ...prev,
            ].slice(0, 20),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_replies" },
        async (payload) => {
          const row = payload.new as any;
          const { data: author } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", row.author_id)
            .single();
          const { data: post } = await supabase
            .from("posts")
            .select("room_type, tag, post_type")
            .eq("id", row.post_id)
            .single();
          if (post?.post_type !== "pulse") return;
          setEvents((prev) =>
            [
              {
                kind: "reply" as const,
                tag: post?.room_type ?? post?.tag ?? null,
                username: author?.username ?? null,
                at: Date.now(),
              },
              ...prev,
            ].slice(0, 20),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // rotate every 4s
  useEffect(() => {
    if (events.length === 0) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % events.length);
    }, 4000);
    return () => clearInterval(t);
  }, [events.length]);

  // Filter to last 10 minutes
  const recent = events.filter((e) => Date.now() - e.at < 10 * 60_000);

  if (recent.length === 0) {
    return (
      <p className="font-mono lowercase text-[0.75rem] text-text-faint">
        the room is quiet right now — say something true.
      </p>
    );
  }

  const e = recent[idx % recent.length];
  let line = "";
  if (e.kind === "post") {
    line = e.tag ? `new ${e.tag} post just landed` : "someone just posted to the room";
  } else {
    line = e.username
      ? `${e.username} replied to a ${e.tag ?? "pulse"} post`
      : `someone replied to a ${e.tag ?? "pulse"} post`;
  }

  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="w-2 h-2 rounded-full pulse-amber-dot shrink-0" />
      <p
        key={`${e.at}-${idx}`}
        className="font-mono lowercase text-[0.75rem] text-text-secondary pulse-ticker-line truncate"
      >
        {line}
      </p>
    </div>
  );
}
