import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import SettingsBilling from "@/components/SettingsBilling";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();
  const tier = (profile?.tier ?? "free") as string;

  return (
    <>
      <TopBar title="settings" tier={tier.toUpperCase()} userId={user.id} />
      <section className="max-w-3xl mx-auto px-6 py-10">
        <p
          className="font-mono uppercase"
          style={{ fontSize: 10, color: "var(--accent)", letterSpacing: "0.12em", marginBottom: 10 }}
        >
          // account settings
        </p>
        <h1
          className="font-sans"
          style={{ fontSize: 28, color: "var(--text-primary)", marginBottom: 28 }}
        >
          Settings
        </h1>
        <SettingsBilling />
      </section>
    </>
  );
}
