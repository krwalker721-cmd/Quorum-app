"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SettingsBilling from "@/components/SettingsBilling";

const MONO = "JetBrains Mono, monospace";
const SANS = "Space Grotesk, sans-serif";

type SectionKey =
  | "account"
  | "billing"
  | "notifications"
  | "appearance"
  | "privacy"
  | "danger";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "account", label: "account" },
  { key: "billing", label: "billing" },
  { key: "notifications", label: "notifications" },
  { key: "appearance", label: "appearance" },
  { key: "privacy", label: "privacy" },
  { key: "danger", label: "danger zone" },
];

const NOTIFICATION_FIELDS: { key: string; label: string }[] = [
  { key: "email_trial_ending", label: "receive email when trial is ending" },
  { key: "email_payment_failed", label: "receive email when payment fails" },
  { key: "email_referral_activates", label: "receive email when referral activates" },
  { key: "email_milestone", label: "receive email when milestone reached" },
  { key: "inapp_cohort", label: "in-app: cohort activity" },
  { key: "inapp_pulse", label: "in-app: pulse replies" },
  { key: "inapp_messages", label: "in-app: messages" },
  { key: "inapp_referrals", label: "in-app: referral updates" },
];

const FONT_SIZE_KEY = "quorum-font-size";
const REDUCE_MOTION_KEY = "quorum-reduce-motion";
const SIDEBAR_COLLAPSED_KEY = "quorum-sidebar-collapsed";

const cardStyle: React.CSSProperties = {
  background: "#161b22",
  border: "1px solid #21262d",
  borderRadius: 4,
  padding: 24,
  marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid #21262d",
  borderRadius: 4,
  color: "#e6edf3",
  fontFamily: SANS,
  fontSize: 14,
  padding: "10px 14px",
  outline: "none",
  colorScheme: "dark",
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 11,
  color: "#8b949e",
  letterSpacing: "0.04em",
  display: "block",
  marginBottom: 6,
};

const amberBtn: React.CSSProperties = {
  background: "#f59e0b",
  color: "#0d1117",
  fontFamily: MONO,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.06em",
  padding: "9px 16px",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};

const sectionHeading: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: 16,
  color: "#e6edf3",
  marginBottom: 16,
};

const noteStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 10,
  color: "#484f58",
  marginTop: 6,
};

