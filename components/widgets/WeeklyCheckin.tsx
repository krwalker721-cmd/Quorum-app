"use client";

import { useState } from "react";
import CheckinModal from "@/components/CheckinModal";

export default function WeeklyCheckin({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="side-widget"
        style={{ "--w-accent": "#f59e0b", borderColor: "var(--border-amber)" } as React.CSSProperties}
      >
        <div className="side-widget-head">
          <span className="side-widget-glyph" aria-hidden>◆</span>
          <p className="side-widget-label">weekly_checkin</p>
        </div>
        <p className="text-text-primary text-sm leading-relaxed">
          what&apos;s the one decision you&apos;ve been avoiding this week?
        </p>
        <button onClick={() => setOpen(true)} className="btn-primary mt-4 w-full">
          answer_prompt →
        </button>
      </div>
      <CheckinModal open={open} onClose={() => setOpen(false)} userId={userId} />
    </>
  );
}
