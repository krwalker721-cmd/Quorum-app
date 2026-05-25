"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LogoMark from "@/components/LogoMark";
import { WAITLIST_ENABLED } from "@/lib/flags";

const STAGES = [
  { value: "idea", label: "idea" },
  { value: "pre-seed", label: "pre-seed" },
  { value: "seed", label: "seed" },
  { value: "series_a", label: "series a" },
];

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [building, setBuilding] = useState("");
  const [stage, setStage] = useState("idea");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (signUpError) {
      setError(signUpError.message.toLowerCase());
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setError("signup pending email confirmation. check your inbox.");
      setLoading(false);
      return;
    }

    const username =
      fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" +
      userId.slice(0, 4);

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: fullName,
      email,
      what_they_are_building: building,
      stage,
      status: WAITLIST_ENABLED ? "pending" : "approved",
      username,
    });

    if (profileError) {
      setError(profileError.message.toLowerCase());
      setLoading(false);
      return;
    }

    router.push(WAITLIST_ENABLED ? "/pending" : "/home");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <LogoMark size={44} />
          <h1 className="font-mono lowercase text-text-primary text-lg mt-4 tracking-wide">quorum</h1>
          <p className="font-mono lowercase text-text-faint text-xs mt-1">request access</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border p-6 space-y-4">
          <div>
            <label>full name</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label>email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label>password</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label>what are you building?</label>
            <input type="text" required maxLength={140} value={building} onChange={(e) => setBuilding(e.target.value)} />
          </div>
          <div>
            <label>current stage</label>
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="font-mono text-xs text-red-400 lowercase">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "..." : "request access"}
          </button>
        </form>

        <p className="font-mono text-xs text-text-faint lowercase text-center mt-6">
          already have an account?{" "}
          <Link href="/login" className="text-amber hover:underline">log in</Link>
        </p>
      </div>
    </main>
  );
}