// ─── toggle ──────────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!enabled)}
      role="switch"
      aria-checked={enabled}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: enabled ? "#f59e0b" : "#21262d",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#e6edf3",
          top: 3,
          left: enabled ? 19 : 3,
          transition: "left 0.2s",
        }}
      />
    </div>
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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 4, padding: 28, maxWidth: 420, width: "100%" }}
      >
        <h3 style={{ fontFamily: SANS, fontSize: 18, color: "#e6edf3", margin: 0 }}>{heading}</h3>
        <p style={{ fontFamily: SANS, fontSize: 14, color: "#8b949e", marginTop: 10, lineHeight: 1.5 }}>{description}</p>
        {requireText && (
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`type ${requireText} to confirm`}
            autoFocus
            style={{ ...inputStyle, marginTop: 16, fontFamily: MONO }}
          />
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button
            onClick={onCancel}
            style={{
              background: "transparent",
              border: "1px solid #21262d",
              color: "#8b949e",
              fontFamily: MONO,
              fontSize: 11,
              padding: "9px 16px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{
              background: "#f85149",
              border: "none",
              color: "#e6edf3",
              fontFamily: MONO,
              fontSize: 11,
              padding: "9px 16px",
              borderRadius: 4,
              cursor: canConfirm ? "pointer" : "default",
              opacity: canConfirm ? 1 : 0.4,
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
    <div style={{ display: "flex", gap: 32, maxWidth: 1040, margin: "0 auto", padding: "40px 24px", alignItems: "flex-start" }}>
      {/* left nav */}
      <nav style={{ width: 160, flexShrink: 0, position: "sticky", top: 24 }}>
        {SECTIONS.map((s) => {
          const active = section === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.04em",
                color: active ? "#e6edf3" : "#8b949e",
                background: "transparent",
                border: "none",
                borderLeft: `2px solid ${active ? "#f59e0b" : "transparent"}`,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </nav>

      {/* content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {section === "account" && (
          <AccountSection initialName={initialName} initialEmail={initialEmail} initialVisible={initialVisible} />
        )}
        {section === "billing" && <SettingsBilling />}
        {section === "notifications" && (
          <NotificationsSection initial={initialNotificationPrefs} />
        )}
        {section === "appearance" && <AppearanceSection />}
        {section === "privacy" && <PrivacySection initialVisible={initialVisible} />}
        {section === "danger" && <DangerSection router={router} />}
      </div>
    </div>
  );
}

// ─── account ─────────────────────────────────────────────────────────────────

function AccountSection({
  initialName,
  initialEmail,
  initialVisible,
}: {
  initialName: string;
  initialEmail: string;
  initialVisible: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [visible, setVisible] = useState(initialVisible);
  const [msg, setMsg] = useState<{ text: string; color: string } | null>(null);

  async function saveName() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    setMsg(error ? { text: "could not save name", color: "#f85149" } : { text: "name saved", color: "#22c55e" });
  }

  async function saveEmail() {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email });
    setMsg(error ? { text: error.message.toLowerCase(), color: "#f85149" } : { text: "confirmation sent to your new email", color: "#22c55e" });
  }

  async function savePassword() {
    if (pw !== pw2) {
      setMsg({ text: "passwords do not match", color: "#f85149" });
      return;
    }
    if (pw.length < 6) {
      setMsg({ text: "password must be at least 6 characters", color: "#f85149" });
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setMsg({ text: error.message.toLowerCase(), color: "#f85149" });
    } else {
      setPw("");
      setPw2("");
      setMsg({ text: "password updated", color: "#22c55e" });
    }
  }

  async function saveVisibility(v: boolean) {
    setVisible(v);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ is_visible: v }).eq("id", user.id);
  }

  return (
    <div style={cardStyle}>
      <h2 style={sectionHeading}>Account</h2>

      {/* name */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>full name</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          <button onClick={saveName} style={amberBtn}>
            save
          </button>
        </div>
      </div>

      {/* email */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>email address</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <button onClick={saveEmail} style={amberBtn}>
            update email →
          </button>
        </div>
        <p style={noteStyle}>// a confirmation will be sent to your new email</p>
      </div>

      {/* password */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>new password</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
        <label style={labelStyle}>confirm new password</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={inputStyle} />
          <button onClick={savePassword} style={amberBtn}>
            update password →
          </button>
        </div>
      </div>

      {/* visibility */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "#8b949e" }}>Show my profile to other members</span>
        <Toggle enabled={visible} onChange={saveVisibility} />
      </div>

      {msg && <p style={{ fontFamily: MONO, fontSize: 11, color: msg.color, marginTop: 16 }}>{msg.text}</p>}
    </div>
  );
}

// ─── notifications ───────────────────────────────────────────────────────────

function NotificationsSection({ initial }: { initial: Record<string, boolean> | null }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    NOTIFICATION_FIELDS.forEach((f) => (base[f.key] = initial?.[f.key] ?? true));
    return base;
  });
  const [saved, setSaved] = useState(false);

  async function save() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ notification_preferences: prefs }).eq("id", user.id);
    }
    try {
      localStorage.setItem("quorum-notification-prefs", JSON.stringify(prefs));
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={cardStyle}>
      <h2 style={sectionHeading}>Notification Preferences</h2>
      {NOTIFICATION_FIELDS.map((f) => (
        <div
          key={f.key}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}
        >
          <span style={{ fontFamily: MONO, fontSize: 12, color: "#8b949e" }}>{f.label}</span>
          <Toggle enabled={prefs[f.key]} onChange={(v) => setPrefs((p) => ({ ...p, [f.key]: v }))} />
        </div>
      ))}
      <button onClick={save} style={{ ...amberBtn, marginTop: 16 }}>
        {saved ? "saved ✓" : "save preferences"}
      </button>
    </div>
  );
}

// ─── appearance ──────────────────────────────────────────────────────────────

