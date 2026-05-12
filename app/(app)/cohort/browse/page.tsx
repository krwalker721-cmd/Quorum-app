import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CohortNav from "@/components/cohort/CohortNav";
import RequestJoinButton from "./RequestJoinButton";

export const dynamic = "force-dynamic";

type Cohort = {
  id: string;
  name: string;
  description: string | null;
  is_open: boolean;
  creator_id: string | null;
  created_at: string;
};

export default async function BrowseCohortsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("tier").eq("id", user.id).single();

  const { data: cohorts } = await supabase
    .from("cohorts")
    .select("id, name, description, is_open, creator_id, created_at")
    .order("created_at", { ascending: false });

  const { data: myRequests } = await supabase
    .from("cohort_join_requests")
    .select("cohort_id, status")
    .eq("user_id", user.id);

  const { data: myMemberships } = await supabase
    .from("cohort_members")
    .select("cohort_id")
    .eq("user_id", user.id);

  const requestMap = new Map((myRequests ?? []).map((r) => [r.cohort_id, r.status]));
  const memberSet = new Set((myMemberships ?? []).map((m) => m.cohort_id));

  return (
    <>
      <TopBar title="cohort" tier={(profile?.tier ?? "free").toUpperCase()} userId={user.id} />
      <CohortNav />
      <section className="max-w-3xl mx-auto px-6 py-10">
        <p className="font-mono lowercase text-[0.65rem] text-text-faint">cohort/browse</p>
        <h1 className="font-sans lowercase text-text-primary text-2xl mt-1">open cohorts</h1>
        <p className="text-text-muted text-sm mt-2">request to join any open cohort.</p>

        <div className="space-y-3 mt-6">
          {(!cohorts || cohorts.length === 0) && (
            <p className="font-mono lowercase text-xs text-text-faint">no cohorts yet.</p>
          )}
          {(cohorts as Cohort[] | null)?.filter((c) => c.is_open).map((c) => {
            const status = requestMap.get(c.id);
            const isMember = memberSet.has(c.id);
            return (
              <div
                key={c.id}
                className="p-5 border flex items-start justify-between gap-6"
                style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
              >
                <div className="min-w-0">
                  <p className="font-sans lowercase text-text-primary text-base">{c.name.toLowerCase()}</p>
                  <p className="text-text-muted text-sm mt-1">{c.description ?? "—"}</p>
                  <p className="font-mono lowercase text-[0.6rem] text-text-faint mt-2">
                    open · {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <RequestJoinButton
                  cohortId={c.id}
                  userId={user.id}
                  isMember={isMember}
                  status={status ?? null}
                />
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
