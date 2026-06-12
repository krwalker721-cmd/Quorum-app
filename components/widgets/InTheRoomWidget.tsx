import InTheRoomGrid from "@/components/pulse/InTheRoomGrid";

type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
};

export default function InTheRoomWidget({ members }: { members: Member[] }) {
  return (
    <div
      className="side-widget"
      style={{ "--w-accent": "#22c55e" } as React.CSSProperties}
    >
      <div className="side-widget-head">
        <span className="side-widget-glyph" aria-hidden>●</span>
        <p className="side-widget-label">in_the_room</p>
        {members.length > 0 && <span className="side-widget-meta">{members.length}</span>}
      </div>
      <InTheRoomGrid members={members} max={12} size={24} showCount />
    </div>
  );
}
