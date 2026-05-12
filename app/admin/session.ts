import { cookies } from "next/headers";

const COOKIE_NAME = "quorum_admin";

export function isAdminUnlocked() {
  return cookies().get(COOKIE_NAME)?.value === "1";
}
