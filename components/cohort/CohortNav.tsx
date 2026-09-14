"use client";

import { usePathname } from "next/navigation";
import { TabPill } from "@/components/ui/TabPill";

const ITEMS = [
  { href: "/cohort", label: "Room" },
  { href: "/cohort/browse", label: "Browse" },
  { href: "/cohort/create", label: "Create" },
  { href: "/cohort/invite", label: "Invite" },
];

// Every cohort page is in the sleek finish, so the sub-nav is too.
export default function CohortNav() {
  const pathname = usePathname();
  return (
    <div
      className="flex items-center px-6 border-b"
      style={{
        height: "var(--subnav-h, 40px)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* One row that scrolls sideways on narrow screens: TabPillRow wraps,
          and a second row spills out of the fixed-height bar. */}
      <div className="flex items-center gap-1.5 overflow-x-auto scroll-thin">
        {ITEMS.map((i) => {
          // "room" stays active on the index and on any scoped /cohort/[id] room,
          // but not on the sibling static routes (browse/create/invite).
          const active =
            i.href === "/cohort"
              ? pathname === "/cohort" ||
                (pathname.startsWith("/cohort/") &&
                  !["/cohort/browse", "/cohort/create", "/cohort/invite"].some(
                    (p) => pathname.startsWith(p),
                  ))
              : pathname === i.href;
          return (
            <TabPill key={i.href} href={i.href} active={active} sleek style={{ padding: "6px 12px", flexShrink: 0 }}>
              {i.label}
            </TabPill>
          );
        })}
      </div>
    </div>
  );
}
