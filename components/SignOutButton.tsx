"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="font-mono text-xs lowercase px-3 py-1.5 border border-border text-text-muted hover:text-text-primary hover:border-amber transition-colors"
    >
      sign out
    </button>
  );
}
