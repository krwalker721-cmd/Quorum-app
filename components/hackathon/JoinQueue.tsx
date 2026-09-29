import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import type { Viewer } from "@/lib/hackathons/page";

/**
 * The join queue: register, then the random pool or your own team.
 * PLACEHOLDER until Prompt 4, which replaces this file. The anchor (#join) is
 * where a spectator's "Register" button lands, so keep it.
 */
export default function JoinQueue({ viewer }: { viewer: Viewer }) {
  const registered = viewer.role === "participant";
  return (
    <div id="join" style={{ scrollMarginTop: 80 }}>
      <Tile kicker="Join queue" style={{ marginBottom: 16 }}>
        <div className={ui.empty}>
          {registered ? (
            <>
              <p className={ui.emptyTitle}>
                You're registered{viewer.mode === "team" ? " to build with your own team" : " in the random pool"}.
              </p>
              <p className={ui.emptySub}>Changing how you join, and finding a team, open here soon.</p>
            </>
          ) : viewer.role === "outsider" ? (
            <p className={ui.emptyTitle}>Registering needs an active membership.</p>
          ) : viewer.role === "judge" || viewer.role === "invited_judge" ? (
            <p className={ui.emptyTitle}>Judges can't compete in the Sprint they judge.</p>
          ) : (
            <>
              <p className={ui.emptyTitle}>Registration opens here soon.</p>
              <p className={ui.emptySub}>You'll choose the random pool, or start or join a team.</p>
            </>
          )}
        </div>
      </Tile>
    </div>
  );
}
