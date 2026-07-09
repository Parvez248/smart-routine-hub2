import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname === "/login" && req.auth?.user?.role === "ADMIN") {
    return NextResponse.redirect(new URL("/admin/routine", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
