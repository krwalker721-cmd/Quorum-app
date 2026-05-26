"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type SavedItemType = "pulse_post" | "cohort_post" | "project";

let toastSeq = 0;
function showVaultToast() {
  if (typeof window === "undefined") return;
  const id = ++toastSeq;
  let host = document.getElementById("vault-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "vault-toast-host";
    host.style.cssText =
      "position:fixed;right:20px;bottom:20px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;pointer-events:none;";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "vault-toast";
  el.style.cssText = [
    "background:var(--card-elev)",
    "border:1px solid var(--border)",
    "border-left:2px solid #f59e0b",
    "color:var(--text-muted)",
    "padding:10px 14px",
    "font-family:var(--font-jetbrains-mono),ui-monospace,monospace",
    "font-size:0.7rem",
    "letter-spacing:0.04em",
    "text-transform:lowercase",
    "min-width:160px",
  ].join(";");
  el.textContent = "saved to vault";
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 240ms ease-out";
    el.style.opacity = "0";
    setTimeout(() => {
      if (el.parentElement === host) host!.removeChild(el);
    }, 280);
  }, 2000);
  return id;
}

export default function BookmarkButton({
  itemType,
  itemId,
  className,
  variant = "card-corner",
}: {
  itemType: SavedItemType;
  itemId: string;
  className?: string;
  variant?: "card-corner" | "inline";
}) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setSaved(false);
        return;
      }
      const { data } = await supabase
        .from("saved_items")
        .select("id")
        .eq("user_id", user.id)
        .eq("item_type", itemType)
        .eq("item_id", itemId)
        .maybeSingle();
      if (!cancelled) setSaved(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [itemType, itemId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy || saved === null) return;
    setBusy(true);
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch("/api/vault/save", {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item_type: itemType, item_id: itemId }),
      });
      if (!res.ok) throw new Error("save failed");
      if (next) showVaultToast();
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  }

  const color = saved ? "#f59e0b" : "#6e7681";
  const base =
    variant === "card-corner"
      ? "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1"
      : "p-1 inline-flex items-center";

  return (
    <button
      type="button"
      aria-label={saved ? "remove from vault" : "save to vault"}
      onClick={toggle}
      className={`${base} ${className ?? ""}`}
      style={{
        color,
        filter: saved
          ? "drop-shadow(0 0 4px rgba(245, 158, 11,0.6))"
          : undefined,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.filter =
          "drop-shadow(0 0 6px rgba(245, 158, 11,0.55))";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.filter = saved
          ? "drop-shadow(0 0 4px rgba(245, 158, 11,0.6))"
          : "";
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
