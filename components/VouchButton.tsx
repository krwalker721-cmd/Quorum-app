"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ui from "@/components/ui/sleek.module.css";

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
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={active}
      className={ui.ghostBtn}
      style={
        active
          ? { color: "#4ade80", borderColor: "rgba(34, 197, 94, 0.4)", background: "rgba(34, 197, 94, 0.08)" }
          : undefined
      }
      title={active ? "You vouched for them. Click to take it back." : "Vouch for them"}
    >
      {active ? "Vouched ✓" : "Vouch"}
    </button>
  );
}
