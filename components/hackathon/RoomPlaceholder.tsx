import Link from "next/link";
import TopBar from "@/components/TopBar";
import NoGrid from "@/components/ui/NoGrid";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";

/**
 * The team room and the lobby before their own prompts build them. The pages
 * that render this have already checked the viewer may be here.
 */
export default function RoomPlaceholder({
  number,
  title,
  line,
  tier,
  userId,
}: {
  number: number;
  title: string;
  line: string;
  tier: string;
  userId: string;
}) {
  return (
    <>
      <NoGrid />
      <TopBar sleek title="hackathon" tier={tier} userId={userId} />
      <div className="page-pad" style={{ padding: "18px 26px 48px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <Link href={`/hackathon/${number}`} style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
          ← Sprint #{number}
        </Link>
        <h1 className={ui.titleGradient} style={{ fontSize: 26, fontWeight: 650, letterSpacing: "-0.03em", marginTop: 12, marginBottom: 16 }}>
          {title}
        </h1>
        <Tile>
          <div className={ui.empty}>
            <p className={ui.emptyTitle}>{line}</p>
          </div>
        </Tile>
      </div>
    </>
  );
}
