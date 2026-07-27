"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ActionChapter } from "./actionChapter";
import { Stagger, StaggerItem } from "./flair";
import {
  C,
  MONO,
  SANS,
  hexToRgba,
  STAGE_COLORS,
  darkInput,
  darkTextarea,
  AmberButton,
  SkipLink,
  CardHeader,
  FieldLabel,
} from "./theme";

const STAGES = [
  { value: "idea", label: "idea" },
  { value: "pre-seed", label: "pre-seed" },
  { value: "seed", label: "seed" },
  { value: "series_a", label: "series a" },
];

// How the founder answers "what are you building?". Not everyone has one clean
// answer — some run several things, some are still looking for the thing.
type BuildMode = "one" | "many" | "exploring";

const BUILD_MODES: { value: BuildMode; label: string }[] = [
  { value: "one", label: "one thing" },
  { value: "many", label: "more than one" },
  { value: "exploring", label: "nothing specific yet" },
];

const EXPLORING_TEXT = "exploring — not building anything specific yet";

// Split a stored full_name back into the two fields. Everything after the first
// space is the last name, so "Ada King Lovelace" round-trips intact.
function splitName(full: string | null): { first: string; last: string } {
  const trimmed = (full ?? "").trim();
  if (!trimmed) return { first: "", last: "" };
  const i = trimmed.indexOf(" ");
  if (i === -1) return { first: trimmed, last: "" };
  return { first: trimmed.slice(0, i), last: trimmed.slice(i + 1).trim() };
}

