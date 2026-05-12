"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  if (isMember) {
    return <span className="font-mono lowercase text-[0.65rem] text-green">member</span>;
  }

  if (status === "pending") {
    return <span className="font-mono lowercase text-[0.65rem] text-text-faint">requested</span>;
  }
  if (status === "approved") {
    return <span className="font-mono lowercase text-[0.65rem] text-green">approved</span>;
  }
  if (status === "declined") {
    return <span className="font-mono lowercase text-[0.65rem] text-red-400">declined</span>;
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
      setErr(error.message.toLowerCase());
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={request}
        disabled={busy}
        className="font-mono lowercase text-[0.65rem] px-3 py-1.5 bg-amber text-black hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
      >
        {busy ? "..." : "request to join"}
      </button>
      {err && <p className="font-mono lowercase text-[0.6rem] text-red-400">{err}</p>}
    </div>
  );
}
