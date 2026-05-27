"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { error: Error | null; info: ErrorInfo | null };

export default class NoteEditorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the browser console too so it shows in DevTools.
    // eslint-disable-next-line no-console
    console.error("[note editor] crashed:", error, info);
    this.setState({ error, info });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="border p-6 min-h-[400px]"
          style={{
            background: "var(--card)",
            borderColor: "rgba(248,81,73,0.4)",
            color: "var(--text-secondary)",
          }}
        >
          <p className="font-mono lowercase text-[0.75rem]" style={{ color: "#f87171" }}>
            note editor crashed
          </p>
          <p className="font-mono lowercase text-[0.7rem] mt-2 text-text-muted">
            {this.state.error.message}
          </p>
          <pre
            className="font-mono text-[0.6rem] mt-3 overflow-auto p-2"
            style={{
              background: "var(--bg)",
              color: "var(--text-faint)",
              maxHeight: 200,
              border: "1px solid var(--border)",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.error.stack ?? ""}
            {this.state.info?.componentStack ?? ""}
          </pre>
          <button
            onClick={() => this.setState({ error: null, info: null })}
            className="font-mono lowercase text-[0.7rem] mt-3 px-3 py-1.5 border"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
