import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";

export const dynamic = "force-dynamic";

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase.from("profiles").select("tier").eq("id", user.id).single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, stage, what_they_are_building, trust_score, created_at")
    .eq("username", params.username)
    .single();

  if (!profile) notFound();

  return (
    <>
      <TopBar title="profile" tier={(me?.tier ?? "free").toUpperCase()} userId={user.id} />
      <section className="max-w-3xl mx-auto px-6 py-10">
        <div
          className="p-6 border flex items-start gap-5"
          style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        >
          <Avatar name={profile.full_name} stage={profile.stage} size={72} />
          <div className="flex-1 min-w-0">
            <h1 className="font-sans lowercase text-text-primary text-2xl">
              {profile.full_name?.toLowerCase() ?? "—"}
            </h1>
            <p className="font-mono lowercase text-[0.7rem] text-text-faint mt-1">@{profile.username}</p>
            <div className="mt-3"><StagePill stage={profile.stage} /></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-card border border-border p-5">
            <p className="font-mono lowercase text-[0.65rem] text-text-faint">building</p>
            <p className="text-text-secondary text-sm mt-2">
              {profile.what_they_are_building ?? "—"}
            </p>
          </div>
          <div className="bg-card border border-border p-5">
            <p className="font-mono lowercase text-[0.65rem] text-text-faint">trust_score</p>
            <p className="font-mono text-amber text-sm mt-2">{profile.trust_score ?? 0}</p>
          </div>
          <div className="bg-card border border-border p-5">
            <p className="font-mono lowercase text-[0.65rem] text-text-faint">joined</p>
            <p className="font-mono lowercase text-text-secondary text-sm mt-2">
              {formatDate(profile.created_at)}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
