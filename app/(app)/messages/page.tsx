import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import MessagesClient from "@/components/messages/MessagesClient";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: { to?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, content, created_at, read")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(500);

  const partnerIds = new Set<string>();
  for (const m of msgs ?? []) {
    const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    if (other) partnerIds.add(other);
  }
  if (searchParams.to) partnerIds.add(searchParams.to);

  const ids = Array.from(partnerIds);
  const { data: partners } =
    ids.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, stage, username")
          .in("id", ids)
      : { data: [] as any[] };

  // Build conversation rows
  const byPartner = new Map<
    string,
    { last: string; lastAt: string; unread: boolean }
  >();
  for (const m of msgs ?? []) {
    const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    if (!other) continue;
    if (byPartner.has(other)) continue; // first one is most recent
    byPartner.set(other, {
      last: m.content,
      lastAt: m.created_at,
      unread: m.recipient_id === user.id && !m.read,
    });
  }

  const conversations = (partners ?? []).map((p: any) => ({
    partner: p,
    last: byPartner.get(p.id)?.last ?? null,
    lastAt: byPartner.get(p.id)?.lastAt ?? null,
    unread: byPartner.get(p.id)?.unread ?? false,
  }));

  // Sort by lastAt desc, conversations with no messages last
  conversations.sort((a, b) => {
    if (!a.lastAt && !b.lastAt) return 0;
    if (!a.lastAt) return 1;
    if (!b.lastAt) return -1;
    return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
  });

  return (
    <>
      <TopBar title="messages" tier={(profile?.tier ?? "free").toUpperCase()} userId={user.id} />
      <MessagesClient
        currentUserId={user.id}
        conversations={conversations}
        initialPartnerId={searchParams.to ?? null}
      />
    </>
  );
}
