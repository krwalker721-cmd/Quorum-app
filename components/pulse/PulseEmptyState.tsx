"use client";

import { useState } from "react";
import NewPostButton from "@/components/NewPostButton";

export default function PulseEmptyState({ userId }: { userId: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-6">
      <div style={{ opacity: 0.3 }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="22" stroke="#f59e0b" strokeWidth="1.5" fill="none">
            <animate attributeName="r" values="20;22;20" dur="3.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;1;0.6" dur="3.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="24" cy="24" r="6" fill="#f59e0b">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="3.5s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
      <div className="max-w-md space-y-2">
        <p className="lowercase text-[0.95rem] leading-relaxed" style={{ color: "#6e7681" }}>
          this is where the community speaks honestly.
        </p>
        <p className="lowercase text-[0.95rem] leading-relaxed" style={{ color: "#6e7681" }}>
          no performance. no highlights.
        </p>
        <p className="lowercase text-[0.95rem] leading-relaxed" style={{ color: "#6e7681" }}>
          just real founders, real problems, real wins.
        </p>
        <p className="lowercase text-[0.95rem] leading-relaxed pt-2" style={{ color: "#8b949e" }}>
          be the first to say something true.
        </p>
      </div>
      <div className="w-full max-w-md">
        <EmptyStateCTA userId={userId} />
      </div>
    </div>
  );
}

function EmptyStateCTA({ userId }: { userId: string }) {
  // Re-uses the NewPostButton modal — just styles the trigger to be the
  // big amber prominent button.
  return (
    <div className="flex justify-center [&_button:first-child]:!w-full [&_button:first-child]:!py-3 [&_button:first-child]:!px-6 [&_button:first-child]:!text-sm [&_button:first-child]:!rounded">
      <NewPostButton userId={userId} defaultPostType="pulse" />
    </div>
  );
}
