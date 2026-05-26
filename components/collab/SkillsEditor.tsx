"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  async function add() {
    const skill = text.trim().toLowerCase();
    if (!skill) return;
    if (skills.includes(skill)) {
      setText("");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("user_skills").insert({ user_id: userId, skill });
    setBusy(false);
    if (!error) {
      setSkills([...skills, skill]);
      setText("");
      router.refresh();
    }
  }

  async function remove(skill: string) {
    const supabase = createClient();
    await supabase.from("user_skills").delete().eq("user_id", userId).eq("skill", skill);
    setSkills(skills.filter((s) => s !== skill));
    router.refresh();
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <span
            key={s}
            className="font-mono lowercase text-[0.7rem] px-2.5 py-1 flex items-center gap-2"
            style={{
              border: "1px solid rgba(245, 158, 11,0.35)",
              color: "#f59e0b",
              background: "rgba(245, 158, 11,0.06)",
            }}
          >
            {s.toLowerCase()}
            <button
              onClick={() => remove(s)}
              className="text-text-faint hover:text-text-primary"
              aria-label={`remove ${s}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="add a skill (e.g. react, fundraising)"
          className="flex-1 px-3 py-1.5 font-mono lowercase text-[0.7rem] text-text-primary"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        />
        <button
          onClick={add}
          disabled={busy || !text.trim()}
          className="font-mono lowercase text-[0.7rem] px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
          style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
        >
          add
        </button>
      </div>
    </div>
  );
}
