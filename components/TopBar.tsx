import ThemeToggle from "@/components/ThemeToggle";
import NewPostButton from "@/components/NewPostButton";
import SignOutButton from "@/components/SignOutButton";

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
  return (
    <div
      className="flex items-center justify-between px-6 py-3 sticky top-0 z-30"
      style={{
        background: "#161b22",
        borderBottom: "1px solid #21262d",
      }}
    >
      <div>
        <p className="font-mono lowercase text-[0.65rem] text-text-faint">/{title}</p>
        <h1 className="font-sans lowercase text-text-primary text-base">{title.replace(/_/g, " ")}</h1>
      </div>
      <div className="flex items-center gap-3">
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
