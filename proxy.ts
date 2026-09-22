/**
 * Route protection (Next.js middleware, run before any matching request
 * reaches a page). Redirects unauthenticated or wrong-role visitors away
 * from `/admin`, `/teacher`, `/student`, and bounces an already-logged-in
 * user away from `/login` to their own dashboard.
 *
 * CRITICAL, non-obvious fact: `config.matcher` below excludes `/api/*`
 * entirely — this file does NOT protect API routes. Every API route under
 * `app/api/**` must call `auth()` itself and check `role`/`status`, because
 * nothing upstream of it is checking that for them. If a new API route is
 * added without its own `auth()` check, it is unprotected.
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Admin section: must be signed in as ADMIN (no status check — admin
  // accounts don't go through the pending-approval flow teacher/student do).
  if (pathname.startsWith("/admin") && (!req.auth || req.auth.user?.role !== "ADMIN")) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Teacher section: must be TEACHER and ACTIVE — teacher accounts go
  // through admin approval first (PENDING/REJECTED are refused here too).
  if (
    pathname.startsWith("/teacher") &&
    (!req.auth || req.auth.user?.role !== "TEACHER" || req.auth.user?.status !== "ACTIVE")
  ) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Force a teacher who still has the auto-generated password (see
  // lib/services/teacherAccounts.ts) to change it before using anything
  // else — but exempt the change-password page itself, or this would loop.
  if (
    pathname.startsWith("/teacher") &&
    pathname !== "/teacher/change-password" &&
    req.auth?.user?.role === "TEACHER" &&
    req.auth.user?.mustChangePassword
  ) {
    return NextResponse.redirect(new URL("/teacher/change-password", req.nextUrl));
  }

  // Student section: same ACTIVE-only rule as teacher.
  if (
    pathname.startsWith("/student") &&
    (!req.auth || req.auth.user?.role !== "STUDENT" || req.auth.user?.status !== "ACTIVE")
  ) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Already-signed-in visitors hitting /login are sent straight to their
  // role's home page instead of seeing the login form again.
  if (pathname === "/login" && req.auth?.user?.role === "ADMIN") {
    return NextResponse.redirect(new URL("/admin/routine", req.nextUrl));
  }

  if (pathname === "/login" && req.auth?.user?.role === "TEACHER") {
    return NextResponse.redirect(new URL("/teacher/classes", req.nextUrl));
  }

  if (pathname === "/login" && req.auth?.user?.role === "STUDENT") {
    return NextResponse.redirect(new URL("/student/routine", req.nextUrl));
  }
});

// `matcher` is what actually determines which requests run this file at
// all — everything under `/api`, Next's static/image assets, and the
// favicon are excluded. See the file header: excluding `/api` means API
// routes are NOT protected by this middleware and must check auth themselves.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
