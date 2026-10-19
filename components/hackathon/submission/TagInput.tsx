"use client";

import { useState } from "react";
import ui from "@/components/ui/sleek.module.css";
import { LABEL_RESET, LIMITS } from "@/lib/hackathons/submission";

// "Built with": type a tool and press Enter or a comma. The database tidies
// them (lower case, no repeats); up to 20.
export default function TagInput({
  tags,
  disabled,
  onChange,
}: {
  tags: string[];
  disabled: boolean;
  onChange: (tags: string[]) => void;
}) {
  const [text, setText] = useState("");

  function add(raw: string) {
    const parts = raw
      .split(",")
      .map((t) => t.trim().toLowerCase().slice(0, LIMITS.tag))
      .filter(Boolean);
    const next = [...tags];
    for (const p of parts) if (!next.includes(p) && next.length < LIMITS.built_with) next.push(p);
    if (next.length !== tags.length) onChange(next);
    setText("");
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3" style={{ marginBottom: 10 }}>
        <label htmlFor="built-with" style={{ ...LABEL_RESET, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
          Built with
        </label>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          {tags.length} / {LIMITS.built_with}
        </span>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2" style={{ marginBottom: 10 }}>
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              className={`${ui.chip} ${ui.chipAmber}`}
              disabled={disabled}
              onClick={() => onChange(tags.filter((x) => x !== t))}
              aria-label={`Remove ${t}`}
            >
              {t}
              {!disabled && " ×"}
            </button>
          ))}
        </div>
      )}
      {!disabled && tags.length < LIMITS.built_with && (
        <input
          id="built-with"
          className={`${ui.search} w-full`}
          value={text}
          placeholder="next.js, supabase, figma… (Enter to add)"
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(",")) add(v);
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
        />
      )}
    </div>
  );
}
