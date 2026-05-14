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
  cookies().delete({ name: COOKIE_NAME, path: "/" });
  redirect("/admin");
}
