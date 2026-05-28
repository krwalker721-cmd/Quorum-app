"use client";

import { useEffect } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";

type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
  what_they_are_building?: string | null;
};

export default function SkillPanel({
  entry,
  onlineIds,
  onClose,
}: {
  entry: { skill: string; members: Member[] };
  onlineIds?: Set<string>;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
      />
      {/* Slide-in panel */}
      <aside
        className="absolute top-0 right-0 h-full w-full max-w-md flex flex-col"
        style={{
          background: "var(--card-elev)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
          animation: "skill-panel-in 220ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <h2 className="font-sans text-text-primary text-2xl lowercase truncate">
              {entry.skill.toLowerCase()}
            </h2>
            <p className="font-mono lowercase text-[0.65rem] text-text-faint mt-1">
              {entry.members.length} founder{entry.members.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            className="font-mono text-text-faint hover:text-text-primary text-lg leading-none px-2 py-1"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-2">
          {entry.members.length === 0 ? (
            <p className="font-mono lowercase text-xs text-text-faint">no founders yet.</p>
          ) : (
            entry.members.map((m) => {
              const online = onlineIds?.has(m.id) ?? false;
              return (
                <div
                  key={m.id}
                  className="flex items-start gap-3 p-3 border"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                >
                  <div className="relative shrink-0">
                    <Avatar name={m.full_name} stage={m.stage} username={m.username} size={40} />
                    {online && (
                      <span
                        aria-label="online"
                        className="absolute bottom-0 right-0 block rounded-full"
                        style={{
                          width: 9,
                          height: 9,
                          background: "#22c55e",
                          border: "2px solid var(--card)",
                        }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={m.username ? `/profile/${m.username}` : "#"}
                        className="font-mono lowercase text-xs text-text-primary truncate hover:underline"
                      >
                        {m.full_name?.toLowerCase() ?? "—"}
                      </Link>
                      <StagePill stage={m.stage} />
                    </div>
                    {m.what_they_are_building && (
                      <p className="text-text-secondary text-xs mt-1.5 leading-snug">
                        {m.what_they_are_building}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/messages?to=${m.id}`}
                    className="font-mono lowercase text-[0.65rem] px-3 py-1 hover:opacity-90 self-center shrink-0"
                    style={{
                      background: "rgba(245, 158, 11, 0.18)",
                      color: "#f59e0b",
                      border: "1px solid rgba(245, 158, 11, 0.55)",
                      borderRadius: 5,
                      boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)",
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                    }}
                  >
                    dm →
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </aside>
      <style jsx>{`
        @keyframes skill-panel-in {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