function AppearanceSection() {
  const [fontSize, setFontSize] = useState<"small" | "default" | "large">("default");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const fs = (localStorage.getItem(FONT_SIZE_KEY) as "small" | "default" | "large") || "default";
      setFontSize(fs);
      setReduceMotion(localStorage.getItem(REDUCE_MOTION_KEY) === "1");
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {}
  }, []);

  function applyFontSize(size: "small" | "default" | "large") {
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

  const themeCard = (selected: boolean, disabled: boolean, label: string): React.CSSProperties => ({
    background: "#161b22",
    border: `1px solid ${selected ? "#f59e0b" : "#21262d"}`,
    borderRadius: 4,
    padding: 16,
    cursor: disabled ? "default" : "pointer",
    textAlign: "center",
    flex: 1,
    opacity: disabled ? 0.5 : 1,
    fontFamily: MONO,
    fontSize: 10,
    color: selected ? "#f59e0b" : "#8b949e",
  });

  const pill = (active: boolean): React.CSSProperties => ({
    fontFamily: MONO,
    fontSize: 11,
    padding: "6px 14px",
    borderRadius: 4,
    border: `1px solid ${active ? "#f59e0b" : "#21262d"}`,
    color: active ? "#f59e0b" : "#8b949e",
    background: "transparent",
    cursor: "pointer",
  });

  return (
    <div style={cardStyle}>
      <h2 style={sectionHeading}>Appearance</h2>

      <p style={{ ...labelStyle, marginTop: 4 }}>theme</p>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <div style={themeCard(true, false, "dark")}>dark</div>
        <div style={themeCard(false, true, "light")}>light (coming soon)</div>
      </div>

      <p style={labelStyle}>font size</p>
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {(["small", "default", "large"] as const).map((s) => (
          <button key={s} onClick={() => applyFontSize(s)} style={pill(fontSize === s)}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "#8b949e" }}>Reduce motion</span>
        <Toggle enabled={reduceMotion} onChange={applyReduceMotion} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "#8b949e" }}>Collapsed sidebar by default</span>
        <Toggle enabled={sidebarCollapsed} onChange={applySidebar} />
      </div>
    </div>
  );
}

// ─── privacy ─────────────────────────────────────────────────────────────────

function PrivacySection({ initialVisible }: { initialVisible: boolean }) {
  const [visible, setVisible] = useState(initialVisible);
  const [expanded, setExpanded] = useState(false);
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
    <div style={cardStyle}>
      <h2 style={sectionHeading}>Privacy</h2>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", marginBottom: 16 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "#8b949e" }}>Show my profile to other members</span>
        <Toggle enabled={visible} onChange={saveVisibility} />
      </div>

      <button
        onClick={downloadData}
        disabled={exporting}
        style={{
          background: "transparent",
          border: "1px solid #21262d",
          color: "#8b949e",
          fontFamily: MONO,
          fontSize: 11,
          padding: "9px 16px",
          borderRadius: 4,
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        {exporting ? "preparing…" : "Download my data"}
      </button>

      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            color: "#8b949e",
            fontFamily: MONO,
            fontSize: 11,
            cursor: "pointer",
            padding: 0,
          }}
        >
          {expanded ? "▾" : "▸"} What data we store
        </button>
        {expanded && (
          <p style={{ fontFamily: SANS, fontSize: 13, color: "#6e7681", marginTop: 10, lineHeight: 1.7 }}>
            We store your profile info, posts and replies, messages, usage data, and login events.
          </p>
        )}
      </div>
    </div>
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
    setMsg(error ? "could not leave cohort" : "you have left your cohort");
  }

  async function deleteAccount() {
    setModal(null);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      router.push("/login");
      router.refresh();
    } else {
      setMsg("could not delete account — contact support");
    }
  }

  const dangerBtn: React.CSSProperties = {
    border: "1px solid #f85149",
    color: "#f85149",
    background: "transparent",
    fontFamily: MONO,
    fontSize: 11,
    padding: "9px 16px",
    borderRadius: 4,
    cursor: "pointer",
  };

  return (
    <div style={{ ...cardStyle, border: "1px solid rgba(248,81,73,0.2)", background: "rgba(248,81,73,0.02)" }}>
      <h2 style={{ ...sectionHeading, color: "#f85149" }}>Danger Zone</h2>

      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: SANS, fontSize: 14, color: "#8b949e", marginBottom: 10 }}>
          Remove yourself from your current cohort. You can join a new one.
        </p>
        <button onClick={() => setModal("leave")} style={dangerBtn}>
          Leave cohort
        </button>
      </div>

      <div>
        <p style={{ fontFamily: SANS, fontSize: 14, color: "#8b949e", marginBottom: 10 }}>
          Permanently delete your account and all your data. This cannot be undone.
        </p>
        <button onClick={() => setModal("delete")} style={dangerBtn}>
          Delete account
        </button>
      </div>

      {msg && <p style={{ fontFamily: MONO, fontSize: 11, color: "#8b949e", marginTop: 16 }}>{msg}</p>}

      {modal === "leave" && (
        <ConfirmModal
          heading="Are you sure?"
          description="You'll be removed from your current cohort and lose access to its private room. You can join a new cohort later."
          confirmLabel="Leave cohort"
          onConfirm={leaveCohort}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === "delete" && (
        <ConfirmModal
          heading="Are you sure?"
          description="This permanently deletes your account and all of your data. This cannot be undone."
          confirmLabel="Delete account"
          requireText="DELETE"
          onConfirm={deleteAccount}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
