"use client";

import { useEffect, useState, useCallback } from "react";
import { adminFetch } from "../lib/api";
import { SectionShell } from "./Overview";

type User = {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  stage: string | null;
  status: string;
  tier: string;
  trust_score: number;
  created_at: string;
  last_active_at: string | null;
};

const FILTERS = [
  "all",
  "pending",
  "approved",
  "suspended",
  "tier_free",
  "tier_1",
  "tier_2",
] as const;

export default function UsersSection() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filter !== "all") params.set("filter", filter);
    try {
      const res = await adminFetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [q, filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string, body: Record<string, any>) {
    const res = await adminFetch("/api/admin/users/action", {
      method: "POST",
      body: JSON.stringify({ action, ...body }),
    });
    if (res.ok) {
      setSelected(new Set());
      await load();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "failed");
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  return (
    <SectionShell title="users">
      <div className="flex flex-col md:flex-row gap-2 md:items-center mb-3">
        <input
          placeholder="search by name, email, username"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load();
          }}
          className="md:max-w-sm"
        />
        <button
          onClick={load}
          className="font-mono lowercase text-[0.7rem] px-3 py-2 border"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          search
        </button>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`font-mono lowercase text-[0.65rem] px-2.5 py-1.5 border ${
              filter === f ? "text-text-primary" : "text-text-muted"
            }`}
            style={{
              borderColor: filter === f ? "#f59e0b" : "var(--border)",
              background: filter === f ? "rgba(245,158,11,0.08)" : "transparent",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div
          className="flex items-center gap-2 mb-3 p-2 border"
          style={{ borderColor: "rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.06)" }}
        >
          <span className="font-mono text-[0.65rem] lowercase text-text-muted">
            {selected.size} selected
          </span>
          <button
            onClick={() => act("approve", { ids: Array.from(selected) })}
            className="font-mono text-[0.65rem] lowercase px-2 py-1 border"
            style={{ borderColor: "var(--border)", color: "#22c55e" }}
          >
            bulk approve
          </button>
          <select
            onChange={(e) => {
              if (e.target.value) {
                act("change_tier", { ids: Array.from(selected), tier: e.target.value });
                e.target.value = "";
              }
            }}
            defaultValue=""
            className="font-mono text-[0.65rem] lowercase"
            style={{ width: "auto" }}
          >
            <option value="">bulk change tier…</option>
            <option value="free">free</option>
            <option value="tier_1">tier_1</option>
            <option value="tier_2">tier_2</option>
          </select>
          <button
            onClick={() => setSelected(new Set())}
            className="font-mono text-[0.65rem] lowercase text-text-faint ml-auto"
          >
            clear
          </button>
        </div>
      )}

      <div className="border overflow-x-auto" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <table className="w-full text-[0.78rem]">
          <thead>
            <tr className="font-mono lowercase text-[0.6rem] text-text-faint">
              <th className="text-left px-3 py-2 w-8"></th>
              <th className="text-left px-3 py-2">name</th>
              <th className="text-left px-3 py-2">email</th>
              <th className="text-left px-3 py-2">stage</th>
              <th className="text-left px-3 py-2">tier</th>
              <th className="text-left px-3 py-2">status</th>
              <th className="text-left px-3 py-2">trust</th>
              <th className="text-left px-3 py-2">joined</th>
              <th className="text-left px-3 py-2">last_active</th>
              <th className="text-left px-3 py-2">actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-6 font-mono text-xs text-text-faint">loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-6 font-mono text-xs text-text-faint">no users</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggle(u.id)}
                      style={{ width: 14, height: 14, padding: 0 }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 flex items-center justify-center font-mono text-[0.6rem]"
                        style={{ background: "var(--card-elev)", color: "var(--text-muted)" }}
                      >
                        {(u.full_name ?? u.username ?? "?")[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-text-secondary">{u.full_name ?? "—"}</p>
                        {u.username && (
                          <p className="font-mono text-[0.6rem] text-text-faint lowercase">@{u.username}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.7rem] text-text-muted lowercase">{u.email}</td>
                  <td className="px-3 py-2 font-mono text-[0.65rem] text-text-muted lowercase">
                    {u.stage ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="font-mono text-[0.6rem] lowercase px-1.5 py-0.5"
                      style={{ background: "var(--card-elev)", color: "var(--text-muted)" }}
                    >
                      {u.tier ?? "free"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={u.status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.7rem] text-text-muted">{u.trust_score}</td>
                  <td className="px-3 py-2 font-mono text-[0.6rem] text-text-faint">
                    {u.created_at?.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.6rem] text-text-faint">
                    {u.last_active_at?.slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.status === "pending" && (
                        <ActionBtn onClick={() => act("approve", { id: u.id })}>approve</ActionBtn>
                      )}
                      {u.status === "approved" && (
                        <ActionBtn onClick={() => act("suspend", { id: u.id })} color="#ef4444">
                          suspend
                        </ActionBtn>
                      )}
                      {u.status === "suspended" && (
                        <ActionBtn onClick={() => act("unsuspend", { id: u.id })}>unsuspend</ActionBtn>
                      )}
                      <select
                        value={u.tier ?? "free"}
                        onChange={(e) => act("change_tier", { id: u.id, tier: e.target.value })}
                        className="font-mono text-[0.6rem] lowercase"
                        style={{ width: "auto", padding: "2px 4px" }}
                      >
                        <option value="free">free</option>
                        <option value="tier_1">t1</option>
                        <option value="tier_2">t2</option>
                      </select>
                      {u.username && (
                        <a
                          href={`/profile/${u.username}`}
                          target="_blank"
                          className="font-mono text-[0.6rem] lowercase px-2 py-1 border"
                          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                        >
                          view
                        </a>
                      )}
                      <ActionBtn onClick={() => setConfirmDelete(u)} color="#ef4444">
                        delete
                      </ActionBtn>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <DeleteModal
          user={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={async (typed) => {
            await act("delete", { id: confirmDelete.id, confirm_username: typed });
            setConfirmDelete(null);
          }}
        />
      )}
    </SectionShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "#f59e0b",
    approved: "#22c55e",
    suspended: "#ef4444",
  };
  return (
    <span
      className="font-mono text-[0.6rem] lowercase px-1.5 py-0.5"
      style={{
        background: `${colors[status] ?? "#707070"}22`,
        color: colors[status] ?? "#c0c0c0",
      }}
    >
      {status}
    </span>
  );
}

function ActionBtn({
  children,
  onClick,
  color = "var(--text-muted)",
}: {
  children: React.ReactNode;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="font-mono text-[0.6rem] lowercase px-2 py-1 border"
      style={{ borderColor: "var(--border)", color }}
    >
      {children}
    </button>
  );
}

function DeleteModal({
  user,
  onClose,
  onConfirm,
}: {
  user: User;
  onClose: () => void;
  onConfirm: (typed: string) => void;
}) {
  const [typed, setTyped] = useState("");
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border p-5"
        style={{ background: "var(--card-elev)", borderColor: "#ef4444" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-xs lowercase text-red-400 mb-2">delete user</p>
        <p className="text-text-secondary text-sm mb-4">
          this will permanently delete this user and all their content. type{" "}
          <span className="font-mono text-amber">{user.username ?? "(no username)"}</span> to confirm.
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="username"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="font-mono lowercase text-[0.7rem] px-3 py-1.5 border"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            cancel
          </button>
          <button
            onClick={() => onConfirm(typed)}
            disabled={typed !== user.username}
            className="font-mono lowercase text-[0.7rem] px-3 py-1.5 disabled:opacity-50"
            style={{ background: "#ef4444", color: "#000" }}
          >
            delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}
