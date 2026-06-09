"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id: string;
  otherName: string | null;
  agreement: string | null;
  date: string | null;
};

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * recent_handshakes — last 3 handshakes involving the current user. RLS keeps
 * handshakes private to the two parties. Hidden entirely when the user has none.
 */
export default function RecentHandshakes({
  userId,
  username,
}: {
  userId: string;
  username: string | null;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: hs } = await supabase
        .from("handshakes")
        .select("id, initiator_id, recipient_id, agreement, date, created_at")
        .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("date", { ascending: false })
        .limit(3);

      const handshakes = hs ?? [];
      const otherIds = Array.from(
        new Set(
          handshakes.map((h: any) =>
            h.initiator_id === userId ? h.recipient_id : h.initiator_id,
          ),
        ),
      ).filter(Boolean) as string[];

      const { data: profiles } =
        otherIds.length > 0
          ? await supabase.from("profiles").select("id, full_name").in("id", otherIds)
          : { data: [] as any[] };
      const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

      if (cancelled) return;
      setRows(
        handshakes.map((h: any) => {
          const otherId = h.initiator_id === userId ? h.recipient_id : h.initiator_id;
          return {
            id: h.id,
            otherName: nameById.get(otherId) ?? null,
            agreement: h.agreement,
            date: h.date,
          };
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Hidden completely until loaded and only when there is at least one.
  if (!rows || rows.length === 0) return null;

  return (
    <div
      className="p-4 border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
    >
      <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-3">recent_handshakes</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-start gap-2">
            <span className="font-mono text-[0.8rem] shrink-0" style={{ color: "#f59e0b" }} aria-hidden>
              ◈
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono lowercase text-[0.7rem] text-text-primary truncate">
                  {r.otherName?.toLowerCase() ?? "—"}
                </span>
                <span className="font-mono lowercase text-[0.55rem] text-text-faint ml-auto shrink-0">
                  {r.date ? formatDate(r.date) : ""}
                </span>
              </div>
              {r.agreement && (
                <p className="font-mono lowercase text-[0.6rem] text-text-muted mt-0.5 leading-snug">
                  {truncate(r.agreement, 40)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {username && (
        <Link
          href={`/profile/${username}?tab=handshakes`}
          className="block text-right font-mono lowercase text-[0.65rem] mt-2 hover:underline"
          style={{ color: "#f59e0b" }}
        >
          view all →
        </Link>
      )}
    </div>
  );
}
