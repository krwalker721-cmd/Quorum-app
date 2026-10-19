"use client";

const SESSION_KEY = "quorum_admin_session";
const SESSION_HOURS = 24;

type AdminSession = { code: string; expiresAt: number };

export function loadSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AdminSession;
    if (!s.code || !s.expiresAt) return null;
    if (Date.now() > s.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveSession(code: string) {
  if (typeof window === "undefined") return;
  const s: AdminSession = { code, expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000 };
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const s = loadSession();
  const headers = new Headers(init.headers);
  if (s) headers.set("x-admin-code", s.code);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(path, { ...init, headers });
}

export type AdminGate = "ok" | "wrong_code" | "locked" | "sign_in" | "not_admin";

/** Sign in to the console: needs an admin Quorum account AND the code. */
export async function verifyCode(code: string): Promise<AdminGate> {
  const res = await fetch("/api/admin/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (res.ok) return "ok";
  const json = await res.json().catch(() => ({}));
  return (json.reason as AdminGate) ?? (res.status === 429 ? "locked" : "wrong_code");
}

/** Whether the saved session still passes both locks, and whose it is. */
export async function whoAmI(): Promise<{ gate: AdminGate; name?: string }> {
  const res = await adminFetch("/api/admin/verify");
  const json = await res.json().catch(() => ({}));
  if (res.ok) return { gate: "ok", name: json.name };
  return { gate: (json.reason as AdminGate) ?? "wrong_code" };
}
