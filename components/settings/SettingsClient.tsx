"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SettingsBilling from "@/components/SettingsBilling";
import { useTheme } from "@/components/ThemeProvider";
import NoGrid from "@/components/ui/NoGrid";
import { TabPill, TabPillRow } from "@/components/ui/TabPill";
import ui from "@/components/ui/sleek.module.css";

type SectionKey =
  | "account"
  | "billing"
  | "notifications"
  | "appearance"
  | "privacy"
  | "danger";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "billing", label: "Billing" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "privacy", label: "Privacy" },
  { key: "danger", label: "Danger zone" },
];

// Keys shared with ThemeProvider (which re-applies them on load) and Sidebar.
const FONT_SIZE_KEY = "quorum-font-size";
const REDUCE_MOTION_KEY = "quorum-reduce-motion";
const SIDEBAR_COLLAPSED_KEY = "quorum-sidebar-collapsed";

const RED = "#f87171";
const GREEN = "#4ade80";

// A hairline panel that doesn't light up on hover: forms you work inside.
const PANEL: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  borderRadius: 12,
  padding: 24,
  marginBottom: 16,
};

// Explicit font, case, and spacing: the global `label` style is lowercase mono.
const LABEL: React.CSSProperties = {
  fontFamily: "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif",
  textTransform: "none",
  letterSpacing: 0,
  fontSize: 13,
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: 6,
};

const NOTE: React.CSSProperties = { fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)", marginTop: 6 };

