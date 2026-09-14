import Tile from "@/components/ui/Tile";
import InTheRoomGrid from "@/components/pulse/InTheRoomGrid";

type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
};

export default function InTheRoomWidget({ members }: { members: Member[] }) {
  return (
    <Tile
      kicker="In the room"
      right={members.length > 0 ? `${members.length} ${members.length === 1 ? "member" : "members"}` : undefined}
    >
      <InTheRoomGrid members={members} max={12} size={28} showCount />
    </Tile>
  );
}
