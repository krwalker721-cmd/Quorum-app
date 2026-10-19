// The broad kind of skill someone lists (profiles.skills, the same data as
// the Collab Board's skills index). Mirrors private.skill_bucket in migration
// 026, which the matcher uses to balance teams, so the invite search's filters
// and the matcher agree on who counts as "technical".

export type SkillKind = "technical" | "design" | "business";

const TECHNICAL =
  /(engineer|develop|cod(e|ing)|program|software|back.?end|front.?end|full.?stack|devops|infra|data|machine learning|\bml\b|\bai\b|mobile|\bios\b|android|react|python|typescript|javascript|web3|blockchain|security|\bcto\b)/i;
const DESIGN = /(design|\bux\b|\bui\b|figma|brand|visual|illustrat|motion)/i;

export function skillKind(skills: string[] | null | undefined): SkillKind | null {
  if (!skills || skills.length === 0) return null;
  if (skills.some((s) => TECHNICAL.test(s))) return "technical";
  if (skills.some((s) => DESIGN.test(s))) return "design";
  return "business";
}
