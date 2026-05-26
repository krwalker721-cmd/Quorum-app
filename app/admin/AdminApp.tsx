"use client";

import { useEffect, useState } from "react";
import { loadSession, saveSession, clearSession, verifyCode, adminFetch } from "./lib/api";
import Overview from "./sections/Overview";
import Users from "./sections/Users";
import Content from "./sections/Content";
import VaultNominations from "./sections/VaultNominations";
import Feedback from "./sections/Feedback";
import PlatformHealth from "./sections/PlatformHealth";
import Settings from "./sections/Settings";

type Section =
  | "overview"
  | "users"
  | "content"
  | "vault_nominations"
  | "feedback"
  | "platform_health"
  | "settings";

const NAV: { id: Section; label: string }[] = [
  { id: "overview", label: "overview" },
  { id: "users", label: "users" },
  { id: "content", label: "content" },
  { id: "vault_nominations", label: "vault_nominations" },
  { id: "feedback", label: "feedback" },
  { id: "platform_health", label: "platform_health" },
  { id: "settings", label: "settings" },
];

export default function AdminApp() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => {
    setAuthed(!!loadSession());
    setReady(true);
  }, []);

  // periodically check pending report count for the sidebar badge
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await adminFetch("/api/admin/content/reports");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setReportCount((json.reports ?? []).length);
      } catch {}
    }
    load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [authed]);

  if (!ready) {
    return <main className="min-h-screen" style={{ backgroundColor: '#0d1117', backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '28px 28px', backgroundAttachment: 'fixed' }} />;
  }

  if (!authed) {
    return <CodeEntry onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#0d1117', backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '28px 28px', backgroundAttachment: 'fixed' }}>
      <aside
        className="w-56 border-r flex flex-col"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="font-mono lowercase text-text-primary text-sm tracking-wide">
            quorum / admin
          </p>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint mt-1">
            session Â· 24h
          </p>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((n) => {
            const active = n.id === section;
            const badge = n.id === "content" && reportCount > 0 ? reportCount : null;
            return (
              <button
                key={n.id}
                onClick={() => setSection(n.id)}
                className={`w-full flex items-center justify-between text-left font-mono lowercase text-[0.75rem] px-5 py-2.5 transition-colors ${
                  active
                    ? "text-text-primary"
                    : "text-text-muted hover:text-text-primary"
                }`}
                style={
                  active
                    ? { borderLeft: "2px solid #f59e0b", background: "rgba(245, 158, 11,0.06)" }
                    : { borderLeft: "2px solid transparent" }
                }
              >
                <span>{n.label}</span>
                {badge !== null && (
                  <span
                    className="font-mono text-[0.6rem] px-1.5 py-0.5"
                    style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => {
              clearSession();
              setAuthed(false);
            }}
            className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-primary"
          >
            lock â†’
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        {section === "overview" && <Overview />}
        {section === "users" && <Users />}
        {section === "content" && <Content onReportCountChange={setReportCount} />}
        {section === "vault_nominations" && <VaultNominations />}
        {section === "feedback" && <Feedback />}
        {section === "platform_health" && <PlatformHealth />}
        {section === "settings" && <Settings />}
      </main>
    </div>
  );
}

function CodeEntry({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const ok = await verifyCode(code);
    if (ok) {
      saveSession(code);
      onSuccess();
    } else {
      setError(true);
    }
    setBusy(false);
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: '#0d1117', backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '28px 28px', backgroundAttachment: 'fixed' }}
    >
      <form onSubmit={submit} className="w-full max-w-sm">
        <p className="font-mono lowercase text-[0.65rem] text-text-faint text-center mb-1">
          quorum / admin
        </p>
        <h1 className="font-mono lowercase text-text-primary text-base text-center mb-8">
          enter admin code
        </h1>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoComplete="off"
          className="text-center"
        />
        {error && (
          <p className="font-mono lowercase text-xs text-red-400/80 mt-3 text-center">
            incorrect code
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !code}
          className="w-full mt-5 font-mono lowercase text-xs py-2.5 disabled:opacity-50"
          style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
        >
          {busy ? "checkingâ€¦" : "submit"}
        </button>
      </form>
    </main>
  );
}
