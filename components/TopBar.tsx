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
        background: "rgba(3, 2, 1, 0.60)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "0.5px solid rgba(232, 112, 42, 0.08)",
      }}
    >
      <div>
        <p className="font-mono lowercase text-[0.65rem] text-text-faint">/{title}</p>
        <h1 className="font-sans lowercase text-text-primary text-base">{title.replace(/_/g, " ")}</h1>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <span
          className="font-mono uppercase text-[0.6rem] tracking-wider px-2 py-1 border"
          style={{ borderColor: "#e8702a", color: "#e8702a", letterSpacing: "0.08em" }}
        >
          {tier}
        </span>
        <NewPostButton userId={userId} defaultPostType={defaultPostType} />
        <SignOutButton />
      </div>
    </div>
  );
}
