"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Shown when the root layout itself fails. It replaces that layout, so it can't
// rely on the app's stylesheet or fonts; everything here is inline. It also
// reports the error, which Sentry otherwise wouldn't see this early in a render.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1117",
          color: "#e6edf3",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 14, letterSpacing: "0.08em", margin: "0 0 24px" }}>
            quorum<span style={{ color: "#f59e0b" }}>.</span>
          </p>
          <h1 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>something went wrong</h1>
          <p style={{ fontSize: 13, color: "#8b949e", lineHeight: 1.6, margin: "0 0 24px" }}>
            try again, or come back in a minute.
          </p>
          <button
            onClick={reset}
            style={{
              background: "rgba(245,158,11,0.18)",
              color: "#f59e0b",
              border: "1px solid rgba(245,158,11,0.55)",
              borderRadius: 5,
              padding: "10px 18px",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            try again
          </button>
        </main>
      </body>
    </html>
  );
}
