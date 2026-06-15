"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingStepProps } from "./types";
import {
  C,
  Eyebrow,
  GhostButton,
  Heading,
  MONO,
  MonoHint,
  PrimaryButton,
  StepFrame,
  TYPE_COLORS,
  hexToRgba,
  textareaStyle,
} from "./ui";

const POST_TYPES = ["decision", "question", "blocker", "win"] as const;
type PostType = (typeof POST_TYPES)[number];

export default function Step11_FirstPost({
  onNext,
  onBack,
  currentStep,
  totalSteps,
  screen3Answer = "",
}: OnboardingStepProps) {
  const [type, setType] = useState<PostType>("decision");
  const [content, setContent] = useState(screen3Answer || "");
  const [prefilled] = useState(Boolean(screen3Answer));
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [cohortName, setCohortName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: mine } = await supabase
        .from("cohort_members")
        .select("cohort_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const cid = mine?.cohort_id ?? null;
      if (!active) return;
      setCohortId(cid);
      if (cid) {
        const { data: cohort } = await supabase.from("cohorts").select("name").eq("id", cid).maybeSingle();
        if (active) setCohortName(cohort?.name ?? null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const destination = cohortId ? (cohortName ? cohortName.toUpperCase() : "your cohort") : "PULSE";

  async function submit() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // decision/question/blocker/win are room_type values; post_type is the
        // destination. Cohort posts need a real cohort_id (RLS); otherwise the
        // post lands on the global pulse so it still succeeds.
        const payload: Record<string, unknown> = {
          author_id: user.id,
          content: content.trim(),
          room_type: type,
          is_anonymous: false,
          local_hour: new Date().getHours(),
        };
        if (cohortId) {
          payload.post_type = "cohort";
          payload.cohort_id = cohortId;
        } else {
          payload.post_type = "pulse";
        }
        await supabase.from("posts").insert(payload);
      }
    } catch {
      // best-effort
    }
    onNext();
  }

  return (
    <StepFrame currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}>
      <Eyebrow>// climax — your first post</Eyebrow>
      <Heading>Post your challenge to your cohort.</Heading>
      <MonoHint>// they&rsquo;ve been here before — let them help</MonoHint>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
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
                background: active ? hexToRgba(color, 0.08) : C.surface,
                color: active ? color : C.textSecondary,
                transition: "all 150ms ease",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div style={{ maxWidth: 520 }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="what's the hardest part of where you are right now..."
          style={{ ...textareaStyle, minHeight: 140 }}
        />
        {prefilled && (
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.textDisabled, marginTop: 6 }}>
            // pre-filled from your earlier answer
          </div>
        )}
      </div>

      <div style={{ fontFamily: MONO, fontSize: 10, color: C.textDisabled, marginTop: 14 }}>
        posting to {destination}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 20 }}>
        <PrimaryButton onClick={submit} disabled={saving || !content.trim()}>
          Post to my cohort →
        </PrimaryButton>
        <GhostButton onClick={onNext}>skip for now →</GhostButton>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 9, color: C.borderMuted, marginTop: 14 }}>
        // only your cohort can see this
      </div>
    </StepFrame>
  );
}
