import Tile from "@/components/ui/Tile";

// Shown when Pulse has no posts at all. The composer sits right above it, so
// this only sets the tone; it doesn't repeat the post button.
export default function PulseEmptyState() {
  return (
    <Tile padding="44px 28px">
      <div className="flex flex-col items-center text-center" style={{ gap: 18 }}>
        <svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden style={{ opacity: 0.5 }}>
          <circle cx="24" cy="24" r="22" stroke="#f59e0b" strokeWidth="1.5" fill="none">
            <animate attributeName="r" values="20;22;20" dur="3.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;1;0.6" dur="3.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="24" cy="24" r="6" fill="#f59e0b">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="3.5s" repeatCount="indefinite" />
          </circle>
        </svg>
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontSize: 14.5, color: "var(--text-primary)" }}>
            This is where founders speak honestly.
          </p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.6 }}>
            No performance, no highlight reels. Just real problems, real decisions, and real wins.
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>
            Be the first to say something true.
          </p>
        </div>
      </div>
    </Tile>
  );
}
