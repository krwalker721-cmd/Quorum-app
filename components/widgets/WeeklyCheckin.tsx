"use client";

import { useState } from "react";
import CheckinModal from "@/components/CheckinModal";

export default function WeeklyCheckin({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="p-4 border"
        style={{ background: "var(--card-elev)", borderColor: "var(--border-amber)" }}
      >
        <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
          weekly_checkin
        </p>
        <p className="text-text-secondary text-sm leading-relaxed">
          what&apos;s the one decision you&apos;ve been avoiding this week?
        </p>
        <button
          onClick={() => setOpen(true)}
          className="font-mono lowercase text-[0.7rem] text-amber mt-4 hover:underline"
        >
          answer_prompt →
        </button>
      </div>
      <CheckinModal open={open} onClose={() => setOpen(false)} userId={userId} />
    </>
  );
}
