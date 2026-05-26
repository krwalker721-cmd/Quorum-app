"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function VaultNominationActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function act(action: "approve" | "decline") {
    startTransition(async () => {
      await fetch("/api/admin/vault-nomination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomination_id: id, action }),
      });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() => act("decline")}
        className="font-mono lowercase text-xs px-3 py-1.5 border disabled:opacity-50"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        decline
      </button>
      <button
        disabled={pending}
        onClick={() => act("approve")}
        className="font-mono lowercase text-xs px-3 py-1.5 disabled:opacity-50"
        style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
      >
        approve
      </button>
    </div>
  );
}
