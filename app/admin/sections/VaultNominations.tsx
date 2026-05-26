"use client";

import { useEffect, useState, useCallback } from "react";
import { adminFetch } from "../lib/api";
import { SectionShell } from "./Overview";

type Nom = {
  id: string;
  reason: string | null;
  status: string;
  created_at: string;
  post: any | null;
  author: any | null;
  nominator: any | null;
};

export default function VaultNominationsSection() {
  const [noms, setNoms] = useState<Nom[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/nominations");
      if (res.ok) {
        const json = await res.json();
        setNoms(json.nominations ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "approve" | "decline") {
    const res = await adminFetch("/api/admin/vault-nomination", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nomination_id: id, action }),
    });
    if (res.ok) load();
  }

  const pending = noms.filter((n) => n.status === "pending");
  const approved = noms.filter((n) => n.status === "approved");

  return (
    <SectionShell title="vault_nominations">
      {loading && noms.length === 0 ? (
        <p className="font-mono text-xs text-text-faint">loadingâ€¦</p>
      ) : noms.length === 0 ? (
        <p className="font-mono text-xs text-text-faint">no pending nominations</p>
      ) : (
        <div className="space-y-3">
          {pending.map((n) => (
            <NomCard key={n.id} n={n} onApprove={() => act(n.id, "approve")} onDecline={() => act(n.id, "decline")} />
          ))}
          {approved.length > 0 && (
            <>
              <p className="font-mono lowercase text-[0.65rem] text-text-faint mt-6 mb-2">vaulted</p>
              {approved.slice(0, 20).map((n) => (
                <NomCard key={n.id} n={n} vaulted />
              ))}
            </>
          )}
        </div>
      )}
    </SectionShell>
  );
}

function NomCard({
  n,
  vaulted,
  onApprove,
  onDecline,
}: {
  n: Nom;
  vaulted?: boolean;
  onApprove?: () => void;
  onDecline?: () => void;
}) {
  return (
    <div
      className="border p-5"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <p className="font-mono lowercase text-[0.6rem] text-text-faint mb-2">
            original post Â· {n.post?.is_anonymous ? "anonymous" : n.author?.full_name?.toLowerCase() ?? "â€”"}
            {n.post?.tag ? ` Â· ${n.post.tag}` : ""}
          </p>
          <p className="text-text-secondary text-sm whitespace-pre-wrap">
            {n.post?.content ?? "(post deleted)"}
          </p>
          <p className="font-mono lowercase text-[0.6rem] text-text-faint mt-4">
            nominated by {n.nominator?.full_name?.toLowerCase() ?? "â€”"}
          </p>
          {n.reason && (
            <p className="text-text-muted text-[0.85rem] mt-1 italic">"{n.reason}"</p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {vaulted ? (
            <span
              className="font-mono text-[0.6rem] lowercase px-2 py-1"
              style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
            >
              vaulted
            </span>
          ) : (
            <>
              <button
                onClick={onApprove}
                className="font-mono text-[0.65rem] lowercase px-3 py-1.5"
                style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
              >
                approve
              </button>
              <button
                onClick={onDecline}
                className="font-mono text-[0.65rem] lowercase px-3 py-1.5 border"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                decline
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
