/**
 * The `QUORUM_OS V1.0 / SYS:NOMINAL` footer — terminal seasoning at the bottom
 * of a page's content column. Quiet by design (9px, border color text).
 */
export default function TerminalFooter({ status = "SYS:NOMINAL" }: { status?: string }) {
  return (
    <div
      className="flex justify-between font-mono"
      style={{
        fontSize: 9,
        color: "var(--border-muted)",
        marginTop: 16,
        paddingTop: 10,
        borderTop: "0.5px solid var(--bg-surface)",
      }}
    >
      <span>QUORUM_OS V1.0</span>
      <span>{status}</span>
    </div>
  );
}
