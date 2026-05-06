import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoMark from "@/components/LogoMark";
import SignOutButton from "@/components/SignOutButton";
import { WAITLIST_ENABLED } from "@/lib/flags";

export default async function PendingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!WAITLIST_ENABLED) redirect("/home");

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.status === "approved") redirect("/home");

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-8">
          <LogoMark size={56} />
        </div>
        <h1 className="font-mono lowercase text-text-primary text-xl tracking-wide">quorum</h1>
        <p className="font-mono lowercase text-text-faint text-xs mt-2">access request received</p>

        <div className="bg-card border border-border p-8 mt-10">
          <p className="text-text-secondary text-base">
            you&apos;re on the list.
          </p>
          <p className="text-text-muted text-sm mt-3">
            we&apos;ll be in touch within 48 hours.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
