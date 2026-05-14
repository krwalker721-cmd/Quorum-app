import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/server";

export default async function TopContributors() {
  const supabase = createClient();
  const { data: posts } = await supabase
    .from("vault_posts")
    .select("author_id");

  const counts: Record<string, number> = {};
  for (const p of posts ?? []) {
    if (!p.author_id) continue;
    counts[p.author_id] = (counts[p.author_id] ?? 0) + 1;
  }
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const ids = top.map(([id]) => id);
  const { data: authors } = ids.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, stage, username")
        .in("id", ids)
    : { data: [] as any[] };
  const map = new Map((authors ?? []).map((a: any) => [a.id, a]));

  return (
    <div
      className="p-4 border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
    >
      <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
        top_contributors
      </p>
      <div className="space-y-2.5">
        {top.length === 0 ? (
          <p className="font-mono lowercase text-[0.7rem] text-text-faint">no contributors yet.</p>
        ) : (
          top.map(([id, count]) => {
            const a: any = map.get(id);
            return (
              <div key={id} className="flex items-center gap-2.5">
                <Avatar
                  name={a?.full_name}
                  stage={a?.stage}
                  username={a?.username}
                  size={22}
                />
                <span className="font-mono lowercase text-[0.7rem] text-text-secondary truncate flex-1">
                  {a?.full_name?.toLowerCase() ?? "—"}
                </span>
                <span className="font-mono lowercase text-[0.6rem] text-text-faint">
                  {count} {count === 1 ? "post" : "posts"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
