import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import LogoMark from "@/components/LogoMark";

export const dynamic = "force-dynamic";

export default async function InviteRedeemPage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${params.token}`);

  // Look up invite via admin client so a non-member can read it.
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("cohort_invites")
    .select("id, cohort_id, used_by, used_at, expires_at")
    .eq("token", params.token)
    .single();

  if (!invite) {
    return <InviteStatus title="invalid invite" body="that link doesn't match any invite." />;
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return <InviteStatus title="invite expired" body="this invite is no longer valid." />;
  }

  if (invite.used_by && invite.used_by !== user.id) {
    return <InviteStatus title="invite already used" body="this link has already been claimed by someone else." />;
  }

  // Join cohort + mark invite consumed (via admin so it works even on first contact).
  await admin
    .from("cohort_members")
    .upsert(
      { user_id: user.id, cohort_id: invite.cohort_id },
      { onConflict: "user_id,cohort_id", ignoreDuplicates: true }
    );

  if (!invite.used_by) {
    await admin
      .from("cohort_invites")
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq("id", invite.id);
  }

  redirect("/cohort");
}

function InviteStatus({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <LogoMark size={44} />
        </div>
        <h1 className="font-mono lowercase text-text-primary text-base">{title}</h1>
        <p className="text-text-muted text-sm mt-3">{body}</p>
        <a href="/home" className="font-mono lowercase text-amber text-xs hover:underline inline-block mt-6">
          back to home
        </a>
      </div>
    </main>
  );
}
