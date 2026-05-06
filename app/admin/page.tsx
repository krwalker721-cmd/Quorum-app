import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import LogoMark from "@/components/LogoMark";
import SignOutButton from "@/components/SignOutButton";
import ApproveButton from "./ApproveButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Use service role to read all pending profiles regardless of RLS.
  const admin = createAdminClient();
  const { data: pending, error } = await admin
    .from("profiles")
    .select("id, full_name, email, what_they_are_building, stage, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <main className="min-h-screen">
      <nav className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={24} />
            <span className="font-mono lowercase text-text-primary text-sm tracking-wide">quorum / admin</span>
          </div>
          <SignOutButton />
        </div>
      </nav>

      <section className="max-w-5xl mx-auto px-6 py-12">
        <p className="font-mono lowercase text-xs text-text-faint">waitlist</p>
        <h1 className="font-sans text-2xl text-text-primary mt-2 lowercase">pending users</h1>

        {error && (
          <p className="font-mono text-xs text-red-400 lowercase mt-6">{error.message}</p>
        )}

        <div className="mt-8 space-y-3">
          {pending && pending.length > 0 ? (
            pending.map((p) => (
              <div
                key={p.id}
                className="bg-card border border-border p-5 flex items-start justify-between gap-6"
              >
                <div className="min-w-0">
                  <p className="text-text-primary text-sm">{p.full_name}</p>
                  <p className="font-mono text-xs text-text-faint mt-1 lowercase">{p.email}</p>
                  <p className="text-text-muted text-sm mt-3 truncate">{p.what_they_are_building}</p>
                  <p className="font-mono lowercase text-xs text-text-faint mt-2">stage: {p.stage}</p>
                </div>
                <ApproveButton id={p.id} />
              </div>
            ))
          ) : (
            <p className="font-mono lowercase text-xs text-text-faint">no pending users.</p>
          )}
        </div>
      </section>
    </main>
  );
}
