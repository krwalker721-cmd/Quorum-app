"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ApproveButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body.error ?? "failed").toString().toLowerCase());
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={approve}
        disabled={isPending}
        className="font-mono lowercase text-xs px-4 py-2 bg-green text-bg hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
      >
        {isPending ? "..." : "approve"}
      </button>
      {error && <p className="font-mono text-xs text-red-400 lowercase">{error}</p>}
    </div>
  );
}
