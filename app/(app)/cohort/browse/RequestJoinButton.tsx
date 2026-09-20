"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ui from "@/components/ui/sleek.module.css";

const STATUS: Record<string, { label: string; color: string }> = {
  member: { label: "Member", color: "var(--green)" },
  pending: { label: "Requested", color: "var(--text-muted)" },
  approved: { label: "Approved", color: "var(--green)" },
  declined: { label: "Declined", color: "#f87171" },
};

export default function RequestJoinButton({
  cohortId,
  userId,
  isMember,
  status,
}: {
  cohortId: string;
  userId: string;
  isMember: boolean;
  status: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const shown = isMember ? STATUS.member : status ? STATUS[status] : null;
  if (shown) {
    return (
      <span className="shrink-0" style={{ fontSize: 12, color: shown.color }}>
        {shown.label}
      </span>
    );
  }

  async function request() {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("cohort_join_requests")
      .insert({ cohort_id: cohortId, user_id: userId });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button onClick={request} disabled={busy} className={ui.primaryBtn}>
        {busy ? "Requesting…" : "Request to join"}
      </button>
      {err && <p className="text-red-400" style={{ fontSize: 11.5 }}>{err}</p>}
    </div>
  );
}
