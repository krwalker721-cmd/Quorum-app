import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CohortNav from "@/components/cohort/CohortNav";
import NoGrid from "@/components/ui/NoGrid";
import ui from "@/components/ui/sleek.module.css";
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
  const supabase = await createClient();
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
  // The empty state keys off the open list. It used to key off every cohort,
  // so a platform whose cohorts were all invite-only showed a blank page.
  const open = ((cohorts ?? []) as Cohort[]).filter((c) => c.is_open);

  return (
    <>
      <NoGrid />
      <TopBar sleek title="cohort" tier={(profile?.tier ?? "free").toUpperCase()} userId={user.id} />
      <CohortNav />
      <section className="max-w-3xl mx-auto px-6 py-10">
        <h1
          className={ui.titleGradient}
          style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
        >
          Open cohorts
        </h1>
        <p className="text-text-secondary mt-2" style={{ fontSize: 13 }}>
          Request to join any open cohort.
        </p>

        <div className="space-y-3 mt-6">
          {open.length === 0 && (
            <div className={`${ui.tile} text-center`} style={{ padding: "28px 22px" }}>
              <p className={ui.emptyTitle}>No open cohorts right now.</p>
              <p className={ui.emptySub}>Create one, or ask a member for an invite link.</p>
            </div>
          )}
          {open.map((c) => {
            const status = requestMap.get(c.id);
            const isMember = memberSet.has(c.id);
            return (
              <div
                key={c.id}
                className={`${ui.tile} flex items-start justify-between gap-6`}
                style={{ padding: "18px 20px" }}
              >
                <div className="min-w-0">
                  <p className="text-text-primary" style={{ fontSize: 14.5, fontWeight: 500 }}>
                    {c.name}
                  </p>
                  <p className="text-text-secondary mt-1" style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {c.description ?? "No description yet."}
                  </p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}>
                    Open · started{" "}
                    {new Date(c.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
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
