import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthShell, { AUTH_CARD } from "@/components/AuthShell";
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

  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <AuthShell
      title="You're on the list"
      subtitle={firstName ? `Thanks, ${firstName}. Your request is in.` : "Your request is in."}
      footer={<SignOutButton />}
    >
      <div style={{ ...AUTH_CARD, textAlign: "center" }}>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-primary)" }}>
          Quorum admits founders in groups of twelve, so every cohort starts full.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", marginTop: 8 }}>
          We&apos;ll email you when your group opens.
        </p>
      </div>
    </AuthShell>
  );
}
