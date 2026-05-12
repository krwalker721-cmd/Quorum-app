import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CohortNav from "@/components/cohort/CohortNav";
import InviteForm from "./InviteForm";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("tier").eq("id", user.id).single();

  const { data: memberships } = await supabase
    .from("cohort_members")
    .select("cohort_id, cohorts:cohort_id (id, name)")
    .eq("user_id", user.id);

  type Row = { cohort_id: string; cohorts: { id: string; name: string } | null };
  const cohorts =
    (memberships as Row[] | null)
      ?.map((m) => m.cohorts)
      .filter((c): c is { id: string; name: string } => Boolean(c)) ?? [];

  return (
    <>
      <TopBar title="cohort" tier={(profile?.tier ?? "free").toUpperCase()} userId={user.id} />
      <CohortNav />
      <section className="max-w-xl mx-auto px-6 py-10">
        <p className="font-mono lowercase text-[0.65rem] text-text-faint">cohort/invite</p>
        <h1 className="font-sans lowercase text-text-primary text-2xl mt-1">invite to a cohort</h1>
        <p className="text-text-muted text-sm mt-2">
          generate an invite link or send to an email. only cohorts you belong to can be invited to.
        </p>

        {cohorts.length === 0 ? (
          <p className="font-mono lowercase text-xs text-text-faint mt-6">
            you&apos;re not in any cohorts yet. create one or join one from{" "}
            <a className="text-amber hover:underline" href="/cohort/browse">browse</a>.
          </p>
        ) : (
          <div className="mt-6">
            <InviteForm cohorts={cohorts} userId={user.id} />
          </div>
        )}
      </section>
    </>
  );
}
