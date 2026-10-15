import { redirect } from "next/navigation";

// The lobby is the Sprint page's feed now (migration 034, 2026-10-14). Old
// links and bookmarks land there.
export default async function LobbyPage(props: { params: Promise<{ number: string }> }) {
  const { number } = await props.params;
  redirect(`/hackathon/${encodeURIComponent(number)}#feed`);
}
