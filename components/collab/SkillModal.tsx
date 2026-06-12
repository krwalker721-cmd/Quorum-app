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
          className="flex items-center justify-between px-6 py-5 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <p className="modal-kicker">skill</p>
            <h2 className="font-sans text-text-primary text-2xl lowercase truncate mt-0.5">
              {entry.skill.toLowerCase()}
            </h2>
            <p className="font-mono lowercase text-[0.65rem] text-text-faint mt-1">
              {entry.members.length} founder{entry.members.length === 1 ? "" : "s"}
            </p>
          </div>
          <button onClick={onClose} aria-label="close" className="modal-close-btn">
            esc
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5 space-y-2.5">
          {entry.members.length === 0 ? (
            <div className="empty-panel compact">
              <p className="empty-panel-title">no founders yet.</p>
              <p className="empty-panel-sub">add this skill to your profile and you&apos;ll show up here.</p>
            </div>
          ) : (
            entry.members.map((m) => {
              const online = onlineIds?.has(m.id) ?? false;
              return (
                <div
                  key={m.id}
                  className="flex items-start gap-3 p-3.5 border rounded-xl"
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
                    className="btn-primary self-center shrink-0"
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
