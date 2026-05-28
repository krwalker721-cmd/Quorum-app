"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/stage";

type ApplicantRow = {
  id: string;
  response: string;
  created_at: string;
  applicant: {
    id: string;
    full_name: string | null;
    stage: string | null;
    username: string | null;
  } | null;
};

export default function NeedApplicationsPanel({
  needId,
  needTitle,
  onClose,
}: {
  needId: string;
  needTitle: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ApplicantRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("need_applications")
        .select("id, response, created_at, applicant:profiles!need_applications_applicant_id_fkey(id, full_name, stage, username)")
        .eq("need_id", needId)
        .order("created_at", { ascending: false });
      setRows(((data ?? []) as any[]).map((r) => ({ ...r, applicant: r.applicant ?? null })));
      setLoading(false);
    })();
  }, [needId]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose} />
      <aside
        className="absolute top-0 right-0 h-full w-full max-w-md flex flex-col"
        style={{
          background: "var(--card-elev)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="flex items-start justify-between px-5 py-4 border-b shrink-0 gap-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <p className="font-mono lowercase text-[0.6rem] text-text-faint">applications</p>
            <h2 className="font-sans text-text-primary text-lg lowercase truncate">{needTitle}</h2>
            <p className="font-mono lowercase text-[0.6rem] text-text-faint mt-1">
              {rows.length} {rows.length === 1 ? "applicant" : "applicants"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            className="font-mono text-text-faint hover:text-text-primary text-lg leading-none px-2 py-1"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-3">
          {loading ? (
            <p className="font-mono lowercase text-xs text-text-faint">loading…</p>
          ) : rows.length === 0 ? (
            <p className="font-mono lowercase text-xs text-text-faint">no applicants yet.</p>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="p-3 border space-y-2"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={r.applicant?.full_name}
                    stage={r.applicant?.stage}
                    username={r.applicant?.username}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono lowercase text-xs text-text-primary truncate">
                      {r.applicant?.full_name?.toLowerCase() ?? "—"}
                    </p>
                    <p className="font-mono lowercase text-[0.6rem] text-text-faint">
                      {timeAgo(r.created_at)} ago
                    </p>
                  </div>
                  {r.applicant?.id && (
                    <Link
                      href={`/messages?to=${r.applicant.id}`}
                      className="font-mono lowercase text-[0.65rem] px-3 py-1 hover:opacity-90"
                      style={{
                        background: "rgba(245, 158, 11, 0.18)",
                        color: "#f59e0b",
                        border: "1px solid rgba(245, 158, 11, 0.55)",
                        borderRadius: 5,
                      }}
                    >
                      dm them →
                    </Link>
                  )}
                </div>
                <p className="text-text-secondary text-xs leading-relaxed whitespace-pre-wrap">
                  {r.response}
                </p>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
