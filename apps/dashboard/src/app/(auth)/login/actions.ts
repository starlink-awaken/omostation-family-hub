"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE_NAME,
  getConfiguredPassword,
  getCookieTtlDays,
  sanitizeNextPath,
  signAuthCookie,
} from "@/lib/auth";

export async function loginAction(formData: FormData): Promise<void> {
  const configured = getConfiguredPassword();
  const password = String(formData.get("password") || "");
  const nextRaw = formData.get("next");
  const nextPath = sanitizeNextPath(nextRaw) || "/";

  if (!configured) {
    redirect(`/login?error=missing_config&next=${encodeURIComponent(nextPath)}`);
  }

  if (password !== configured) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(nextPath)}`);
  }

  const ttlDays = getCookieTtlDays();
  const expires = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, signAuthCookie(), {
    httpOnly: true,
    sameSite: "lax",
    expires,
    path: "/",
  });

  redirect(nextPath);
}
