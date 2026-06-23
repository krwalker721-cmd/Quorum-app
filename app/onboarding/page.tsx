"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/stage";
import {
  C,
  MONO,
  SANS,
  hexToRgba,
  stageLabel,
  STAGE_COLORS,
  TYPE_COLORS,
  darkInput,
  darkTextarea,
  Reveal,
  Section,
  ContextLine,
  AmberButton,
  SkipLink,
  CardHeader,
  FieldLabel,
} from "@/components/onboarding-v2/theme";
import { useScrollReveal } from "@/components/onboarding-v2/useScrollReveal";

// Stripe ships only when a user actually scrolls to the pricing section.
const PricingSection = dynamic(
  () => import("@/components/onboarding-v2/PricingSection"),
  { ssr: false },
);

// ─── Shared keyframes (bounce for the scroll cue) ────────────────────────────
const GLOBAL_KEYFRAMES = `
@keyframes ob-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
`;

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — THE QUESTION
// ═══════════════════════════════════════════════════════════════════════════
const QUESTION =
  "Have you ever wanted a room full of founders who have the same mindset as you — and have already solved the problems you're about to face?";

function Section1Question() {
  const words = useMemo(() => QUESTION.split(" "), []);
  const [shown, setShown] = useState(false);
  // phase: "ask" (bubbles available) → "reply" (quorum responds) → "scroll"
  const [phase, setPhase] = useState<"ask" | "reply" | "scroll">("ask");
  const [showBubbles, setShowBubbles] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShown(true), 100);
    // Reveal the reply bubbles once the words have finished landing.
    const total = 100 + words.length * 80 + 600;
    const t2 = setTimeout(() => setShowBubbles(true), total);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [words.length]);

  function reply() {
    setPhase("reply");
    // Quorum's "then keep scrolling" lingers, then the scroll cue appears.
    setTimeout(() => setPhase("scroll"), 1600);
  }

  const userBubble = (text: string, delay: number) => (
    <div
      role="button"
      tabIndex={0}
      onClick={reply}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && reply()}
      style={{
        alignSelf: "flex-end",
        background: hexToRgba(C.amber, 0.08),
        border: `1px solid ${hexToRgba(C.amber, 0.2)}`,
        borderRadius: "12px 4px 4px 12px",
        padding: "12px 18px",
        fontFamily: SANS,
        fontSize: 14,
        color: C.textPrimary,
        cursor: "pointer",
        maxWidth: 320,
        opacity: showBubbles ? 1 : 0,
        transform: showBubbles ? "scale(1)" : "scale(0.95)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
        transitionDelay: `${delay}ms`,
      }}
    >
      {text}
    </div>
  );

  return (
    <Section id="section-1">
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <p
          style={{
            fontFamily: SANS,
            fontSize: 28,
            fontWeight: 500,
            color: C.textPrimary,
            lineHeight: 1.5,
            textAlign: "center",
            margin: 0,
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "0.28em",
                opacity: shown ? 1 : 0,
                transform: shown ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 0.5s ease, transform 0.5s ease",
                transitionDelay: `${i * 80}ms`,
              }}
            >
              {w}
            </span>
          ))}
        </p>

        {/* Conversation */}
        <div
          style={{
            width: "100%",
            maxWidth: 360,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minHeight: 120,
          }}
        >
          {phase === "ask" && (
            <>
              {userBubble("That's exactly what I've been missing", 0)}
              {userBubble("Tell me more", 400)}
            </>
          )}

          {phase !== "ask" && (
            <div
              style={{
                alignSelf: "flex-start",
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: "4px 12px 12px 4px",
                padding: "12px 18px",
                fontFamily: SANS,
                fontSize: 14,
                color: C.textSecondary,
                maxWidth: 320,
                opacity: 1,
                transform: "scale(1)",
                transition: "opacity 0.4s ease, transform 0.4s ease",
              }}
            >
              Then keep scrolling.
            </div>
          )}
        </div>

        {phase === "scroll" && (
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: C.textDisabled,
              letterSpacing: "0.1em",
              textAlign: "center",
              animation: "ob-bounce 1.5s infinite",
            }}
          >
            scroll ↓
          </div>
        )}
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — THE BAR GRAPH
// ═══════════════════════════════════════════════════════════════════════════
function Section2BarGraph() {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>(0.4);
  return (
    <Section id="section-2">
      <div ref={ref} style={{ width: 300, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 32 }}>
          {["with a network", "without"].map((l) => (
            <span
              key={l}
              style={{
                width: 80,
                fontFamily: MONO,
                fontSize: 10,
                color: C.textDisabled,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {l}
            </span>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            gap: 32,
            height: 200,
            marginTop: 16,
            marginBottom: 0,
          }}
        >
          <div
            style={{
              width: 80,
              height: isVisible ? 180 : 0,
              background: "linear-gradient(to top, #f59e0b, rgba(245,158,11,0.4))",
              borderRadius: "4px 4px 0 0",
              transition: "height 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
          <div
            style={{
              width: 80,
              height: isVisible ? 70 : 0,
              background: "linear-gradient(to top, #30363d, rgba(48,54,61,0.4))",
              borderRadius: "4px 4px 0 0",
              transition: "height 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
            }}
          />
        </div>
        <div style={{ height: 1, background: C.border, width: "100%" }} />

        <Reveal delay={1400} threshold={0.4}>
          <p
            style={{
              fontFamily: SANS,
              fontSize: 18,
              fontWeight: 500,
              color: C.textPrimary,
              maxWidth: 400,
              margin: "24px auto 0",
            }}
          >
            Founders with strong peer networks grow 2-3x faster.
          </p>
        </Reveal>
        <Reveal delay={1600} threshold={0.4}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 9,
              color: C.textDisabled,
              letterSpacing: "0.06em",
              marginTop: 8,
            }}
          >
            // source: Enterprise Nation / multiple peer group studies
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTIONS 3-5 — TEXT MOMENTS
// ═══════════════════════════════════════════════════════════════════════════
function TextMoment({
  id,
  children,
  size,
  weight,
  color,
  maxWidth,
  min = "60vh",
}: {
  id?: string;
  children: React.ReactNode;
  size: number;
  weight: number;
  color: string;
  maxWidth: number;
  min?: string;
}) {
  return (
    <Section id={id} min={min}>
      <Reveal>
        <p
          style={{
            fontFamily: SANS,
            fontSize: size,
            fontWeight: weight,
            color,
            textAlign: "center",
            maxWidth,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {children}
        </p>
      </Reveal>
    </Section>
  );
}

function Section5Introduction() {
  return (
    <>
      <Section id="section-5" min="50vh">
        <Reveal>
          <p
            style={{
              fontFamily: SANS,
              fontSize: 26,
              fontWeight: 600,
              color: C.textPrimary,
              textAlign: "center",
              maxWidth: 560,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            That&rsquo;s Quorum. 12 founders. Same drive as you. Already where you want to be.
          </p>
        </Reveal>
      </Section>
      <Section min="50vh">
        <Reveal>
          <p
            style={{
              fontFamily: SANS,
              fontSize: 20,
              fontWeight: 400,
              color: C.textSecondary,
              textAlign: "center",
              maxWidth: 480,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Find your people. Get real advice. Build together. All in one place.
          </p>
        </Reveal>
      </Section>
      <Section min="50vh">
        <Reveal>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 16,
                fontWeight: 500,
                color: C.amber,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              // now let&rsquo;s do this
            </div>
            <Reveal delay={600}>
              <div
                style={{
                  height: 1,
                  width: 200,
                  background: C.border,
                  margin: "28px auto 0",
                }}
              />
            </Reveal>
          </div>
        </Reveal>
      </Section>
    </>
  );
}

// ─── Card shell shared by the action sections ────────────────────────────────
function ActionCard({ children }: { children: React.ReactNode }) {
  return (
    <Reveal variant="card" style={{ width: "100%", maxWidth: 520 }}>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: 28,
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </Reveal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — PROFILE
// ═══════════════════════════════════════════════════════════════════════════
const STAGES = [
  { value: "idea", label: "idea" },
  { value: "pre-seed", label: "pre-seed" },
  { value: "seed", label: "seed" },
  { value: "series_a", label: "series a" },
];

function Section6Profile({ onComplete }: { onComplete: () => void }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [building, setBuilding] = useState("");
  const [stage, setStage] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

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
        if (fullName) payload.full_name = fullName;
        if (building.trim()) payload.what_they_are_building = building.trim();
        if (stage) payload.stage = stage;
        if (Object.keys(payload).length > 0) {
          await supabase.from("profiles").update(payload).eq("id", user.id);
        }
      }
    } catch {
      // best-effort — advancing matters more than the write succeeding
    }
    onComplete();
  }

  return (
    <Section id="section-6" min="auto" style={{ gap: 32 }}>
      <ContextLine>// first — let your cohort know who you are</ContextLine>
      <ActionCard>
        <CardHeader>// build your profile</CardHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 16 }}>
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
          </div>

          <div>
            <FieldLabel>what are you building?</FieldLabel>
            <input
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              placeholder="e.g. a platform for founders..."
              style={darkInput}
            />
          </div>

          <div>
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
          </div>

          <div>
            <FieldLabel>one line bio</FieldLabel>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. ex-engineer turned founder, building the tool I always needed..."
              style={{ ...darkTextarea, minHeight: 72 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <AmberButton onClick={save} disabled={saving}>
            That&rsquo;s me →
          </AmberButton>
          <SkipLink onClick={onComplete}>fill in later →</SkipLink>
        </div>
      </ActionCard>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7 — SKILLS
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_SKILLS = [
  "fundraising", "product", "growth", "sales", "marketing", "engineering", "design",
  "hiring", "operations", "finance", "legal", "partnerships", "go-to-market", "brand",
  "content", "community", "ai/ml", "b2b saas", "consumer", "hardware",
];

function Section7Skills({ onComplete }: { onComplete: () => void }) {
  const [extra, setExtra] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  const allSkills = [...DEFAULT_SKILLS, ...extra];
  const count = selected.size;

  function toggle(skill: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  }

  function addCustom() {
    const s = custom.trim().toLowerCase();
    if (!s) return;
    if (!allSkills.includes(s)) setExtra((prev) => [...prev, s]);
    setSelected((prev) => new Set(prev).add(s));
    setCustom("");
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && selected.size > 0) {
        await supabase.from("profiles").update({ skills: Array.from(selected) }).eq("id", user.id);
      }
    } catch {
      // best-effort
    }
    onComplete();
  }

  return (
    <Section id="section-7" min="auto" style={{ gap: 32 }}>
      <ContextLine>// what do you bring to this room?</ContextLine>
      <ActionCard>
        <CardHeader>// your strengths</CardHeader>
        <div
          style={{
            background: C.surface,
            borderLeft: `2px solid ${C.amber}`,
            padding: "10px 14px",
            borderRadius: "0 4px 4px 0",
            fontFamily: SANS,
            fontSize: 13,
            color: C.textSecondary,
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          The best connections here are built on knowing what each other is good at.
        </div>

        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: count > 0 ? C.amber : C.textDisabled,
            letterSpacing: "0.06em",
            marginBottom: 14,
          }}
        >
          {count} selected
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allSkills.map((skill) => {
            const active = selected.has(skill);
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggle(skill)}
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  padding: "8px 14px",
                  borderRadius: 4,
                  cursor: "pointer",
                  border: `1px solid ${active ? C.amber : C.border}`,
                  background: active ? hexToRgba(C.amber, 0.06) : C.surface,
                  color: active ? C.amber : C.textSecondary,
                  transition: "all 150ms ease",
                }}
              >
                {skill}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="add your own skill..."
            style={{ ...darkInput, flex: 1 }}
          />
          <button
            type="button"
            onClick={addCustom}
            style={{
              fontFamily: MONO,
              fontSize: 12,
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.textSecondary,
              padding: "10px 16px",
              borderRadius: 4,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + add
          </button>
        </div>

        <div style={{ marginTop: 24 }}>
          <AmberButton onClick={save} disabled={saving}>
            These are my strengths →
          </AmberButton>
          <SkipLink onClick={onComplete}>skip for now →</SkipLink>
        </div>
      </ActionCard>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8 — COHORT REVEAL
// ═══════════════════════════════════════════════════════════════════════════
export interface CohortMember {
  id: string;
  full_name: string | null;
  stage: string | null;
  building: string | null;
}
export interface CohortData {
  members: CohortMember[];
  memberCount: number;
  cohortName: string | null;
}

function Avatar({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: "50%",
        border: `1.5px solid ${color}`,
        background: hexToRgba(color, 0.12),
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: MONO,
        fontSize: 12,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}

function StagePill({ stage }: { stage: string | null }) {
  const color = stage ? STAGE_COLORS[stage] ?? C.textMuted : C.textMuted;
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9,
        padding: "3px 8px",
        borderRadius: 3,
        border: `1px solid ${hexToRgba(color, 0.3)}`,
        background: hexToRgba(color, 0.06),
        color,
        whiteSpace: "nowrap",
      }}
    >
      {stageLabel(stage)}
    </span>
  );
}

function Section8Cohort({
  cohort,
  onComplete,
}: {
  cohort: CohortData | null;
  onComplete: () => void;
}) {
  const memberCount = cohort?.memberCount ?? 0;
  const isPopulated = memberCount >= 3;
  const fillPct = Math.min(100, (memberCount / 12) * 100);

  return (
    <Section id="section-8" min="auto" style={{ gap: 28 }}>
      <ContextLine color={C.amber}>// your room is ready</ContextLine>
      <Reveal>
        <h2
          style={{
            fontFamily: SANS,
            fontSize: 26,
            fontWeight: 500,
            color: C.textPrimary,
            textAlign: "center",
            margin: 0,
          }}
        >
          Meet your cohort.
        </h2>
      </Reveal>

      {isPopulated ? (
        <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Your card */}
          <Reveal variant="card">
            <div
              style={{
                background: hexToRgba(C.amber, 0.04),
                border: `1px solid ${C.amber}`,
                borderRadius: 4,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Avatar label="YO" color={C.amber} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.textPrimary }}>
                  You — just joined
                </div>
              </div>
              <span style={{ fontFamily: MONO, fontSize: 9, color: C.amber }}>// you</span>
            </div>
          </Reveal>

          {cohort?.members.map((m, i) => {
            const color = m.stage ? STAGE_COLORS[m.stage] ?? C.textMuted : C.textMuted;
            return (
              <Reveal key={m.id} variant="card" delay={(i + 1) * 100}>
                <div
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <Avatar label={initials(m.full_name)} color={color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: SANS,
                        fontSize: 13,
                        color: C.textPrimary,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.full_name ?? "founder"}
                    </div>
                    <div
                      style={{
                        fontFamily: SANS,
                        fontSize: 12,
                        color: C.textMuted,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.building ?? "—"}
                    </div>
                  </div>
                  <StagePill stage={m.stage} />
                </div>
              </Reveal>
            );
          })}
        </div>
      ) : (
        <Reveal variant="card" style={{ width: "100%", maxWidth: 520 }}>
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: 24,
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.amber, letterSpacing: "0.08em" }}>
              // cohort being curated
            </div>
            <p style={{ fontFamily: SANS, fontSize: 13, color: C.textSecondary, lineHeight: 1.6, margin: "12px 0 16px" }}>
              We&rsquo;re building your cohort around founders with the same mindset and stage. Expect
              your room to fill within 48 hours.
            </p>
            <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${fillPct}%`, background: C.amber }} />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.textDisabled, marginTop: 8 }}>
              {memberCount} / 12 — you&rsquo;re in
            </div>
          </div>
        </Reveal>
      )}

      <Reveal>
        <button
          type="button"
          onClick={onComplete}
          style={{
            background: C.amber,
            color: C.bg,
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.06em",
            padding: "14px 28px",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            display: "block",
            margin: "24px auto 0",
          }}
        >
          I&rsquo;m ready →
        </button>
      </Reveal>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9 — FIRST POST
// ═══════════════════════════════════════════════════════════════════════════
const POST_TYPES = ["decision", "question", "blocker", "win"] as const;
type PostType = (typeof POST_TYPES)[number];

function Section9FirstPost({
  cohortId,
  onComplete,
}: {
  cohortId: string | null;
  onComplete: () => void;
}) {
  const [type, setType] = useState<PostType>("decision");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          post_type: cohortId ? "cohort" : "pulse",
          ...(cohortId ? { cohort_id: cohortId } : {}),
          room_type: type,
          is_anonymous: false,
          local_hour: new Date().getHours(),
        }),
      });
    } catch {
      // best-effort
    }
    onComplete();
  }

  return (
    <Section id="section-9" min="auto" style={{ gap: 18 }}>
      <ContextLine color={C.amber}>// your cohort is waiting on this</ContextLine>
      <Reveal>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 14,
            color: C.textMuted,
            textAlign: "center",
            margin: "0 0 14px",
          }}
        >
          What&rsquo;s on your mind right now — post it to your cohort.
        </p>
      </Reveal>

      <Reveal variant="card" style={{ width: "100%", maxWidth: 520 }}>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderLeft: `2px solid ${C.amber}`,
            borderRadius: "0 4px 4px 0",
            padding: 20,
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {POST_TYPES.map((t) => {
              const active = type === t;
              const color = TYPE_COLORS[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    padding: "7px 14px",
                    borderRadius: 4,
                    cursor: "pointer",
                    border: `1px solid ${active ? color : C.border}`,
                    background: active ? hexToRgba(color, 0.06) : C.surface,
                    color: active ? color : C.textSecondary,
                    transition: "all 150ms ease",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="what's on your mind right now..."
            style={{ ...darkTextarea, minHeight: 120 }}
          />

          <div style={{ fontFamily: MONO, fontSize: 10, color: C.textDisabled, marginTop: 12 }}>
            // posting to your cohort
          </div>

          <div style={{ marginTop: 16 }}>
            <AmberButton onClick={submit} disabled={saving || !content.trim()}>
              Post to my cohort →
            </AmberButton>
            <SkipLink onClick={onComplete}>skip for now →</SkipLink>
          </div>

          <div style={{ fontFamily: MONO, fontSize: 9, color: C.borderMuted, marginTop: 14 }}>
            // only your cohort can see this
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10 — CHECK-IN
// ═══════════════════════════════════════════════════════════════════════════
function Section10Checkin({ onComplete }: { onComplete: () => void }) {
  const [shipped, setShipped] = useState("");
  const [focus, setFocus] = useState("");
  const [stuck, setStuck] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && (shipped.trim() || focus.trim() || stuck.trim())) {
        await supabase.from("check_ins").insert({
          user_id: user.id,
          weekly_win: shipped.trim() || null,
          decision: focus.trim() || null,
          blocker: stuck.trim() || null,
          is_anonymous: false,
        });
      }
    } catch {
      // best-effort
    }
    onComplete();
  }

  const blocks = [
    {
      accent: C.green,
      label: "what did you ship this week?",
      value: shipped,
      set: setShipped,
      placeholder: "e.g. shipped the landing page, closed two calls...",
    },
    {
      accent: C.amber,
      label: "what are you focused on next week?",
      value: focus,
      set: setFocus,
      placeholder: "e.g. hire first engineer, lock pricing...",
    },
    {
      accent: C.red,
      label: "where are you stuck?",
      value: stuck,
      set: setStuck,
      placeholder: "e.g. can't decide between two pricing models...",
    },
  ];

  return (
    <Section id="section-10" min="auto" style={{ gap: 18 }}>
      <ContextLine>// show up every week</ContextLine>
      <Reveal>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 14,
            color: C.textMuted,
            textAlign: "center",
            margin: "0 0 14px",
          }}
        >
          Three questions. Under 3 minutes. Every week.
        </p>
      </Reveal>

      <Reveal variant="card" style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {blocks.map((b) => (
            <div
              key={b.label}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderLeft: `2px solid ${b.accent}`,
                borderRadius: "0 4px 4px 0",
                padding: "14px 16px",
              }}
            >
              <FieldLabel>{b.label}</FieldLabel>
              <textarea
                value={b.value}
                onChange={(e) => b.set(e.target.value)}
                placeholder={b.placeholder}
                style={{ ...darkTextarea, minHeight: 60 }}
              />
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <AmberButton onClick={submit} disabled={saving}>
              Submit my check-in →
            </AmberButton>
            <SkipLink onClick={onComplete}>skip for now →</SkipLink>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11 — COLLAB BOARD PREVIEW
// ═══════════════════════════════════════════════════════════════════════════
const COLLAB_CARDS = [
  { tag: "// project", color: C.blue, title: "AI research tool", sub: "looking for a technical co-builder", cta: "join →" },
  { tag: "// need", color: C.purple, title: "need: brand designer", sub: "launching in 6 weeks, B2B experience", cta: "message →" },
  { tag: "// hiring", color: C.green, title: "first sales hire", sub: "seed stage, close and build process", cta: "connect →" },
];

function Section11Collab({ onComplete }: { onComplete: () => void }) {
  return (
    <Section id="section-11" min="auto" style={{ gap: 18 }}>
      <ContextLine color={C.amber}>// this is where work gets done</ContextLine>
      <Reveal>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 14,
            color: C.textMuted,
            textAlign: "center",
            margin: "0 0 14px",
          }}
        >
          Find co-builders. Post what you need. Hire from people you trust.
        </p>
      </Reveal>

      <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 8 }}>
        {COLLAB_CARDS.map((c, i) => (
          <Reveal key={c.title} variant="card" delay={i * 120}>
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderLeft: `2px solid ${c.color}`,
                borderRadius: "0 4px 4px 0",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: c.color, marginBottom: 4 }}>
                  {c.tag}
                </div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.textPrimary }}>{c.title}</div>
                <div style={{ fontFamily: SANS, fontSize: 12, color: C.textSecondary }}>{c.sub}</div>
              </div>
              <span style={{ fontFamily: MONO, fontSize: 10, color: c.color, whiteSpace: "nowrap" }}>
                {c.cta}
              </span>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <button
          type="button"
          onClick={onComplete}
          style={{
            background: C.amber,
            color: C.bg,
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.06em",
            padding: "14px 28px",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            display: "block",
            margin: "24px auto 0",
          }}
        >
          Explore the collab board →
        </button>
      </Reveal>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12 — JOURNEY SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
interface JourneyData {
  profile: { full_name: string | null; stage: string | null; building: string | null; skills: string[] | null } | null;
  cohortName: string | null;
  cohortMemberCount: number;
  firstPost: { content: string; room_type: string | null } | null;
  hasCheckin: boolean;
}

function Section12Summary() {
  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (active) setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, stage, what_they_are_building, skills")
          .eq("id", user.id)
          .maybeSingle();

        const { data: membership } = await supabase
          .from("cohort_members")
          .select("cohort_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        let cohortName: string | null = null;
        let cohortMemberCount = 0;
        if (membership?.cohort_id) {
          const { data: cohort } = await supabase
            .from("cohorts")
            .select("name")
            .eq("id", membership.cohort_id)
            .maybeSingle();
          cohortName = cohort?.name ?? null;
          const { count } = await supabase
            .from("cohort_members")
            .select("*", { count: "exact", head: true })
            .eq("cohort_id", membership.cohort_id);
          cohortMemberCount = count ?? 0;
        }

        const { data: firstPost } = await supabase
          .from("posts")
          .select("content, room_type")
          .eq("author_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        const { count: checkinCount } = await supabase
          .from("check_ins")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (!active) return;
        setData({
          profile: profile
            ? {
                full_name: profile.full_name ?? null,
                stage: profile.stage ?? null,
                building: profile.what_they_are_building ?? null,
                skills: (profile.skills as string[] | null) ?? null,
              }
            : null,
          cohortName,
          cohortMemberCount,
          firstPost: firstPost
            ? { content: firstPost.content, room_type: firstPost.room_type ?? null }
            : null,
          hasCheckin: (checkinCount ?? 0) > 0,
        });
      } catch {
        // best-effort
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const profile = data?.profile;
  const skills = profile?.skills ?? [];
  const postType = data?.firstPost?.room_type ?? "";
  const postColor = TYPE_COLORS[postType] ?? C.border;

  const cards: { key: string; node: React.ReactNode }[] = [
    {
      key: "profile",
      node: (
        <RecapCard accent={C.green}>
          <RecapTag color={C.green}>// profile</RecapTag>
          {profile?.full_name || profile?.building || profile?.stage ? (
            <>
              <RecapValue>{profile?.full_name || "Your profile"}</RecapValue>
              {profile?.stage && (
                <div style={{ marginTop: 6 }}>
                  <StagePill stage={profile.stage} />
                </div>
              )}
            </>
          ) : (
            <RecapMuted>// skipped</RecapMuted>
          )}
        </RecapCard>
      ),
    },
    {
      key: "skills",
      node: (
        <RecapCard accent={C.amber}>
          <RecapTag color={C.amber}>// skills</RecapTag>
          {skills.length > 0 ? (
            <>
              <RecapValue>
                {skills.length} skill{skills.length === 1 ? "" : "s"} listed
              </RecapValue>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {skills.slice(0, 3).map((s) => (
                  <SkillPill key={s}>{s}</SkillPill>
                ))}
              </div>
            </>
          ) : (
            <RecapMuted>// skipped</RecapMuted>
          )}
        </RecapCard>
      ),
    },
    {
      key: "cohort",
      node: (
        <RecapCard accent={C.blue}>
          <RecapTag color={C.blue}>// cohort</RecapTag>
          {data?.cohortName ? (
            <>
              <RecapValue>{data.cohortName}</RecapValue>
              <RecapSub>
                {data.cohortMemberCount} member{data.cohortMemberCount === 1 ? "" : "s"}
              </RecapSub>
            </>
          ) : (
            <RecapMuted>// being curated</RecapMuted>
          )}
        </RecapCard>
      ),
    },
    {
      key: "first-post",
      node: (
        <RecapCard accent={data?.firstPost ? postColor : C.border}>
          <RecapTag color={data?.firstPost ? postColor : C.textDisabled}>// first post</RecapTag>
          {data?.firstPost ? (
            <div style={{ fontFamily: SANS, fontSize: 12, color: C.textSecondary, lineHeight: 1.5, marginTop: 4 }}>
              {data.firstPost.content.length > 60
                ? `${data.firstPost.content.slice(0, 60)}...`
                : data.firstPost.content}
            </div>
          ) : (
            <RecapMuted>// skipped</RecapMuted>
          )}
        </RecapCard>
      ),
    },
    {
      key: "checkin",
      node: (
        <RecapCard accent={data?.hasCheckin ? C.green : C.border}>
          <RecapTag color={data?.hasCheckin ? C.green : C.textDisabled}>// check-in</RecapTag>
          <div style={{ fontFamily: SANS, fontSize: 13, color: data?.hasCheckin ? C.green : C.textDisabled, marginTop: 4 }}>
            {data?.hasCheckin ? "done" : "skipped"}
          </div>
        </RecapCard>
      ),
    },
    {
      key: "collab",
      node: (
        <RecapCard accent={C.purple}>
          <RecapTag color={C.purple}>// collab</RecapTag>
          <RecapValue>board explored</RecapValue>
        </RecapCard>
      ),
    },
  ];

  return (
    <Section id="section-12" min="auto" style={{ gap: 0 }}>
      <Reveal>
        <div style={{ height: 1, width: 200, background: C.border, margin: "0 auto 28px" }} />
      </Reveal>
      <ContextLine>// conclusion</ContextLine>
      <Reveal>
        <h2
          style={{
            fontFamily: SANS,
            fontSize: 28,
            fontWeight: 500,
            color: C.textPrimary,
            textAlign: "center",
            margin: "24px 0 8px",
          }}
        >
          Here&rsquo;s what you built.
        </h2>
        <p style={{ fontFamily: SANS, fontSize: 15, color: C.textSecondary, textAlign: "center", margin: "0 0 36px" }}>
          In the last few minutes you went from zero to ready.
        </p>
      </Reveal>

      <Reveal variant="card" style={{ width: "100%", maxWidth: 540 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, opacity: loading ? 0.5 : 1 }}>
          {cards.map((card) => (
            <div key={card.key}>{card.node}</div>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <div
          style={{
            background: hexToRgba(C.amber, 0.06),
            border: `1px solid ${hexToRgba(C.amber, 0.15)}`,
            borderRadius: 4,
            padding: "12px 20px",
            maxWidth: 540,
            margin: "24px auto 0",
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 11,
            color: C.amber,
          }}
        >
          // you&rsquo;re in. your cohort is waiting.
        </div>
      </Reveal>
    </Section>
  );
}

function RecapCard({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderLeft: `2px solid ${accent}`,
        borderRadius: "0 4px 4px 0",
        padding: 14,
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
function RecapTag({ color, children }: { color: string; children: React.ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 8, color, letterSpacing: "0.08em", marginBottom: 6 }}>{children}</div>;
}
function RecapValue({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: SANS, fontSize: 13, color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
}
function RecapSub({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: SANS, fontSize: 11, color: C.textSecondary, marginTop: 5 }}>{children}</div>;
}
function RecapMuted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 11, color: C.textDisabled, marginTop: 4 }}>{children}</div>;
}
function SkillPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 8, padding: "2px 6px", borderRadius: 2, background: C.border, color: C.textSecondary, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13 — REFERRAL SELL (three cinematic beats)
// ═══════════════════════════════════════════════════════════════════════════
const MILESTONES = [
  { count: "1 →", reward: "$10 off next month" },
  { count: "3 →", reward: "1 free month" },
  { count: "5 →", reward: "2 free months" },
  { count: "10 →", reward: "50% off 6 months" },
  { count: "25 →", reward: "free for a year" },
];

function RewardLadder({ lit }: { lit: boolean }) {
  return (
    <div style={{ width: 220, margin: "20px auto 0" }}>
      {MILESTONES.map((m) => (
        <div key={m.count} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              padding: "3px 8px",
              borderRadius: 3,
              flexShrink: 0,
              background: lit ? hexToRgba(C.amber, 0.1) : C.surface,
              border: `1px solid ${lit ? hexToRgba(C.amber, 0.2) : C.border}`,
              color: lit ? C.amber : C.textDisabled,
              transition: "all 250ms ease",
            }}
          >
            {m.count}
          </span>
          <span
            style={{
              fontFamily: SANS,
              fontSize: 11,
              color: lit ? C.textPrimary : C.textMuted,
              transition: "color 250ms ease",
            }}
          >
            {m.reward}
          </span>
        </div>
      ))}
    </div>
  );
}

function Section13ReferralSell() {
  return (
    <>
      <Section min="60vh" style={{ gap: 0 }}>
        <Reveal>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: C.amber,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 16,
              }}
            >
              // one more thing
            </div>
            <p style={{ fontFamily: SANS, fontSize: 22, color: C.textPrimary, maxWidth: 480, margin: 0, lineHeight: 1.5 }}>
              Refer a founder. Get rewarded. Make Quorum more accessible.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <RewardLadder lit={false} />
        </Reveal>
      </Section>

      <Section min="60vh" style={{ gap: 0 }}>
        <Reveal>
          <p style={{ fontFamily: SANS, fontSize: 20, color: C.textPrimary, textAlign: "center", maxWidth: 480, margin: 0, lineHeight: 1.5 }}>
            The more founders you bring, the less you pay.
          </p>
        </Reveal>
        <Reveal>
          <RewardLadder lit />
        </Reveal>
        <Reveal delay={300}>
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: "10px 14px",
              maxWidth: 240,
              margin: "16px auto 0",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDisabled, marginBottom: 4 }}>
              // monthly bonus
            </div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.textSecondary }}>
              5+ active referrals → $30 off every month
            </div>
          </div>
        </Reveal>
      </Section>

      <Section min="60vh" style={{ gap: 0 }}>
        <Reveal>
          <p style={{ fontFamily: SANS, fontSize: 18, color: C.textSecondary, textAlign: "center", maxWidth: 480, margin: 0, lineHeight: 1.5 }}>
            Your referral link unlocks once you&rsquo;ve settled in.
          </p>
        </Reveal>
        <Reveal>
          <div
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: "10px 14px",
              fontFamily: MONO,
              fontSize: 11,
              color: C.textDisabled,
              maxWidth: 280,
              margin: "16px auto",
              textAlign: "center",
            }}
          >
            quorum.app/signup?ref=••••••
          </div>
        </Reveal>
        <Reveal>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.textDisabled, textAlign: "center" }}>
            // complete your profile to activate
          </div>
        </Reveal>
      </Section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════
// Section ids align with the saved current_step for the action sections (6-11),
// so restoring a returning user is a direct lookup.
const STEP_TO_SECTION: Record<number, string> = {
  6: "section-6",
  7: "section-7",
  8: "section-8",
  9: "section-9",
  10: "section-10",
  11: "section-11",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [cohort, setCohort] = useState<CohortData | null>(null);
  const [cohortId, setCohortId] = useState<string | null>(null);
  const restored = useRef(false);

  // Mount: trial init (once), prefetch cohort, restore scroll position.
  useEffect(() => {
    let active = true;

    (async () => {
      // 1. Progress + trial init.
      try {
        const res = await fetch("/api/onboarding");
        if (res.ok) {
          const data = await res.json();
          if (!data.trial_initialized) {
            void fetch("/api/onboarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ trial_initialized: true }),
            });
            void fetch("/api/subscription/initialize", { method: "POST" });
          }
          // 3. Restore scroll position on return visits.
          if (!restored.current && typeof data.current_step === "number" && data.current_step > 1) {
            const target = STEP_TO_SECTION[data.current_step];
            if (target) {
              restored.current = true;
              setTimeout(() => {
                document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
              }, 400);
            }
          }
        }
      } catch {
        // best-effort
      }

      // 2. Prefetch cohort data so there's no loading state mid-scroll.
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: mine } = await supabase
          .from("cohort_members")
          .select("cohort_id")
          .eq("user_id", user.id);
        const myIds = (mine ?? []).map((r) => r.cohort_id).filter(Boolean) as string[];
        if (myIds.length === 0) {
          if (active) setCohort({ members: [], memberCount: 0, cohortName: null });
          return;
        }

        // Surface the most-populated cohort the user sits in.
        const { data: allRows } = await supabase
          .from("cohort_members")
          .select("user_id, cohort_id")
          .in("cohort_id", myIds);

        const byCohort = new Map<string, string[]>();
        for (const row of allRows ?? []) {
          if (!row.cohort_id) continue;
          const list = byCohort.get(row.cohort_id) ?? [];
          if (row.user_id) list.push(row.user_id);
          byCohort.set(row.cohort_id, list);
        }

        let chosenId = myIds[0];
        let chosenMembers = byCohort.get(chosenId) ?? [];
        for (const id of myIds) {
          const list = byCohort.get(id) ?? [];
          if (list.length > chosenMembers.length) {
            chosenId = id;
            chosenMembers = list;
          }
        }

        const { data: cohortRow } = await supabase
          .from("cohorts")
          .select("name")
          .eq("id", chosenId)
          .maybeSingle();

        const ids = Array.from(new Set(chosenMembers));
        const otherIds = ids.filter((id) => id !== user.id);
        let members: CohortMember[] = [];
        if (otherIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name, stage, what_they_are_building")
            .in("id", otherIds);
          members = (profs ?? []).map((p) => ({
            id: p.id,
            full_name: p.full_name,
            stage: p.stage,
            building: p.what_they_are_building,
          }));
        }

        if (!active) return;
        setCohortId(chosenId);
        setCohort({ members, memberCount: ids.length, cohortName: cohortRow?.name ?? null });
      } catch {
        if (active) setCohort({ members: [], memberCount: 0, cohortName: null });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Persist progress at a completion moment. Best-effort — local scroll never
  // blocks on the write.
  function markComplete(step: number) {
    void fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_step: step }),
    }).catch(() => {});
  }

  async function completeOnboarding(redirectTo: string) {
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, current_step: 18 }),
      });
    } catch {
      // best-effort — still route the user on
    }
    router.push(redirectTo);
  }

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        width: "100%",
        overflowX: "hidden",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <style>{GLOBAL_KEYFRAMES}</style>

      <Section1Question />
      <Section2BarGraph />

      <TextMoment id="section-3" size={22} weight={500} color={C.textSecondary} maxWidth={500}>
        This is what happens when founders stop figuring it out alone.
      </TextMoment>
      <TextMoment id="section-4" size={20} weight={400} color={C.textMuted} maxWidth={480}>
        Whatever you&rsquo;re building toward — you&rsquo;ll get there faster with the right people around you.
      </TextMoment>

      <Section5Introduction />

      <Section6Profile onComplete={() => markComplete(6)} />
      <Section7Skills onComplete={() => markComplete(7)} />
      <Section8Cohort cohort={cohort} onComplete={() => markComplete(8)} />
      <Section9FirstPost cohortId={cohortId} onComplete={() => markComplete(9)} />
      <Section10Checkin onComplete={() => markComplete(10)} />
      <Section11Collab onComplete={() => markComplete(11)} />

      <Section12Summary />
      <Section13ReferralSell />

      <Section id="section-14" min="100vh">
        <PricingSection onComplete={completeOnboarding} />
      </Section>
    </div>
  );
}
