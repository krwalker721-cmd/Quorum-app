"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Returns true when the current viewer should see admin-only actions.
//
// A viewer counts as admin if EITHER:
//   - an unexpired admin session is present in localStorage (the admin console
//     login, key "quorum_admin_session"), OR
//   - their own profile row has is_admin = true.
//
// Reads are tolerant: a missing column or unauthenticated user resolves to
// false rather than throwing.
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    // 1. Admin console session (synchronous, no network).
    try {
      const raw = localStorage.getItem("quorum_admin_session");
      if (raw) {
        const s = JSON.parse(raw) as { code?: string; expiresAt?: number };
        if (s?.code && s?.expiresAt && Date.now() < s.expiresAt) {
          setIsAdmin(true);
          return;
        }
      }
    } catch {
      // ignore malformed session
    }

    // 2. profiles.is_admin for the signed-in user.
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();
        if (active && data?.is_admin === true) setIsAdmin(true);
      } catch {
        // column may not exist yet / request failed — treat as non-admin
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return isAdmin;
}
