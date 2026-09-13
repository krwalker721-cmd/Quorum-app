import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoMark from "@/components/LogoMark";
import SignOutButton from "@/components/SignOutButton";
import { isWaitlistOn } from "@/lib/platform";

export default async function PendingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  // With open signup there's no waiting room; the app layout approves them.
  if (!(await isWaitlistOn())) redirect("/home");

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
            quorum admits founders in groups of twelve, so every cohort starts
            full. we&apos;ll email you when your group opens.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
