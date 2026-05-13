"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VouchButton({
  vouchedForId,
  alreadyVouched,
}: {
  vouchedForId: string;
  alreadyVouched: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(alreadyVouched);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const method = active ? "DELETE" : "POST";
    const res = await fetch("/api/vouches", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vouched_for_id: vouchedForId }),
    });
    setBusy(false);
    if (res.ok) {
      setActive(!active);
      router.refresh();
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="font-mono lowercase text-[0.7rem] px-3 py-2 transition-colors disabled:opacity-50 whitespace-nowrap"
      style={{
        border: `1px solid ${active ? "#22c55e" : "var(--border)"}`,
        color: active ? "#22c55e" : "var(--text-muted)",
        background: active ? "rgba(34,197,94,0.06)" : "transparent",
      }}
      title={active ? "you vouched for them" : "vouch for them"}
    >
      {active ? "◉ vouched" : "◉ vouch"}
    </button>
  );
}
