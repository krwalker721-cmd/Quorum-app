import { cookies } from "next/headers";

const COOKIE_NAME = "quorum_admin";

export async function isAdminUnlocked() {
  return (await cookies()).get(COOKIE_NAME)?.value === "1";
}
