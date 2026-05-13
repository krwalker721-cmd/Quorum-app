"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import Link from "next/link";

export type Voucher = {
  id: string;
  full_name: string | null;
  username: string | null;
  stage: string | null;
};

export default function VouchedBadge({ vouchers }: { vouchers: Voucher[] }) {
  const [open, setOpen] = useState(false);
  if (vouchers.length === 0) return null;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="vouched by"
        className="font-mono text-[0.85rem] leading-none align-middle"
        style={{ color: "#22c55e" }}
      >
        ◉
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute z-50 mt-2 left-0 p-3 border min-w-[180px]"
            style={{
              background: "var(--card-elev)",
              borderColor: "var(--border)",
            }}
          >
            <p className="font-mono lowercase text-[0.6rem] text-text-faint mb-2">
              vouched by
            </p>
            <div className="space-y-2">
              {vouchers.map((v) => (
                <Link
                  key={v.id}
                  href={v.username ? `/profile/${v.username}` : "#"}
                  className="flex items-center gap-2"
                  onClick={() => setOpen(false)}
                >
                  <Avatar
                    name={v.full_name}
                    stage={v.stage}
                    size={22}
                  />
                  <span className="font-mono lowercase text-[0.7rem] text-text-secondary">
                    {v.full_name?.toLowerCase() ?? "—"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </span>
  );
}
