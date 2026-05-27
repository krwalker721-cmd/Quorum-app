import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import LogoMark from "@/components/LogoMark";

export const dynamic = "force-dynamic";

export default async function JoinCohortPage({
  params,
}: {
  params: { cohort_id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/join/cohort/${params.cohort_id}`);

  const admin = createAdminClient();
  const { data: cohort } = await admin
    .from("cohorts")
    .select("id, name")
    .eq("id", params.cohort_id)
    .single();

  if (!cohort) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <LogoMark size={44} />
          </div>
          <h1 className="font-mono lowercase text-text-primary text-base">
            cohort not found
          </h1>
          <p className="text-text-muted text-sm mt-3">
            that invite link doesn&apos;t match a cohort.
          </p>
          <a
            href="/home"
            className="font-mono lowercase text-amber text-xs hover:underline inline-block mt-6"
          >
            back to home
          </a>
        </div>
      </main>
    );
  }

  await admin
    .from("cohort_members")
    .upsert(
      { user_id: user.id, cohort_id: cohort.id },
      { onConflict: "user_id,cohort_id", ignoreDuplicates: true },
    );

  redirect("/cohort");
}
