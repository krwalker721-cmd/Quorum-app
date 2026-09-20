import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CohortNav from "@/components/cohort/CohortNav";
import NoGrid from "@/components/ui/NoGrid";
import ui from "@/components/ui/sleek.module.css";
import CreateCohortForm from "./CreateCohortForm";

export const dynamic = "force-dynamic";

export default async function CreateCohortPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("tier").eq("id", user.id).single();

  return (
    <>
      <NoGrid />
      <TopBar sleek title="cohort" tier={(profile?.tier ?? "free").toUpperCase()} userId={user.id} />
      <CohortNav />
      <section className="max-w-xl mx-auto px-6 py-10">
        <h1
          className={ui.titleGradient}
          style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
        >
          Create a cohort
        </h1>
        <p className="text-text-secondary mt-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Name your cohort, write a short description, and choose whether anyone can request to join.
        </p>
        <div className="mt-6">
          <CreateCohortForm userId={user.id} />
        </div>
      </section>
    </>
  );
}
