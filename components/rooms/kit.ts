// Shared by the room UIs: the Collab Board's project room and the Hackathon
// team room. Moved here unchanged from components/collab/ProjectRoomClient.tsx.
import type { CSSProperties } from "react";

export const META: CSSProperties = { fontSize: 11.5, color: "var(--text-muted)" };

// A hairline panel that doesn't light up on hover (the thread, the forms):
// large surfaces you work inside, not cards you pick.
export const PANEL: CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  borderRadius: 12,
};

export type DecisionOption = string | { label: string };

export function optLabel(o: DecisionOption) {
  return typeof o === "string" ? o : o.label;
}

export function sentence(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function getDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
