import { NextResponse } from "next/server";

import { BACKEND_URL, applyAuthCookies } from "@/lib/server-auth";
import { rolePath, userFromToken } from "@/lib/jwt";

type LoginResponse = {
  access: string;
  refresh: string;
  user: {
    id?: number;
    email: string;
    is_staff: boolean;
    is_superuser: boolean;
  };
};

export async function POST(request: Request) {
  const body = await request.json();

  const upstream = await fetch(`${BACKEND_URL}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
    }),
    cache: "no-store",
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const login = data as LoginResponse;
  const user = login.user ?? userFromToken(login.access);
  const response = NextResponse.json({
    user,
    redirectTo: rolePath(user),
  });

  applyAuthCookies(response, {
    access: login.access,
    refresh: login.refresh,
    user,
  });

  return response;
}