function Section({
  title,
  children,
  danger = false,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      style={
        danger
          ? { ...PANEL, borderColor: "rgba(248, 81, 73, 0.25)", background: "rgba(248, 81, 73, 0.03)" }
          : PANEL
      }
    >
      <h2 style={{ fontSize: 16, fontWeight: 600, color: danger ? RED : "var(--text-primary)", marginBottom: 18 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

// ─── toggle ──────────────────────────────────────────────────────────────────

function Toggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className="shrink-0"
      style={{
        width: 38,
        height: 22,
        borderRadius: 999,
        border: "none",
        padding: 0,
        background: enabled ? "#f59e0b" : "rgba(255, 255, 255, 0.12)",
        boxShadow: enabled ? "0 0 12px -2px rgba(245, 158, 11, 0.6)" : undefined,
        position: "relative",
        cursor: "pointer",
        transition: "background 0.2s",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: enabled ? "#1a1204" : "#e6edf3",
          top: 3,
          left: enabled ? 19 : 3,
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

function ToggleRow({
  label,
  note,
  enabled,
  onChange,
}: {
  label: string;
  note?: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4" style={{ padding: "10px 0" }}>
      <div className="min-w-0">
        <p style={{ fontSize: 14, color: "var(--text-primary)" }}>{label}</p>
        {note && <p style={{ ...NOTE, marginTop: 2 }}>{note}</p>}
      </div>
      <Toggle enabled={enabled} onChange={onChange} label={label} />
    </div>
  );
}

function Message({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null;
  return (
    <p role="status" style={{ fontSize: 13, color: msg.ok ? GREEN : RED, marginTop: 16 }}>
      {msg.text}
    </p>
  );
}

// ─── confirm modal ───────────────────────────────────────────────────────────

function ConfirmModal({
  heading,
  description,
  confirmLabel,
  requireText,
  onConfirm,
  onCancel,
}: {
  heading: string;
  description: string;
  confirmLabel: string;
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const canConfirm = !requireText || typed === requireText;
  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", zIndex: 100 }}
    >
      <div
        role="dialog"
        aria-label={heading}
        onClick={(e) => e.stopPropagation()}
        className="w-full"
        style={{
          maxWidth: 440,
          padding: 26,
          borderRadius: 14,
          background: "var(--card-elev)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 24px 60px -20px rgba(0, 0, 0, 0.7)",
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{heading}</h3>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)", marginTop: 10 }}>{description}</p>
        {requireText && (
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`Type ${requireText} to confirm`}
            aria-label={`Type ${requireText} to confirm`}
            autoFocus
            className={`${ui.search} w-full`}
            style={{ marginTop: 16 }}
          />
        )}
        <div className="flex gap-2.5 justify-end" style={{ marginTop: 20 }}>
          <button type="button" onClick={onCancel} className={ui.ghostBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={ui.ghostBtn}
            style={{
              background: "#f85149",
              borderColor: "#f85149",
              color: "#fff",
              opacity: canConfirm ? 1 : 0.4,
              cursor: canConfirm ? "pointer" : "default",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

export default function SettingsClient({
  initialName,
  initialEmail,
  initialVisible,
  initialNotificationPrefs,
}: {
  initialName: string;
  initialEmail: string;
  initialVisible: boolean;
  initialNotificationPrefs: Record<string, boolean> | null;
}) {
  const router = useRouter();
  const [section, setSection] = useState<SectionKey>("account");

  return (
    <div
      className={`page-pad ${ui.pageGlow}`}
      style={{ padding: "28px 32px 40px", maxWidth: 1080, margin: "0 auto" }}
    >
      <NoGrid />
      <h1
        className={ui.titleGradient}
        style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
      >
        Settings
      </h1>

      <div className="settings-shell" style={{ display: "flex", gap: 32, alignItems: "flex-start", marginTop: 22 }}>
        {/* Section nav: a column on desktop, a scrolling strip on phones
            (.settings-nav in globals.css). */}
        <nav
          className="settings-nav"
          aria-label="Settings sections"
          style={{ width: 180, flexShrink: 0, position: "sticky", top: "calc(var(--topbar-h, 64px) + 16px)" }}
        >
          {SECTIONS.map((s) => {
            const active = section === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                aria-current={active ? "page" : undefined}
                className={`${ui.navItem}${active ? ` ${ui.navItemActive}` : ""} w-full whitespace-nowrap`}
                style={{
                  border: "none",
                  cursor: "pointer",
                  ...(s.key === "danger" ? { color: active ? RED : "rgba(248, 113, 113, 0.8)" } : {}),
                }}
              >
                {s.label}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1, minWidth: 0 }}>
          {section === "account" && <AccountSection initialName={initialName} initialEmail={initialEmail} />}
          {section === "billing" && <SettingsBilling />}
          {section === "notifications" && <NotificationsSection initial={initialNotificationPrefs} />}
          {section === "appearance" && <AppearanceSection />}
          {section === "privacy" && <PrivacySection initialVisible={initialVisible} />}
          {section === "danger" && <DangerSection router={router} />}
        </div>
      </div>
    </div>
  );
}

// ─── account ─────────────────────────────────────────────────────────────────

function AccountSection({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function saveName() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    setMsg(error ? { text: "Couldn't save your name.", ok: false } : { text: "Name saved.", ok: true });
  }

  async function saveEmail() {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email });
    setMsg(error ? { text: error.message, ok: false } : { text: "Confirmation sent to your new email.", ok: true });
  }

  async function savePassword() {
    if (pw !== pw2) {
      setMsg({ text: "Passwords don't match.", ok: false });
      return;
    }
    if (pw.length < 6) {
      setMsg({ text: "Use at least 6 characters.", ok: false });
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setMsg({ text: error.message, ok: false });
    } else {
      setPw("");
      setPw2("");
      setMsg({ text: "Password updated.", ok: true });
    }
  }

  return (
    <Section title="Account">
      <div style={{ marginBottom: 22 }}>
        <label htmlFor="settings-name" style={LABEL}>Full name</label>
        <div className="field-row flex gap-2.5">
          <input
            id="settings-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${ui.search} flex-1 min-w-0`}
          />
          <button type="button" onClick={saveName} className={ui.primaryBtn}>
            Save
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label htmlFor="settings-email" style={LABEL}>Email address</label>
        <div className="field-row flex gap-2.5">
          <input
            id="settings-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${ui.search} flex-1 min-w-0`}
          />
          <button type="button" onClick={saveEmail} className={ui.primaryBtn}>
            Update email
          </button>
        </div>
        <p style={NOTE}>We&apos;ll send a confirmation to the new address.</p>
      </div>

      <div>
        <label htmlFor="settings-pw" style={LABEL}>New password</label>
        <input
          id="settings-pw"
          type="password"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className={`${ui.search} w-full`}
          style={{ marginBottom: 12 }}
        />
        <label htmlFor="settings-pw2" style={LABEL}>Confirm new password</label>
        <div className="field-row flex gap-2.5">
          <input
            id="settings-pw2"
            type="password"
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className={`${ui.search} flex-1 min-w-0`}
          />
          <button type="button" onClick={savePassword} className={ui.primaryBtn}>
            Update password
          </button>
        </div>
      </div>

      <Message msg={msg} />
    </Section>
  );
}

// ─── notifications ───────────────────────────────────────────────────────────

// Only the trial-ending email reads this preference today
// (lib/email/trial-reminders.ts). The other switches that used to be here were
// saved but never read, so they're gone until something honours them; any
// values already stored are kept when saving.
function NotificationsSection({ initial }: { initial: Record<string, boolean> | null }) {
  const [trialEmail, setTrialEmail] = useState(initial?.email_trial_ending ?? true);
  const [saved, setSaved] = useState(false);

  async function save() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ notification_preferences: { ...(initial ?? {}), email_trial_ending: trialEmail } })
        .eq("id", user.id);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Section title="Notifications">
      <ToggleRow
        label="Email me before my trial ends"
        note="A reminder a few days before a card-free trial runs out."
        enabled={trialEmail}
        onChange={setTrialEmail}
      />
      <p style={{ ...NOTE, marginTop: 8 }}>
        That&apos;s the only notification you can switch off for now. Account and payment emails,
        and in-app notifications, always come through.
      </p>
      <button type="button" onClick={save} className={ui.primaryBtn} style={{ marginTop: 16 }}>
        {saved ? "Saved ✓" : "Save"}
      </button>
    </Section>
  );
}

// ─── appearance ──────────────────────────────────────────────────────────────

const FONT_SIZES = [
  { key: "small", label: "Small" },
  { key: "default", label: "Default" },
  { key: "large", label: "Large" },
] as const;
type FontSize = (typeof FONT_SIZES)[number]["key"];

function AppearanceSection() {
  const { mode, toggle } = useTheme();
  const [fontSize, setFontSize] = useState<FontSize>("default");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const fs = localStorage.getItem(FONT_SIZE_KEY);
      setFontSize(fs === "small" || fs === "large" ? fs : "default");
      setReduceMotion(localStorage.getItem(REDUCE_MOTION_KEY) === "1");
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {}
  }, []);

  function applyFontSize(size: FontSize) {
    setFontSize(size);
    try {
      localStorage.setItem(FONT_SIZE_KEY, size);
    } catch {}
    const root = document.documentElement;
    root.classList.remove("font-size-small", "font-size-default", "font-size-large");
    root.classList.add(`font-size-${size}`);
  }

  function applyReduceMotion(v: boolean) {
    setReduceMotion(v);
    try {
      localStorage.setItem(REDUCE_MOTION_KEY, v ? "1" : "0");
    } catch {}
    document.documentElement.classList.toggle("prefers-reduced-motion", v);
  }

  function applySidebar(v: boolean) {
    setSidebarCollapsed(v);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? "1" : "0");
    } catch {}
  }

  const themeOption = (key: "normal" | "high-contrast", label: string, sub: string) => {
    const selected = mode === key;
    return (
      <button
        type="button"
        onClick={() => !selected && toggle()}
        aria-pressed={selected}
        className="text-left flex-1"
        style={{
          minWidth: 0,
          padding: "14px 16px",
          borderRadius: 10,
          cursor: selected ? "default" : "pointer",
          border: `1px solid ${selected ? "rgba(245, 158, 11, 0.45)" : "rgba(255, 255, 255, 0.08)"}`,
          background: selected ? "rgba(245, 158, 11, 0.08)" : "rgba(255, 255, 255, 0.02)",
        }}
      >
        <p style={{ fontSize: 14, color: selected ? "#f8c56a" : "var(--text-primary)" }}>{label}</p>
        <p style={{ ...NOTE, marginTop: 2 }}>{sub}</p>
      </button>
    );
  };

  return (
    <Section title="Appearance">
      <p style={LABEL}>Theme</p>
      <div className="flex gap-3 flex-wrap sm:flex-nowrap" style={{ marginBottom: 22 }}>
        {themeOption("normal", "Standard", "The default dark finish.")}
        {themeOption("high-contrast", "High contrast", "Brighter borders and text.")}
      </div>

      <p style={LABEL}>Text size</p>
      <div style={{ marginBottom: 18 }}>
        <TabPillRow>
          {FONT_SIZES.map((s) => (
            <TabPill sleek key={s.key} active={fontSize === s.key} onClick={() => applyFontSize(s.key)}>
              {s.label}
            </TabPill>
          ))}
        </TabPillRow>
      </div>

      <ToggleRow
        label="Reduce motion"
        note="Turns off transitions and animations across the app."
        enabled={reduceMotion}
        onChange={applyReduceMotion}
      />
      <ToggleRow
        label="Start with the sidebar collapsed"
        note="Takes effect the next time a page loads."
        enabled={sidebarCollapsed}
        onChange={applySidebar}
      />
    </Section>
  );
}

// ─── privacy ─────────────────────────────────────────────────────────────────

function PrivacySection({ initialVisible }: { initialVisible: boolean }) {
  const [visible, setVisible] = useState(initialVisible);
  const [exporting, setExporting] = useState(false);

  async function saveVisibility(v: boolean) {
    setVisible(v);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ is_visible: v }).eq("id", user.id);
  }

  async function downloadData() {
    setExporting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: profile }, { data: posts }, { data: notes }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("posts").select("*").eq("author_id", user.id),
        supabase.from("notes").select("*").eq("user_id", user.id),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email },
        profile: profile ?? null,
        posts: posts ?? [],
        notes: notes ?? [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quorum-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Section title="Privacy">
      <ToggleRow
        label="Show my profile to other members"
        enabled={visible}
        onChange={saveVisibility}
      />

      <button
        type="button"
        onClick={downloadData}
        disabled={exporting}
        className={ui.ghostBtn}
        style={{ marginTop: 12 }}
      >
        {exporting ? "Preparing…" : "Download my data"}
      </button>

      <details style={{ marginTop: 18 }}>
        <summary className="cursor-pointer" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          What data we store
        </summary>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", marginTop: 8 }}>
          We store your profile info, posts and replies, messages, usage data, and login events.
        </p>
      </details>
    </Section>
  );
}

// ─── danger zone ─────────────────────────────────────────────────────────────

function DangerSection({ router }: { router: ReturnType<typeof useRouter> }) {
  const [modal, setModal] = useState<"leave" | "delete" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function leaveCohort() {
    setModal(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("cohort_members").delete().eq("user_id", user.id);
    setMsg(error ? "Couldn't leave your cohort." : "You've left your cohort.");
  }

  async function deleteAccount() {
    setModal(null);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      router.push("/login");
      router.refresh();
      return;
    }
    // Surface the route's own message. It distinguishes the case that actually
    // matters — billing couldn't be canceled, so the account was deliberately
    // left intact — from a generic failure. Telling someone "contact support"
    // when their card is still on file is the wrong thing to say.
    const detail = await res
      .json()
      .then((j) => (typeof j?.error === "string" ? j.error : null))
      .catch(() => null);
    setMsg(detail ?? "Couldn't delete your account. Contact support.");
  }

  const dangerBtn: React.CSSProperties = {
    color: RED,
    borderColor: "rgba(248, 81, 73, 0.5)",
    background: "transparent",
  };

  return (
    <Section title="Danger zone" danger>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)", marginBottom: 12 }}>
          Remove yourself from your current cohort. You can join a new one.
        </p>
        <button type="button" onClick={() => setModal("leave")} className={ui.ghostBtn} style={dangerBtn}>
          Leave cohort
        </button>
      </div>

      <div>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)", marginBottom: 12 }}>
          Permanently delete your account and all your data. Any subscription ends immediately, without
          a refund for the rest of the period. This cannot be undone.
        </p>
        <button type="button" onClick={() => setModal("delete")} className={ui.ghostBtn} style={dangerBtn}>
          Delete account
        </button>
      </div>

      {msg && <p role="status" style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 16 }}>{msg}</p>}

      {modal === "leave" && (
        <ConfirmModal
          heading="Leave your cohort?"
          description="You'll be removed from your current cohort and lose access to its private room. You can join a new cohort later."
          confirmLabel="Leave cohort"
          onConfirm={leaveCohort}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === "delete" && (
        <ConfirmModal
          heading="Delete your account?"
          description="This permanently deletes your account and all of your data. Any subscription is cancelled immediately, and the rest of your paid period isn't refunded — to keep access until it ends, cancel your membership first and delete afterwards. This cannot be undone."
          confirmLabel="Delete account"
          requireText="DELETE"
          onConfirm={deleteAccount}
          onCancel={() => setModal(null)}
        />
      )}
    </Section>
  );
}
