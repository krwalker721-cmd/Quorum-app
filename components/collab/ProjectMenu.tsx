"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

export default function ProjectMenu({
  projectId,
  itemLabel,
  onDeleted,
}: {
  projectId: string;
  itemLabel: "project" | "need";
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function doDelete() {
    const supabase = createClient();
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (!error) {
      setConfirm(false);
      onDeleted?.();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`${itemLabel} actions`}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1 rounded-md text-text-muted hover:text-text-primary"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 min-w-[180px] p-1"
          style={{
            background: "var(--card-elev)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 10,
            boxShadow: "0 16px 40px -12px rgba(0, 0, 0, 0.6)",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setConfirm(true);
            }}
            className="block w-full text-left px-3 py-2 rounded-md hover:bg-white/5"
            style={{ fontSize: 12, color: "#f87171" }}
          >
            Delete {itemLabel}
          </button>
        </div>
      )}
      {confirm && (
        <ConfirmDeleteModal
          itemLabel={itemLabel}
          onConfirm={doDelete}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
