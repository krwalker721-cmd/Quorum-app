"use client";

import { Children, useState, type ReactNode } from "react";
import ui from "@/components/ui/sleek.module.css";

/**
 * A list that shows its first `limit` items and folds the rest behind a
 * "Show all" button, so a busy Sprint doesn't fill the page.
 */
export default function ShowMore({
  limit,
  noun,
  className,
  style,
  children,
}: {
  limit: number;
  /** Plural, for the button: "Show all 48 people". */
  noun: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const items = Children.toArray(children);
  const folded = items.length > limit && !open;
  return (
    <>
      <ul className={className} style={style}>
        {folded ? items.slice(0, limit) : items}
      </ul>
      {items.length > limit && (
        <button type="button" className={ui.ghostBtn} style={{ marginTop: 12 }} onClick={() => setOpen((o) => !o)}>
          {open ? "Show fewer" : `Show all ${items.length} ${noun}`}
        </button>
      )}
    </>
  );
}
