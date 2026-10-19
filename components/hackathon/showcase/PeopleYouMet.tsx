import Link from "next/link";
import Tile from "@/components/ui/Tile";
import PersonAvatar from "@/components/ui/PersonAvatar";
import type { ArenaPerson } from "@/lib/hackathons/page";

// After the reveal, for someone who took part (owner, 2026-10-18: the point
// is building with others and the connections that come from it): the people
// they built with, and the builders whose projects they reviewed, each a
// click from their profile or a message.

export type MetGroup = { label: string; people: ArenaPerson[] };

export default function PeopleYouMet({ groups }: { groups: MetGroup[] }) {
  const shown = groups.filter((g) => g.people.length > 0);
  if (shown.length === 0) return null;
  return (
    <Tile kicker="People you met" style={{ marginBottom: 20 }} padding="14px 16px 16px">
      <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
        The Buildathon is over; the people stay. Say thanks, ask what they&rsquo;d build next.
      </p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px 24px" }}>
        {shown.map((g) => (
          <div key={g.label} className="min-w-0">
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>{g.label}</p>
            <ul className="flex flex-col" style={{ gap: 8 }}>
              {g.people.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5">
                  <PersonAvatar name={p.full_name} stage={p.stage} username={p.username} size={26} />
                  {p.username ? (
                    <Link href={`/profile/${p.username}`} className="min-w-0 flex-1 truncate" style={{ fontSize: 13, color: "var(--text-primary)", textDecoration: "none" }}>
                      {p.full_name ?? p.username}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      {p.full_name ?? "Founder"}
                    </span>
                  )}
                  <Link href={`/messages?to=${p.id}`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
                    Message
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Tile>
  );
}
