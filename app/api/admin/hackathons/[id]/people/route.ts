import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/admin/db";
import { dbErrorResponse, guard } from "@/lib/admin/hackathons";

type Ctx = { params: Promise<{ id: string }> };

// Participants, judges and the lobby: the people side of a Sprint.
export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const op = String(b.op ?? "");
  const read = createAdminClient();

  const personName = async (userId: unknown) => {
    const { data } = await read.from("profiles").select("full_name, username").eq("id", String(userId)).maybeSingle();
    return data?.full_name?.trim() || data?.username || "someone";
  };
  const ok = (r: { error: unknown }) =>
    r.error ? dbErrorResponse(r.error as { message: string; hint?: string }) : NextResponse.json({ ok: true });

  switch (op) {
    // Withdrawing takes them off their team too (migration 018).
    case "withdraw": {
      const who = await personName(b.user_id);
      return ok(
        await adminDb(g.admin, `Withdrew ${who} from the Sprint`)
          .from("hackathon_registrations")
          .update({ withdrawn_at: new Date().toISOString() })
          .eq("hackathon_id", id)
          .eq("user_id", String(b.user_id))
          .is("withdrawn_at", null),
      );
    }

    // Judges: an existing member, or an email for someone without an account
    // yet (linked to an account later, in Prompt 9). A registered participant
    // is refused by the database; the screen offers to withdraw them first.
    case "judge_add_member": {
      const who = await personName(b.user_id);
      return ok(
        await adminDb(g.admin, `Made ${who} a judge`)
          .from("hackathon_judges")
          .insert({ hackathon_id: id, user_id: String(b.user_id), accepted_at: b.accepted ? new Date().toISOString() : null }),
      );
    }
    case "judge_invite_email": {
      const email = String(b.email ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
      return ok(await adminDb(g.admin, `Invited ${email} to judge`).from("hackathon_judges").insert({ hackathon_id: id, invite_email: email }));
    }
    case "judge_accept":
      return ok(
        await adminDb(g.admin, "Marked a judge as accepted")
          .from("hackathon_judges")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", String(b.judge_id))
          .eq("hackathon_id", id),
      );
    case "judge_remove":
      return ok(
        await adminDb(g.admin, "Removed a judge").from("hackathon_judges").delete().eq("id", String(b.judge_id)).eq("hackathon_id", id),
      );

    // Lobby moderation. Deleting blanks the message for good.
    case "lobby_pin":
    case "lobby_unpin":
      return ok(
        await adminDb(g.admin, op === "lobby_pin" ? "Pinned a lobby message" : "Unpinned a lobby message")
          .from("hackathon_lobby_messages")
          .update({ is_pinned: op === "lobby_pin" })
          .eq("id", String(b.message_id))
          .eq("hackathon_id", id),
      );
    case "lobby_delete":
      return ok(
        await adminDb(g.admin, "Deleted a lobby message")
          .from("hackathon_lobby_messages")
          .update({ deleted_at: new Date().toISOString(), is_pinned: false })
          .eq("id", String(b.message_id))
          .eq("hackathon_id", id),
      );

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
