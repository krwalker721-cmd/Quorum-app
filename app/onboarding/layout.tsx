import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Standalone onboarding shell — no sidebar, topbar, or app chrome. Full-screen
// dark canvas; the fonts come from the root layout's CSS variables, so there is
// no need to re-import them here.
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If onboarding is already complete, skip straight to the app. Fail open
  // (render onboarding) if the table can't be read yet — e.g. the migration
  // hasn't been applied in a fresh environment. NOTE: redirect() throws, so it
  // must be called outside the try/catch or the catch would swallow it.
  let completed = false;
  try {
    const { data } = await supabase
      .from("onboarding_progress")
      .select("completed")
      .eq("user_id", user.id)
      .maybeSingle();
    completed = Boolean(data?.completed);
  } catch {
    completed = false;
  }
  if (completed) redirect("/home");

  return (
    <div style={{ minHeight: "100vh", margin: 0, padding: 0, background: "#0d1117" }}>
      {children}
    </div>
  );
}
