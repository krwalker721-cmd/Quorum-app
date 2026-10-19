"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sayBuildathon } from "./defaults";

// The join queue's writes, straight to Supabase as the signed-in member (the
// same pattern as the Collab Board). The database enforces every rule; its
// error messages are written for people, so they're shown as they come.

type Result = { error: { message: string } | null };

export const sprintDb = () => createClient();

/**
 * The browser client with its realtime connection signed in as the member.
 * Without this the socket can join before the session is loaded from the
 * cookies and stay anonymous, and then RLS quietly filters out every event
 * (checked on staging, 2026-09-29). Call before subscribing.
 */
export async function realtimeDb() {
  const db = createClient();
  const {
    data: { session },
  } = await db.auth.getSession();
  if (session) await db.realtime.setAuth(session.access_token);
  return db;
}

/** Register, or come back after withdrawing (registration must be open). */
export async function register(hackathonId: string, userId: string, mode: "random" | "team"): Promise<Result> {
  const db = sprintDb();
  const { data: existing } = await db
    .from("hackathon_registrations")
    .select("id, withdrawn_at, mode")
    .eq("hackathon_id", hackathonId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) {
    return db.from("hackathon_registrations").insert({ hackathon_id: hackathonId, user_id: userId, mode });
  }
  if (existing.withdrawn_at || existing.mode !== mode) {
    return db.from("hackathon_registrations").update({ withdrawn_at: null, mode }).eq("id", existing.id);
  }
  return { error: null };
}

export function setMode(hackathonId: string, userId: string, mode: "random" | "team"): PromiseLike<Result> {
  return sprintDb().from("hackathon_registrations").update({ mode }).eq("hackathon_id", hackathonId).eq("user_id", userId);
}

export function withdraw(hackathonId: string, userId: string): PromiseLike<Result> {
  return sprintDb()
    .from("hackathon_registrations")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("hackathon_id", hackathonId)
    .eq("user_id", userId);
}

export function rpc(fn: string, args: Record<string, unknown>): PromiseLike<Result & { data: unknown }> {
  return sprintDb().rpc(fn, args);
}

/**
 * Runs one action at a time, shows the database's message if it fails, and
 * reloads the page's data when it succeeds.
 */
export function useSprintAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(f: () => PromiseLike<Result> | Promise<Result>, after?: () => void): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const { error: e } = await f();
      if (e) {
        setError(sayBuildathon(e.message));
        return false;
      }
      after?.();
      router.refresh();
      return true;
    } catch {
      setError("That didn't go through. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, run };
}
