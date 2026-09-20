import Avatar from "@/components/Avatar";
import ui from "@/components/ui/sleek.module.css";

// Two cards from the collab board, rendered with the app's own classes
// (sleek.module.css) so what a visitor sees here is what the board actually
// looks like: same tile, same chips, same footer rule.
//
// It is an illustration, and it says so. The buttons are spans, not controls —
// nothing here pretends to be operable. The author is "you" rather than an
// invented founder, and there are no counts: a card with "14 interested" on it
// would be a number nobody earned. Sample titles only.

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <article className={ui.tile} style={{ padding: "18px 20px" }}>
      {children}
    </article>
  );
}

function AuthorLine({ action, chip }: { action: string; chip: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name="You" size={34} />
      <div className="min-w-0 flex items-center gap-x-1.5 gap-y-1 flex-wrap">
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>You</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{action}</span>
        <span className={ui.chip}>{chip}</span>
      </div>
    </div>
  );
}

const TITLE: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  lineHeight: 1.35,
  color: "var(--text-primary)",
  marginTop: 12,
};
const BODY: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "var(--text-secondary)",
  marginTop: 6,
};
const META: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)" };

export default function BoardPreview() {
  return (
    <figure className="m-0">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* A project: something you're building, open to people joining. */}
        <CardShell>
          <AuthorLine action="started a project · 2 days ago" chip="Product" />
          <h3 style={TITLE}>Rebuilding our signup flow</h3>
          <p style={BODY}>
            Cutting six steps down to two. The designs are done — I&rsquo;m looking for someone
            who&rsquo;s worked on activation to build it with me.
          </p>
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 12 }}>
            <span className={ui.chip}>react</span>
            <span className={ui.chip}>analytics</span>
          </div>
          <div className={`${ui.cardFoot} flex items-center justify-between gap-3 flex-wrap`}>
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap min-w-0" style={META}>
              <span className="inline-flex items-center gap-1.5" style={{ color: "var(--green)" }}>
                <span
                  aria-hidden
                  style={{ width: 7, height: 7, borderRadius: 999, background: "#22c55e", flexShrink: 0 }}
                />
                Open
              </span>
              <span>Looking for technical</span>
            </div>
            <span className={ui.softBtn} style={{ cursor: "default" }}>
              Open project →
            </span>
          </div>
        </CardShell>

        {/* An ask: help you need, answered by whoever has done it before. */}
        <CardShell>
          <AuthorLine action="needs help · 4 hours ago" chip="Quick ask" />
          <h3 style={TITLE}>Has anyone negotiated an enterprise MSA?</h3>
          <p style={BODY}>
            First contract with a customer this size and the redlines came back long. I need twenty
            minutes with someone who has been through one.
          </p>
          <div className={`${ui.cardFoot} flex items-center justify-between gap-3 flex-wrap`}>
            <span style={META}>Be the first to respond</span>
            <span className={ui.ghostBtn} style={{ cursor: "default" }}>
              View applications →
            </span>
          </div>
        </CardShell>
      </div>
      <figcaption className="mt-4 text-center text-xs text-text-muted">
        An example of a project and an ask, drawn with the board&rsquo;s own styles.
      </figcaption>
    </figure>
  );
}
