import Tile from "@/components/ui/Tile";
import type { ArenaTeam, QueueData, Viewer } from "@/lib/hackathons/page";
import type { SprintRow } from "@/lib/hackathons/sprint";
import JoinQueueClient from "./JoinQueueClient";

/**
 * The join queue, while registration is open (Prompt 4). The anchor (#join)
 * is where a spectator's "Register" button lands.
 */
export default function JoinQueue({
  sprint,
  viewer,
  teams,
  queue,
  myBring = null,
}: {
  sprint: SprintRow;
  viewer: Viewer;
  teams: ArenaTeam[];
  queue: QueueData | null;
  /** What the viewer said they bring (037). */
  myBring?: string | null;
}) {
  return (
    <div id="join" style={{ scrollMarginTop: 80 }}>
      <Tile kicker="Join queue" style={{ marginBottom: 16 }}>
        {queue ? (
          <JoinQueueClient
            sprint={{ id: sprint.id, number: sprint.number, team_lock_at: sprint.team_lock_at, open: sprint.state === "registration" }}
            viewer={viewer}
            teams={teams}
            queue={queue}
            myBring={myBring}
          />
        ) : null}
      </Tile>
    </div>
  );
}
