export default function LockedCollabBoard() {
  return (
    <div className="relative" style={{ minHeight: "calc(100vh - 60px)" }}>
      {/* Blurred preview behind */}
      <div
        aria-hidden
        className="absolute inset-0 select-none pointer-events-none"
        style={{ filter: "blur(14px)", opacity: 0.55 }}
      >
        <div className="px-6 py-6 space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 border"
              style={{ background: "var(--card-elev)", borderColor: "var(--border-amber)" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full" style={{ background: "var(--card)" }} />
                <div className="h-3 w-32" style={{ background: "var(--card)" }} />
              </div>
              <div className="h-4 w-2/3 mb-3" style={{ background: "var(--card)" }} />
              <div className="h-3 w-full mb-2" style={{ background: "var(--card)" }} />
              <div className="h-3 w-5/6" style={{ background: "var(--card)" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Lock overlay */}
      <div
        className="absolute inset-0 flex items-center justify-center px-6"
        style={{ background: "rgba(0,0,0,0.55)" }}
      >
        <div
          className="max-w-md w-full text-center p-8 border"
          style={{ background: "var(--card-elev)", borderColor: "rgba(232, 112, 42,0.4)" }}
        >
          <p className="font-mono lowercase text-[0.65rem] text-text-faint">tier_2 exclusive</p>
          <h2 className="font-sans text-2xl text-text-primary mt-2 lowercase">collab_board</h2>
          <p className="text-text-muted text-sm mt-4 leading-relaxed">
            the collab board is where founders post projects, find collaborators, and run shared rooms with shared docs and decisions.
          </p>
          <p className="font-mono lowercase text-[0.7rem] text-text-faint mt-6">
            upgrade to tier_2 to unlock
          </p>
          <button
            className="font-mono lowercase text-xs px-4 py-2 mt-4 hover:opacity-90"
            style={{ background: "rgba(232, 112, 42, 0.18)", color: "#e8702a", border: "1px solid rgba(232, 112, 42, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(232, 112, 42, 0.2), inset 0 0 8px rgba(232, 112, 42, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
            disabled
          >
            upgrade â†’
          </button>
        </div>
      </div>
    </div>
  );
}
