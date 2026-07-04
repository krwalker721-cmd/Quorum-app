"use client";

import { usePathname } from "next/navigation";
import { TabPill, TabPillRow } from "@/components/ui/TabPill";

const ITEMS = [
  { href: "/cohort", label: "room" },
  { href: "/cohort/browse", label: "browse" },
  { href: "/cohort/create", label: "create" },
  { href: "/cohort/invite", label: "invite" },
];

export default function CohortNav() {
  const pathname = usePathname();
  return (
    <div
      className="flex items-center px-6 border-b"
      style={{
        height: "var(--subnav-h, 40px)",
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <TabPillRow>
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
            <TabPill key={i.href} href={i.href} active={active}>
              {i.label}
            </TabPill>
          );
        })}
      </TabPillRow>
    </div>
  );
}
