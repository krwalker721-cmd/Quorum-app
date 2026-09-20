"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import ui from "@/components/ui/sleek.module.css";
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
        role="dialog"
        aria-label={`Applications for ${needTitle}`}
        className={`absolute top-0 right-0 h-full w-full max-w-md flex flex-col ${ui.panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={`flex items-start justify-between gap-3 px-6 py-5 shrink-0 ${ui.panelHead}`}>
          <div className="min-w-0">
            <p className={ui.label}>Applications</p>
            <h2
              className="truncate"
              style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--text-primary)", marginTop: 2 }}
            >
              {needTitle}
            </h2>
            {!loading && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                {rows.length} {rows.length === 1 ? "applicant" : "applicants"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={ui.ghostBtn}
            style={{ padding: "5px 10px", fontSize: 11.5 }}
          >
            Esc
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5 space-y-2.5">
          {loading ? (
            <p className={ui.emptySub}>Loading…</p>
          ) : rows.length === 0 ? (
            <div className={ui.empty}>
              <p className={ui.emptyTitle}>No applicants yet.</p>
              <p className={ui.emptySub}>When someone responds to this need, it shows up here.</p>
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className={ui.tile} style={{ padding: 14 }}>
                <div className="flex items-center gap-3">
                  <Avatar
                    name={r.applicant?.full_name}
                    stage={r.applicant?.stage}
                    username={r.applicant?.username}
                    size={34}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                      {r.applicant?.full_name ?? "—"}
                    </p>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{timeAgo(r.created_at)} ago</p>
                  </div>
                  {r.applicant?.id && (
                    <Link href={`/messages?to=${r.applicant.id}`} className={`${ui.softBtn} shrink-0`}>
                      Message
                    </Link>
                  )}
                </div>
                <p
                  className="whitespace-pre-wrap"
                  style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)", marginTop: 10 }}
                >
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
