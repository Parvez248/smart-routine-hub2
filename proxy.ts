import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && (!req.auth || req.auth.user?.role !== "ADMIN")) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (
    pathname.startsWith("/teacher") &&
    (!req.auth || req.auth.user?.role !== "TEACHER" || req.auth.user?.status !== "ACTIVE")
  ) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (
    pathname.startsWith("/teacher") &&
    pathname !== "/teacher/change-password" &&
    req.auth?.user?.role === "TEACHER" &&
    req.auth.user?.mustChangePassword
  ) {
    return NextResponse.redirect(new URL("/teacher/change-password", req.nextUrl));
  }

  if (
    pathname.startsWith("/student") &&
    (!req.auth || req.auth.user?.role !== "STUDENT" || req.auth.user?.status !== "ACTIVE")
  ) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

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

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
