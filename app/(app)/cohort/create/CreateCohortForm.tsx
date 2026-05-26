"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function CreateCohortForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cohorts")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        creator_id: userId,
        is_open: isOpen,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      setErr(error?.message?.toLowerCase() ?? "failed");
      return;
    }
    router.push("/cohort/browse");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="bg-card border border-border p-6 space-y-4">
      <div>
        <label>name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus />
      </div>
      <div>
        <label>description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={400}
          placeholder="what is this cohort for?"
        />
      </div>
      <div className="flex items-start gap-3 pt-1">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="relative shrink-0"
          style={{
            width: 34,
            height: 18,
            borderRadius: 9999,
            background: isOpen ? "#f59e0b" : "var(--border)",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: isOpen ? 18 : 2,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 150ms ease",
            }}
          />
        </button>
        <div className="text-[0.7rem] leading-snug">
          <p className="font-mono lowercase text-text-secondary">
            {isOpen ? "open Â· anyone can request to join" : "invite-only Â· join by invite link"}
          </p>
        </div>
      </div>

      {err && <p className="font-mono text-xs text-red-400 lowercase">{err}</p>}

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="btn-primary"
        >
          {busy ? "..." : "create â†’"}
        </button>
      </div>
    </form>
  );
}
