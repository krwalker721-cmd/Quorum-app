import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CohortNav from "@/components/cohort/CohortNav";
import NoGrid from "@/components/ui/NoGrid";
import ui from "@/components/ui/sleek.module.css";
import InviteForm from "./InviteForm";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("tier").eq("id", user.id).single();

  const { data: memberships } = await supabase
    .from("cohort_members")
    .select("cohort_id")
    .eq("user_id", user.id);

  const cohortIds =
    (memberships ?? []).map((m: any) => m.cohort_id).filter(Boolean) as string[];

  let cohorts: { id: string; name: string }[] = [];
  if (cohortIds.length > 0) {
    const { data: cohortRows } = await supabase
      .from("cohorts")
      .select("id, name")
      .in("id", cohortIds);
    cohorts = (cohortRows ?? []) as { id: string; name: string }[];
  }

  return (
    <>
      <NoGrid />
      <TopBar sleek title="cohort" tier={(profile?.tier ?? "free").toUpperCase()} userId={user.id} />
      <CohortNav />
      <section className="max-w-xl mx-auto px-6 py-10">
        <h1
          className={ui.titleGradient}
          style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
        >
          Invite to a cohort
        </h1>
        <p className="text-text-secondary mt-2" style={{ fontSize: 14, lineHeight: 1.6 }}>
          Create an invite link to share. You can only invite people to cohorts you belong to.
        </p>

        {cohorts.length === 0 ? (
          <p className="text-text-secondary mt-6" style={{ fontSize: 14 }}>
            You&apos;re not in any cohorts yet. Create one, or join one from{" "}
            <Link className="text-amber hover:underline" href="/cohort/browse">
              Browse
            </Link>
            .
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
