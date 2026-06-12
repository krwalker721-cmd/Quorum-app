import ThemeToggle from "@/components/ThemeToggle";
import NewPostButton from "@/components/NewPostButton";
import SignOutButton from "@/components/SignOutButton";

// One quiet line of context per page so the topbar orients you instead of
// just naming the route. Falls back to nothing for unmapped pages.
const PAGE_CONTEXT: Record<string, string> = {
  home: "your week at a glance",
  cohort: "your private advisory board",
  messages: "direct lines to other founders",
  pulse: "every founder, one honest feed",
  vault: "what the community has learned",
  collab_board: "projects, asks, and skills",
  referrals: "bring in founders you trust",
};

export default function TopBar({
  title,
  tier,
  userId,
  defaultPostType,
}: {
  title: string;
  tier: string;
  userId: string;
  defaultPostType?: "cohort" | "pulse";
}) {
  const context = PAGE_CONTEXT[title];
  return (
    <div
      className="flex items-center justify-between px-6 sticky top-0 z-30"
      style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-default)",
        paddingTop: 14,
        paddingBottom: 14,
      }}
    >
      <div className="min-w-0">
        {/* Breadcrumb path — terminal-style, quorum is the root */}
        <p
          className="font-mono lowercase truncate"
          style={{ fontSize: 10, letterSpacing: "0.04em", color: "var(--text-muted)" }}
        >
          <span style={{ color: "var(--text-disabled)" }}>quorum</span>
          <span style={{ color: "var(--text-disabled)", margin: "0 4px" }}>/</span>
          <span style={{ color: "var(--text-secondary)" }}>{title}</span>
        </p>
        <div className="flex items-baseline gap-3 mt-0.5 min-w-0">
          <h1
            className="font-sans lowercase shrink-0"
            style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.2px" }}
          >
            {title.replace(/_/g, " ")}
          </h1>
          {context && (
            <span
              className="font-sans lowercase truncate hidden sm:inline"
              style={{ fontSize: 12, color: "var(--text-muted)" }}
            >
              {context}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 pl-4">
        <ThemeToggle />
        <span
          className="tier-badge font-mono uppercase tracking-wider"
          style={{ letterSpacing: "0.08em" }}
        >
          {tier}
        </span>
        <NewPostButton userId={userId} defaultPostType={defaultPostType} />
        <SignOutButton />
      </div>
    </div>
  );
}
