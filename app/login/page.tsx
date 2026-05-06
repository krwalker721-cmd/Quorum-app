"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LogoMark from "@/components/LogoMark";
import { WAITLIST_ENABLED } from "@/lib/flags";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message.toLowerCase());
      setLoading(false);
      return;
    }

    if (!WAITLIST_ENABLED) {
      router.push("/home");
      router.refresh();
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user!.id)
      .single();

    router.push(profile?.status === "approved" ? "/home" : "/pending");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <LogoMark size={44} />
          <h1 className="font-mono lowercase text-text-primary text-lg mt-4 tracking-wide">quorum</h1>
          <p className="font-mono lowercase text-text-faint text-xs mt-1">log in</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border p-6 space-y-4">
          <div>
            <label>email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label>password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && <p className="font-mono text-xs text-red-400 lowercase">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-mono lowercase text-xs py-2.5 bg-amber text-bg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "..." : "log in"}
          </button>
        </form>

        <p className="font-mono text-xs text-text-faint lowercase text-center mt-6">
          no account?{" "}
          <Link href="/signup" className="text-amber hover:underline">request access</Link>
        </p>
      </div>
    </main>
  );
}
