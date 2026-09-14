"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import Link from "next/link";
import ui from "@/components/ui/sleek.module.css";

export type Voucher = {
  id: string;
  full_name: string | null;
  username: string | null;
  stage: string | null;
};

const GREEN_CHIP: React.CSSProperties = {
  color: "#4ade80",
  borderColor: "rgba(34, 197, 94, 0.35)",
  background: "rgba(34, 197, 94, 0.08)",
  cursor: "pointer",
};

export default function VouchedBadge({ vouchers }: { vouchers: Voucher[] }) {
  const [open, setOpen] = useState(false);
  if (vouchers.length === 0) return null;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={ui.chip}
        style={GREEN_CHIP}
      >
        Vouched by {vouchers.length}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute z-50 mt-2 left-0 min-w-[200px] ${ui.menu}`}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 10px 2px" }}>Vouched by</p>
            {vouchers.map((v) => (
              <Link
                key={v.id}
                href={v.username ? `/profile/${v.username}` : "#"}
                className={`${ui.menuItem} flex items-center gap-2`}
                onClick={() => setOpen(false)}
              >
                <Avatar name={v.full_name} stage={v.stage} size={22} />
                <span className="truncate">{v.full_name ?? "—"}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </span>
  );
}
