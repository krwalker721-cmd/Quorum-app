import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import CohortNav from "@/components/cohort/CohortNav";
import CreateCohortForm from "./CreateCohortForm";

export const dynamic = "force-dynamic";

export default async function CreateCohortPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("tier").eq("id", user.id).single();

  return (
    <>
      <TopBar title="cohort" tier={(profile?.tier ?? "free").toUpperCase()} userId={user.id} />
      <CohortNav />
      <section className="max-w-xl mx-auto px-6 py-10">
        <p className="font-mono lowercase text-[0.65rem] text-text-faint">cohort/create</p>
        <h1 className="font-sans lowercase text-text-primary text-2xl mt-1">create a cohort</h1>
        <p className="text-text-muted text-sm mt-2">
          name your cohort, write a short description, and choose whether anyone can request to join.
        </p>
        <div className="mt-6">
          <CreateCohortForm userId={user.id} />
        </div>
      </section>
    </>
  );
}
