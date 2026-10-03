"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ui from "@/components/ui/sleek.module.css";
import { rpc } from "@/lib/hackathons/actions";

/** An invited judge accepts (hackathon_accept_judge_invite, migration 018). */
export default function AcceptJudgeInvite({ sprintId }: { sprintId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={ui.primaryBtn}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const { error: e } = await rpc("hackathon_accept_judge_invite", { p_hackathon_id: sprintId });
          if (e) {
            setError(e.message);
            setBusy(false);
            return;
          }
          router.refresh();
        }}
      >
        {busy ? "Accepting…" : "Accept and judge"}
      </button>
      {error && <span style={{ fontSize: 12, color: "#f87171" }}>{error}</span>}
    </span>
  );
}
