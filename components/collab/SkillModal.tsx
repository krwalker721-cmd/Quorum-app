"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";

type Member = { id: string; full_name: string | null; stage: string | null; username: string | null };

export default function SkillModal({
  entry,
  onClose,
}: {
  entry: { skill: string; members: Member[] };
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg border p-6 space-y-4"
        style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-text-primary text-lg lowercase">{entry.skill.toLowerCase()}</h3>
          <button
            onClick={onClose}
            className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-primary"
          >
            close
          </button>
        </div>

        <p className="font-mono lowercase text-[0.7rem] text-text-faint">
          {entry.members.length} founder{entry.members.length === 1 ? "" : "s"} listed this
        </p>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {entry.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3 border"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <Avatar name={m.full_name} stage={m.stage} username={m.username} size={36} />
              <div className="min-w-0 flex-1">
                <p className="font-mono lowercase text-xs text-text-primary truncate">
                  {m.full_name?.toLowerCase() ?? "â€”"}
                </p>
                {m.stage && (
                  <p className="font-mono lowercase text-[0.6rem] text-text-faint">{m.stage}</p>
                )}
              </div>
              <Link
                href={`/messages?to=${m.id}`}
                className="font-mono lowercase text-[0.65rem] px-3 py-1 hover:opacity-90"
                style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
              >
                dm
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
