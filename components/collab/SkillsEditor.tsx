"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ui from "@/components/ui/sleek.module.css";

export default function SkillsEditor({
  userId,
  skills: initial,
}: {
  userId: string;
  skills: string[];
}) {
  const router = useRouter();
  const [skills, setSkills] = useState<string[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function persist(next: string[]) {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ skills: next })
      .eq("id", userId);
    return error;
  }

  async function add() {
    // Stored lowercase so the collab board's skills index groups them.
    const skill = text.trim().toLowerCase();
    if (!skill) return;
    if (skills.includes(skill)) {
      setText("");
      return;
    }
    setBusy(true);
    const next = [...skills, skill];
    const err = await persist(next);
    setBusy(false);
    if (!err) {
      setSkills(next);
      setText("");
      router.refresh();
    }
  }

  async function remove(skill: string) {
    const next = skills.filter((s) => s !== skill);
    setSkills(next);
    await persist(next);
    router.refresh();
  }

  return (
    <div>
      {skills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <span key={s} className={`${ui.chip} ${ui.chipAmber} inline-flex items-center gap-1.5`}>
              {s}
              <button
                type="button"
                onClick={() => remove(s)}
                className="hover:text-text-primary"
                aria-label={`Remove ${s}`}
                style={{ lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className={ui.emptySub} style={{ marginTop: 0 }}>
          Add what you can help with. It puts you in the collab board&apos;s skills index.
        </p>
      )}
      <div className="flex gap-2" style={{ marginTop: 12 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a skill (e.g. react, fundraising)"
          aria-label="Add a skill"
          className={`${ui.search} flex-1 min-w-0`}
          style={{ fontSize: 13, padding: "7px 12px" }}
        />
        <button type="button" onClick={add} disabled={busy || !text.trim()} className={ui.softBtn}>
          Add
        </button>
      </div>
    </div>
  );
}
