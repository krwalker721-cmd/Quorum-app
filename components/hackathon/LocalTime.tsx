"use client";

import { useEffect, useState } from "react";

const FORMATS = {
  full: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" },
  date: { weekday: "short", month: "short", day: "numeric", year: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

/**
 * A time in the viewer's own time zone ("Fri, Oct 10, 6:00 PM EDT"). Rendered
 * after mount, since the server doesn't know the viewer's zone.
 */
export default function LocalTime({ iso, format = "full" }: { iso: string | null; format?: keyof typeof FORMATS }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(iso ? new Intl.DateTimeFormat(undefined, FORMATS[format]).format(new Date(iso)) : null);
  }, [iso, format]);
  if (!iso) return <span>not set</span>;
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text ?? "…"}
    </time>
  );
}
