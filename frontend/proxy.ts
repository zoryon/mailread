import { NextRequest, NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  USER_COOKIE,
  decodeUserHint,
  isAdmin,
  rolePath,
  userFromToken,
} from "@/lib/jwt";

const PUBLIC_FILE = /\.(.*)$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const userHint = request.cookies.get(USER_COOKIE)?.value;
  const user = userFromToken(accessToken) ?? decodeUserHint(userHint);
  const isAuthenticated = Boolean(user || refreshToken);

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = user ? rolePath(user) : "/login";
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = rolePath(user);
    return NextResponse.redirect(url);
  }

  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/mail")) && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/dashboard") && user && !isAdmin(user)) {
    const url = request.nextUrl.clone();
    url.pathname = "/mail";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/mail") && user && isAdmin(user)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
