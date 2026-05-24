import Link from "next/link";
import { STAGE_COLOR, initials } from "@/lib/stage";

export default function Avatar({
  name,
  stage,
  size = 32,
  username,
  depthRing = false,
  anniversary = false,
}: {
  name?: string | null;
  stage?: string | null;
  size?: number;
  username?: string | null;
  // Quiet recognition flags. Default off â€” opt-in per caller.
  depthRing?: boolean;
  anniversary?: boolean;
}) {
  const ring = stage ? STAGE_COLOR[stage] ?? "#707070" : "#707070";

  const core = (
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

  const wrapped = (
    <span
      className="relative inline-block"
      style={{ width: size, height: size, lineHeight: 0 }}
    >
      {depthRing && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: `1px solid ${ring}`,
            opacity: 0.28,
            transform: `scale(${1 + 4 / size})`,
            transformOrigin: "center",
          }}
        />
      )}
      {core}
      {anniversary && (
        <span
          aria-hidden
          className="absolute"
          style={{
            width: Math.max(5, size * 0.18),
            height: Math.max(5, size * 0.18),
            borderRadius: "50%",
            background: "#e8702a",
            top: 0,
            right: 0,
            boxShadow: "0 0 0 1.5px var(--card)",
          }}
        />
      )}
    </span>
  );

  if (!username) return wrapped;
  return (
    <Link
      href={`/profile/${username}`}
      aria-label={`view ${name ?? "profile"}`}
      className="inline-block"
    >
      {wrapped}
    </Link>
  );
}
