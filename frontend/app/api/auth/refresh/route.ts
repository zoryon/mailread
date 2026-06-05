import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { REFRESH_COOKIE } from "@/lib/jwt";
import { applyAuthCookies, clearAuthCookies, refreshFromBackend } from "@/lib/server-auth";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    const response = NextResponse.json({ detail: "No refresh token." }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const refreshed = await refreshFromBackend(refreshToken);
  if (!refreshed) {
    const response = NextResponse.json({ detail: "Session expired." }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({ user: refreshed.user });
  applyAuthCookies(response, refreshed);
  return response;
}
