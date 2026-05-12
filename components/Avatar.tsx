import Link from "next/link";
import { STAGE_COLOR, initials } from "@/lib/stage";

export default function Avatar({
  name,
  stage,
  size = 32,
  username,
}: {
  name?: string | null;
  stage?: string | null;
  size?: number;
  username?: string | null;
}) {
  const ring = stage ? STAGE_COLOR[stage] ?? "#707070" : "#707070";
  const inner = (
    <div
      className="flex items-center justify-center font-mono lowercase font-medium"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `1.5px solid ${ring}`,
        background: "var(--card)",
        color: "var(--text-primary)",
        fontSize: size * 0.35,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );

  if (!username) return inner;
  return (
    <Link href={`/profile/${username}`} aria-label={`view ${name ?? "profile"}`} className="inline-block">
      {inner}
    </Link>
  );
}
