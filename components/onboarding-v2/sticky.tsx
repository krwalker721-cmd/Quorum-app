"use client";

// Shared scaffolding for the sticky-pin scroll pattern used throughout the
// cinematic onboarding. An outer element of `heightVh` creates the scroll
// distance; the inner element pins to the viewport (sticky, 100vh) while the
// outer scrolls past, and content inside animates against scroll progress.
//
//   const ref = useRef(null)
//   const { scrollYProgress } = useChapterScroll(ref)
//   <Chapter ref={ref} id="chapter-2" heightVh={300}>
//     <StickyStage>{/* animates against scrollYProgress */}</StickyStage>
//   </Chapter>

import { forwardRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useScroll } from "framer-motion";

// Track scroll progress through a specific chapter element. 0 = the element's
// top hits the viewport top; 1 = the element's bottom hits the viewport bottom.
export function useChapterScroll(ref: RefObject<HTMLElement>) {
  return useScroll({ target: ref, offset: ["start start", "end end"] });
}

// The tall outer container that creates a chapter's scroll runway.
export const Chapter = forwardRef<
  HTMLDivElement,
  { id?: string; heightVh: number; children: ReactNode; style?: CSSProperties }
>(function Chapter({ id, heightVh, children, style }, ref) {
  return (
    <div ref={ref} id={id} style={{ height: `${heightVh}vh`, position: "relative", ...style }}>
      {children}
    </div>
  );
});

// The pinned viewport. Centers its content by default; pass `center={false}`
// for chapters (founder drift, horizontal collab) that position absolutely.
export function StickyStage({
  children,
  center = true,
  style,
}: {
  children: ReactNode;
  center?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        overflow: "hidden",
        boxSizing: "border-box",
        ...(center
          ? {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px 20px",
            }
          : { position: "sticky" }),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
