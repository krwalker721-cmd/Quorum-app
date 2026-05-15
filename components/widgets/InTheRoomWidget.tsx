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
      className="p-4 border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
    >
      <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
        in_the_room
      </p>
      <InTheRoomGrid members={members} max={12} size={24} showCount />
    </div>
  );
}
