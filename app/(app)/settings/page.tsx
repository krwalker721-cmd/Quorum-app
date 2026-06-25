import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import SettingsClient from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, full_name, is_visible, notification_preferences")
    .eq("id", user.id)
    .single();

  const tier = (profile?.tier ?? "free") as string;

  return (
    <>
      <TopBar title="settings" tier={tier.toUpperCase()} userId={user.id} />
      <SettingsClient
        initialName={profile?.full_name ?? ""}
        initialEmail={user.email ?? ""}
        initialVisible={
          (profile as { is_visible?: boolean | null } | null)?.is_visible ?? true
        }
        initialNotificationPrefs={
          ((profile as { notification_preferences?: Record<string, boolean> | null } | null)
            ?.notification_preferences as Record<string, boolean> | null) ?? null
        }
      />
    </>
  );
}