// Chapter 7 — the profile action card. Prefilled from whatever signup already
// captured (name, what they're building, stage) so the founder confirms rather
// than retypes. Best-effort write to profiles; advancing the flow always wins
// over a failed save.
export function ChapterProfile({
  onComplete,
  onIdentity,
}: {
  onComplete: () => void;
  onIdentity?: (d: { name: string | null; stage: string | null }) => void;
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [buildMode, setBuildMode] = useState<BuildMode>("one");
  const [ventures, setVentures] = useState<string[]>([""]);
  const [stage, setStage] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Prefill from the existing profile row. Signup already collected full name,
  // what they're building and stage — asking for it a second time reads as the
  // app not paying attention.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("full_name, what_they_are_building, stage, bio")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled || !data) return;

        const { first: f, last: l } = splitName(data.full_name as string | null);
        if (f) setFirst(f);
        if (l) setLast(l);
        if (data.stage) setStage(data.stage as string);
        if (data.bio) setBio(data.bio as string);

        const building = ((data.what_they_are_building as string | null) ?? "").trim();
        if (building === EXPLORING_TEXT) {
          setBuildMode("exploring");
        } else if (building.includes(" · ")) {
          setBuildMode("many");
          setVentures(building.split(" · ").map((s) => s.trim()).filter(Boolean));
        } else if (building) {
          setVentures([building]);
        }
      } catch {
        // best-effort — an empty form is still a usable form
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The single string we persist to profiles.what_they_are_building.
  function buildingValue(): string {
    if (buildMode === "exploring") return EXPLORING_TEXT;
    const filled = ventures.map((v) => v.trim()).filter(Boolean);
    return filled.join(" · ");
  }

  function setVenture(i: number, value: string) {
    setVentures((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  function addVenture() {
    setVentures((prev) => (prev.length >= 4 ? prev : [...prev, ""]));
  }

  function removeVenture(i: number) {
    setVentures((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function chooseMode(mode: BuildMode) {
    setBuildMode(mode);
    // Coming back to "one" collapses to the first entry; "more than one" opens a
    // second row so the choice immediately does something visible.
    if (mode === "one") setVentures((prev) => [prev[0] ?? ""]);
    if (mode === "many") setVentures((prev) => (prev.length > 1 ? prev : [prev[0] ?? "", ""]));
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const payload: Record<string, unknown> = {};
        const fullName = `${first.trim()} ${last.trim()}`.trim();
        const building = buildingValue();
        if (fullName) payload.full_name = fullName;
        if (building) payload.what_they_are_building = building;
        if (stage) payload.stage = stage;
        if (bio.trim()) payload.bio = bio.trim();
        if (Object.keys(payload).length > 0) {
          await supabase.from("profiles").update(payload).eq("id", user.id);
        }
      }
    } catch {
      // best-effort — advancing matters more than the write succeeding
    }
    const fullName = `${first.trim()} ${last.trim()}`.trim();
    onIdentity?.({ name: fullName || null, stage: stage || null });
    onComplete();
  }

  return (
    <ActionChapter
      id="chapter-7"
      label="your profile"
      context="// first — let your cohort know who you are"
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: 28,
          boxSizing: "border-box",
        }}
      >
        <CardHeader>// build your profile</CardHeader>

        {loaded && (first || ventures[0] || stage) && (
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: C.textMuted,
              letterSpacing: "0.06em",
              marginTop: -12,
              marginBottom: 20,
            }}
          >
            // pulled in from your signup — edit anything that&rsquo;s changed
          </div>
        )}

        <Stagger style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <StaggerItem style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>first name</FieldLabel>
              <input
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                placeholder="your first name"
                style={darkInput}
              />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>last name</FieldLabel>
              <input
                value={last}
                onChange={(e) => setLast(e.target.value)}
                placeholder="your last name"
                style={darkInput}
              />
            </div>
          </StaggerItem>

          <StaggerItem>
            <FieldLabel>what are you building?</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {BUILD_MODES.map((m) => {
                const active = buildMode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => chooseMode(m.value)}
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      padding: "7px 14px",
                      borderRadius: 4,
                      cursor: "pointer",
                      border: `1px solid ${active ? C.amber : C.border}`,
                      color: active ? C.amber : C.textSecondary,
                      background: active ? hexToRgba(C.amber, 0.06) : C.surface,
                      transition: "all 150ms ease",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {buildMode === "exploring" ? (
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: 13,
                  color: C.textSecondary,
                  lineHeight: 1.6,
                  margin: 0,
                  padding: "10px 14px",
                  borderLeft: `2px solid ${C.border}`,
                }}
              >
                That&rsquo;s a real answer. Plenty of founders here joined between things —
                your cohort is a good place to figure out the next one.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ventures.map((v, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={v}
                      onChange={(e) => setVenture(i, e.target.value)}
                      placeholder={
                        i === 0
                          ? "e.g. a platform for founders..."
                          : "and what else are you building?"
                      }
                      style={darkInput}
                    />
                    {buildMode === "many" && ventures.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVenture(i)}
                        aria-label="remove"
                        style={{
                          fontFamily: MONO,
                          fontSize: 14,
                          lineHeight: 1,
                          background: "transparent",
                          border: `1px solid ${C.border}`,
                          borderRadius: 4,
                          color: C.textDisabled,
                          padding: "11px 12px",
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {buildMode === "many" && ventures.length < 4 && (
                  <button
                    type="button"
                    onClick={addVenture}
                    style={{
                      alignSelf: "flex-start",
                      fontFamily: MONO,
                      fontSize: 11,
                      background: "transparent",
                      border: "none",
                      color: C.textMuted,
                      cursor: "pointer",
                      padding: "2px 0",
                    }}
                  >
                    + add another
                  </button>
                )}
              </div>
            )}
          </StaggerItem>

          <StaggerItem>
            <FieldLabel>stage</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {STAGES.map((s) => {
                const active = stage === s.value;
                const color = STAGE_COLORS[s.value] ?? C.amber;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStage(active ? "" : s.value)}
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      padding: "8px 16px",
                      borderRadius: 4,
                      cursor: "pointer",
                      border: `1px solid ${active ? color : C.border}`,
                      color: active ? color : C.textSecondary,
                      background: active ? hexToRgba(color, 0.06) : C.surface,
                      transition: "all 150ms ease",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </StaggerItem>

          <StaggerItem>
            <FieldLabel>one line bio</FieldLabel>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. ex-engineer turned founder, building the tool I always needed..."
              style={{ ...darkTextarea, minHeight: 72 }}
            />
          </StaggerItem>
        </Stagger>

        <div style={{ marginTop: 24 }}>
          <AmberButton onClick={save} disabled={saving}>
            That&rsquo;s me →
          </AmberButton>
          <SkipLink onClick={onComplete}>fill in later →</SkipLink>
        </div>
      </div>
    </ActionChapter>
  );
}
