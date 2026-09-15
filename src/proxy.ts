import { NextRequest, NextResponse } from "next/server";

import { decrypt } from "@/lib/session";

const protectedRoutes = ["/dashboard", "/products", "/billing", "/bills", "/reports"];
const publicRoutes = ["/login", "/"];

/**
 * Optimistic auth check only — reads the session cookie without hitting the
 * database, since this runs on every route including prefetches. Real
 * enforcement happens in `verifySession()` (see `src/lib/dal.ts`).
 * @param req - The incoming request, used to read the path and session cookie.
 */
const proxy = async (req: NextRequest) => {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );
  const isPublicRoute = publicRoutes.includes(path);

  const cookie = req.cookies.get("session")?.value;
  const session = await decrypt(cookie);

  if (isProtectedRoute && !session?.email) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isPublicRoute && session?.email && path === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
};

export default proxy;

// Skip the API layer (its own Route Handlers guard themselves via
// verifySession()) and Next.js's static asset routes.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
