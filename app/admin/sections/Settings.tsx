"use client";

import { useEffect, useState } from "react";
import { adminFetch, saveSession } from "../lib/api";
import { SectionShell } from "./Overview";

type Settings = {
  platform_status: string;
  welcome_message: string;
  maintenance_mode: string;
};

export default function SettingsSection() {
  const [s, setS] = useState<Settings | null>(null);
  const [welcomeDraft, setWelcomeDraft] = useState("");
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const [curCode, setCurCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [codeMsg, setCodeMsg] = useState<string | null>(null);

  async function load() {
    const res = await adminFetch("/api/admin/settings");
    if (res.ok) {
      const json = await res.json();
      setS(json.settings);
      setWelcomeDraft(json.settings.welcome_message ?? "");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function update(key: string, value: string) {
    const res = await adminFetch("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({ key, value }),
    });
    if (res.ok) {
      setSavedFlash(key);
      setTimeout(() => setSavedFlash(null), 1500);
      load();
    }
  }

  async function changeCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeMsg(null);
    if (newCode !== confirmCode) {
      setCodeMsg("new codes don't match");
      return;
    }
    const res = await adminFetch("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({ kind: "change_code", current: curCode, next: newCode }),
    });
    if (res.ok) {
      saveSession(newCode);
      setCodeMsg("code updated");
      setCurCode("");
      setNewCode("");
      setConfirmCode("");
    } else {
      const j = await res.json().catch(() => ({}));
      setCodeMsg(j.error ?? "failed");
    }
  }

  if (!s) return <SectionShell title="settings"><p className="font-mono text-xs text-text-faint">loadingâ€¦</p></SectionShell>;

  return (
    <SectionShell title="settings">
      <div className="space-y-4 max-w-2xl">
        <Card title="platform_status">
          <div className="flex gap-2">
            {["open", "waitlist"].map((v) => (
              <button
                key={v}
                onClick={() => update("platform_status", v)}
                className="font-mono lowercase text-[0.7rem] px-3 py-1.5 border"
                style={{
                  borderColor: s.platform_status === v ? "#dc6414" : "var(--border)",
                  background: s.platform_status === v ? "rgba(220, 100, 20,0.08)" : "transparent",
                  color: s.platform_status === v ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {v}
              </button>
            ))}
            {savedFlash === "platform_status" && (
              <span className="font-mono text-[0.6rem] text-amber self-center">saved</span>
            )}
          </div>
          <p className="font-mono text-[0.6rem] text-text-faint mt-2 lowercase">
            open: anyone with invite signs up Â· waitlist: new signups go to pending
          </p>
        </Card>

        <Card title="maintenance_mode">
          <div className="flex gap-2">
            {["false", "true"].map((v) => (
              <button
                key={v}
                onClick={() => update("maintenance_mode", v)}
                className="font-mono lowercase text-[0.7rem] px-3 py-1.5 border"
                style={{
                  borderColor: s.maintenance_mode === v
                    ? v === "true" ? "#ef4444" : "#dc6414"
                    : "var(--border)",
                  background: s.maintenance_mode === v
                    ? v === "true" ? "rgba(239,68,68,0.08)" : "rgba(220, 100, 20,0.08)"
                    : "transparent",
                  color: s.maintenance_mode === v ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {v === "true" ? "on" : "off"}
              </button>
            ))}
            {savedFlash === "maintenance_mode" && (
              <span className="font-mono text-[0.6rem] text-amber self-center">saved</span>
            )}
          </div>
          <p className="font-mono text-[0.6rem] text-text-faint mt-2 lowercase">
            when on, non-admin users see "quorum is undergoing maintenance"
          </p>
        </Card>

        <Card title="welcome_message">
          <textarea
            rows={3}
            value={welcomeDraft}
            onChange={(e) => setWelcomeDraft(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button
              disabled={savingWelcome || welcomeDraft === s.welcome_message}
              onClick={async () => {
                setSavingWelcome(true);
                await update("welcome_message", welcomeDraft);
                setSavingWelcome(false);
              }}
              className="font-mono lowercase text-[0.7rem] px-3 py-1.5 disabled:opacity-50"
              style={{ background: "#dc6414", color: "#000" }}
            >
              {savingWelcome ? "savingâ€¦" : "save"}
            </button>
            {savedFlash === "welcome_message" && (
              <span className="font-mono text-[0.6rem] text-amber self-center">saved</span>
            )}
          </div>
        </Card>

        <Card title="admin_code">
          <form onSubmit={changeCode} className="space-y-2">
            <div>
              <label>current code</label>
              <input type="password" value={curCode} onChange={(e) => setCurCode(e.target.value)} />
            </div>
            <div>
              <label>new code</label>
              <input type="password" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            </div>
            <div>
              <label>confirm new code</label>
              <input type="password" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} />
            </div>
            {codeMsg && (
              <p className="font-mono text-[0.65rem] lowercase" style={{ color: codeMsg === "code updated" ? "#22c55e" : "#ef4444" }}>
                {codeMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={!curCode || !newCode || !confirmCode}
              className="font-mono lowercase text-[0.7rem] px-3 py-1.5 disabled:opacity-50"
              style={{ background: "#dc6414", color: "#000" }}
            >
              update code
            </button>
          </form>
        </Card>
      </div>
    </SectionShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <p className="font-mono text-[0.65rem] lowercase text-text-faint mb-3">{title}</p>
      {children}
    </div>
  );
}
