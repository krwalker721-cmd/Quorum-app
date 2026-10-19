"use client";

import { useRouter } from "next/navigation";
import ui from "@/components/ui/sleek.module.css";
import { rpc, useSprintAction } from "@/lib/hackathons/actions";

/** The invite link's one button: join the team (registering you if needed). */
export default function JoinByLink({ code, teamName, sprintNumber }: { code: string; teamName: string; sprintNumber: number }) {
  const router = useRouter();
  const { busy, error, run } = useSprintAction();
  return (
    <div className="flex flex-col items-start" style={{ gap: 8 }}>
      <button
        type="button"
        className={ui.primaryBtn}
        style={{ fontSize: 14, padding: "10px 18px" }}
        disabled={busy}
        onClick={() => run(() => rpc("hackathon_join_with_code", { p_code: code }), () => router.push(`/buildathon/${sprintNumber}`))}
      >
        Join {teamName}
      </button>
      {error && (
        <p role="alert" style={{ fontSize: 12.5, color: "#fca5a5" }}>
          {error}
        </p>
      )}
    </div>
  );
}
