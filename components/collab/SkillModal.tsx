"use client";

import { useEffect } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";
import ui from "@/components/ui/sleek.module.css";

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

  const n = entry.members.length;

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
        role="dialog"
        aria-label={`Founders with ${entry.skill}`}
        className={`absolute top-0 right-0 h-full w-full max-w-md flex flex-col ${ui.panel}`}
        style={{ animation: "skill-panel-in 220ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={`flex items-start justify-between gap-3 px-6 py-5 shrink-0 ${ui.panelHead}`}>
          <div className="min-w-0">
            <p className={ui.label}>Skill</p>
            <h2
              className="truncate"
              style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", marginTop: 2 }}
            >
              {entry.skill}
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {n} {n === 1 ? "founder" : "founders"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={ui.ghostBtn}
            style={{ padding: "5px 10px", fontSize: 11.5 }}
          >
            Esc
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5 space-y-2.5">
          {n === 0 ? (
            <div className={ui.empty}>
              <p className={ui.emptyTitle}>No founders yet.</p>
              <p className={ui.emptySub}>Add this skill to your profile and you&apos;ll show up here.</p>
            </div>
          ) : (
            entry.members.map((m) => {
              const online = onlineIds?.has(m.id) ?? false;
              return (
                <div key={m.id} className={`${ui.tile} flex items-start gap-3`} style={{ padding: 12 }}>
                  <div className="relative shrink-0">
                    <Avatar name={m.full_name} stage={m.stage} username={m.username} size={34} />
                    {online && (
                      <span
                        aria-label="online"
                        className="absolute bottom-0 right-0 block rounded-full"
                        style={{
                          width: 9,
                          height: 9,
                          background: "#22c55e",
                          border: "2px solid var(--bg-surface)",
                        }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={m.username ? `/profile/${m.username}` : "#"}
                        className="truncate hover:underline"
                        style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}
                      >
                        {m.full_name ?? "—"}
                      </Link>
                      <StagePill sleek stage={m.stage} />
                    </div>
                    {m.what_they_are_building && (
                      <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-secondary)", marginTop: 4 }}>
                        {m.what_they_are_building}
                      </p>
                    )}
                  </div>
                  <Link href={`/messages?to=${m.id}`} className={`${ui.softBtn} self-center shrink-0`}>
                    Message
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
