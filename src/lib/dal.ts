import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { decrypt, getSessionCookie } from "@/lib/session";

/**
 * The real authorization boundary — call at the top of every Route Handler
 * and protected page/layout that touches user data. Redirects to /login if
 * the session is missing or invalid. Wrapped in `cache()` so repeated calls
 * within one render pass only decrypt the cookie once.
 */
export const verifySession = cache(async () => {
  const cookie = await getSessionCookie();
  const session = await decrypt(cookie);

  if (!session?.email) {
    redirect("/login");
  }

  return { isAuth: true, email: session.email };
});
