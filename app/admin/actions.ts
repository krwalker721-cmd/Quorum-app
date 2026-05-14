"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "quorum_admin";
const SESSION_HOURS = 4;

export async function unlockAdmin(formData: FormData) {
  const code = (formData.get("code") ?? "").toString();
  const expected = process.env.ADMIN_CODE;

  if (!expected || code !== expected) {
    redirect("/admin?error=1");
  }

  // Clear any legacy cookie pinned to /admin (left over from before the path fix)
  // so the browser doesn't keep sending two values.
  cookies().set({
    name: COOKIE_NAME,
    value: "",
    path: "/admin",
    maxAge: 0,
  });

  cookies().set(COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * SESSION_HOURS,
    path: "/",
  });

  redirect("/admin");
}

export async function lockAdmin() {
  cookies().set({ name: COOKIE_NAME, value: "", path: "/admin", maxAge: 0 });
  cookies().set({ name: COOKIE_NAME, value: "", path: "/", maxAge: 0 });
  redirect("/admin");
}
