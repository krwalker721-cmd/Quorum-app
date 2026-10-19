"use client";

import { useEffect, useState } from "react";
import { loadSession, saveSession, clearSession, verifyCode, whoAmI, adminFetch, type AdminGate } from "./lib/api";
import Overview from "./sections/Overview";
import Users from "./sections/Users";
import Content from "./sections/Content";
import VaultNominations from "./sections/VaultNominations";
import Feedback from "./sections/Feedback";
import PlatformHealth from "./sections/PlatformHealth";
import Settings from "./sections/Settings";
import Subscriptions from "./sections/Subscriptions";
import PartnerWaitlist from "./sections/PartnerWaitlist";
import Referrals from "./sections/Referrals";
import SprintAudit from "./sections/SprintAudit";
import Sprints from "./sections/Sprints";
import Countdowns from "./sections/Countdowns";

type Section =
  | "overview"
  | "sprints"
  | "countdowns"
  | "users"
  | "subscriptions"
  | "partner_waitlist"
  | "referrals"
  | "content"
  | "vault_nominations"
  | "feedback"
  | "sprint_audit"
  | "platform_health"
  | "settings";

const NAV: { id: Section; label: string }[] = [
  { id: "overview", label: "overview" },
  { id: "sprints", label: "buildathons" },
  { id: "countdowns", label: "countdowns" },
  { id: "users", label: "users" },
  { id: "subscriptions", label: "subscriptions" },
  { id: "partner_waitlist", label: "partner_waitlist" },
  { id: "referrals", label: "referrals" },
  { id: "content", label: "content" },
  { id: "vault_nominations", label: "vault_nominations" },
  { id: "feedback", label: "feedback" },
  { id: "sprint_audit", label: "sprint_audit" },
  { id: "platform_health", label: "platform_health" },
  { id: "settings", label: "settings" },
];

export default function AdminApp() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [reportCount, setReportCount] = useState(0);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [gate, setGate] = useState<AdminGate | null>(null);

  // Two locks: an admin Quorum account, then the code. Check the account (and
  // any saved code) on open, so a signed-out or non-admin visitor is told why
  // before typing anything.
  useEffect(() => {
    (async () => {
      const r = await whoAmI();
      if (r.gate === "ok") {
        setAdminName(r.name ?? null);
        setAuthed(true);
      } else {
        if (loadSession()) clearSession();
        setAuthed(false);
        setGate(r.gate);
      }
      setReady(true);
    })();
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
    return (
      <CodeEntry
        gate={gate}
        onSuccess={(name) => {
          setAdminName(name);
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ backgroundColor: '#0d1117', backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '28px 28px', backgroundAttachment: 'fixed' }}>
      <aside
        className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r flex flex-col md:min-h-screen"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="font-mono lowercase text-text-primary text-sm tracking-wide">
            quorum / admin
          </p>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint mt-1 truncate">
            {adminName ? `${adminName} · 24h` : "session · 24h"}
          </p>
        </div>
        {/* A scrolling row on phones, the usual rail from md up. */}
        <nav className="flex md:block overflow-x-auto md:overflow-visible md:flex-1 md:py-3">
          {NAV.map((n) => {
            const active = n.id === section;
            const badge = n.id === "content" && reportCount > 0 ? reportCount : null;
            return (
              <button
                key={n.id}
                onClick={() => setSection(n.id)}
                className={`shrink-0 md:w-full flex items-center justify-between gap-2 text-left font-mono lowercase text-[0.75rem] px-4 md:px-5 py-2.5 whitespace-nowrap transition-colors ${
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
        <div className="hidden md:block px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => {
              clearSession();
              setAuthed(false);
            }}
            className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-primary"
          >
            lock
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        {section === "overview" && <Overview />}
        {section === "sprints" && <Sprints />}
        {section === "countdowns" && <Countdowns />}
        {section === "users" && <Users />}
        {section === "subscriptions" && <Subscriptions />}
        {section === "partner_waitlist" && <PartnerWaitlist />}
        {section === "referrals" && <Referrals />}
        {section === "content" && <Content onReportCountChange={setReportCount} />}
        {section === "vault_nominations" && <VaultNominations />}
        {section === "feedback" && <Feedback />}
        {section === "sprint_audit" && <SprintAudit />}
        {section === "platform_health" && <PlatformHealth />}
        {section === "settings" && <Settings />}
      </main>
    </div>
  );
}

const GATE_MESSAGE: Record<Exclude<AdminGate, "ok">, string> = {
  wrong_code: "incorrect code",
  locked: "too many attempts — try again in 15 minutes",
  sign_in: "sign in to quorum with your admin account first",
  not_admin: "this quorum account isn't an admin",
};

function CodeEntry({ gate, onSuccess }: { gate: AdminGate | null; onSuccess: (name: string | null) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AdminGate | null>(gate === "sign_in" || gate === "not_admin" ? gate : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await verifyCode(code);
    if (result === "ok") {
      saveSession(code);
      const me = await whoAmI();
      onSuccess(me.name ?? null);
    } else {
      setError(result);
    }
    setBusy(false);
  }

  // Without an admin account there's no point asking for the code.
  if (error === "sign_in" || error === "not_admin") {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-6"
        style={{ backgroundColor: '#0d1117', backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '28px 28px', backgroundAttachment: 'fixed' }}
      >
        <div className="w-full max-w-sm text-center">
          <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-1">quorum / admin</p>
          <h1 className="font-mono lowercase text-text-primary text-base mb-4">{GATE_MESSAGE[error]}</h1>
          <p className="font-mono text-[0.7rem] text-text-muted mb-6">
            The admin console needs both an admin account and the admin code.
          </p>
          <a
            href="/login?next=/admin"
            className="inline-block font-mono lowercase text-xs px-4 py-2.5"
            style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, fontWeight: 700 }}
          >
            {error === "sign_in" ? "sign in" : "sign in with another account"}
          </a>
        </div>
      </main>
    );
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
            {GATE_MESSAGE[error as Exclude<AdminGate, "ok">] ?? "incorrect code"}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !code}
          className="w-full mt-5 font-mono lowercase text-xs py-2.5 disabled:opacity-50"
          style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
        >
          {busy ? "checking…" : "submit"}
        </button>
      </form>
    </main>
  );
}
