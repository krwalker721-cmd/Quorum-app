import ThemeToggle from "@/components/ThemeToggle";
import NewPostButton from "@/components/NewPostButton";
import SignOutButton from "@/components/SignOutButton";
import TopBarTierLink from "@/components/TopBarTierLink";
import MobileNavButton from "@/components/MobileNavButton";
import ui from "@/components/ui/sleek.module.css";

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
  sleek = false,
}: {
  title: string;
  tier: string;
  userId: string;
  defaultPostType?: "cohort" | "pulse";
  /** Glass finish from the landing page (translucent + blur). Opt-in while it
   *  rolls out page by page (home first). */
  sleek?: boolean;
}) {
  const context = PAGE_CONTEXT[title];
  return (
    <div
      className={`app-topbar flex items-center justify-between px-6 sticky top-0 z-30 ${sleek ? ui.glass : ""}`}
      style={{
        // Fixed height so full-bleed pages (messages, cohort room) can size
        // themselves against a known chrome height. Keep in sync with
        // --topbar-h in globals.css.
        height: "var(--topbar-h, 64px)",
        ...(sleek
          ? {}
          : { background: "var(--bg-surface)", borderBottom: "1px solid var(--border-default)" }),
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
      <MobileNavButton />
      <div className="min-w-0">
        {/* Breadcrumb path — terminal-style, quorum is the root. Dropped in the
            sleek finish, where one clean title is enough. */}
        {!sleek && (
          <p
            className="font-mono uppercase truncate"
            style={{ fontSize: 9, lineHeight: 1.3, letterSpacing: "0.06em", color: "var(--text-muted)" }}
          >
            <span style={{ color: "var(--text-disabled)" }}>quorum</span>
            <span style={{ color: "var(--text-disabled)", margin: "0 4px" }}>/</span>
            <span style={{ color: "var(--text-secondary)" }}>{title.replace(/_/g, " ")}</span>
          </p>
        )}
        <div className={`flex items-baseline gap-3 min-w-0 ${sleek ? "" : "mt-0.5"}`}>
          <h1
            // Sleek titles give way (truncate) on narrow screens instead of
            // sliding under the post button.
            className={`font-sans ${sleek ? "capitalize min-w-0 truncate" : "shrink-0 lowercase"}`}
            style={{ fontSize: sleek ? 15 : 16, lineHeight: 1.3, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.2px" }}
          >
            {title.replace(/_/g, " ")}
          </h1>
          {context && (
            <span
              className="font-sans lowercase truncate hidden lg:inline"
              style={{ fontSize: 12, color: "var(--text-muted)" }}
            >
              {context}
            </span>
          )}
        </div>
      </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pl-4">
        {/* Secondary chrome collapses away first on narrow viewports */}
        <div className="hidden md:flex items-center gap-2">
          <TopBarTierLink tier={tier} />
          <ThemeToggle />
        </div>
        <NewPostButton userId={userId} defaultPostType={defaultPostType} />
        <SignOutButton />
      </div>
    </div>
  );
}
