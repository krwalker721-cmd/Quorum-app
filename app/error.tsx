"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import StatusPage, { STATUS_PRIMARY, STATUS_PRIMARY_STYLE, STATUS_SECONDARY } from "@/components/StatusPage";

// Shown when a page throws while rendering, instead of Next's bare default.
// The root layout (fonts, theme) is still in place here; when it's the layout
// that fails, app/global-error.tsx takes over instead.
export default function Error({
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
    <StatusPage
      code="Something went wrong"
      title="That didn't load."
      body="It's been reported. Try again, or come back in a minute."
      actions={
        <>
          <button type="button" onClick={reset} className={STATUS_PRIMARY} style={STATUS_PRIMARY_STYLE}>
            Try again
          </button>
          <Link href="/" className={STATUS_SECONDARY}>
            Go home
          </Link>
        </>
      }
    />
  );
}
