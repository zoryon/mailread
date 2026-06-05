import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  USER_COOKIE,
  encodeUserHint,
  isTokenFresh,
  userFromToken,
} from "@/lib/jwt";
import type { AuthUser } from "@/lib/jwt";

const BACKEND_URL =
  process.env.FRONTEND_SERVER_DJANGO_API_URL ??
  process.env.DJANGO_API_URL ??
  "http://127.0.0.1:8000";
const ACCESS_MAX_AGE = Number(
  process.env.FRONTEND_SERVER_JWT_ACCESS_SECONDS ?? process.env.JWT_ACCESS_SECONDS ?? 10 * 60,
);
const REFRESH_MAX_AGE = Number(
  process.env.FRONTEND_SERVER_JWT_REFRESH_SECONDS ?? process.env.JWT_REFRESH_SECONDS ?? 7 * 24 * 60 * 60,
);

type TokenRefresh = {
  access: string;
  refresh?: string;
  user: AuthUser | null;
};

type AccessState = {
  accessToken: string | null;
  refreshed?: TokenRefresh;
  clearCookies?: boolean;
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function applyAuthCookies(response: NextResponse, tokens: TokenRefresh) {
  response.cookies.set(ACCESS_COOKIE, tokens.access, {
    ...cookieOptions,
    maxAge: ACCESS_MAX_AGE,
  });

  if (tokens.refresh) {
    response.cookies.set(REFRESH_COOKIE, tokens.refresh, {
      ...cookieOptions,
      maxAge: REFRESH_MAX_AGE,
    });
  }

  const user = tokens.user ?? userFromToken(tokens.access);
  if (user) {
    response.cookies.set(USER_COOKIE, encodeUserHint(user), {
      ...cookieOptions,
      maxAge: REFRESH_MAX_AGE,
    });
  }
}

export function clearAuthCookies(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE]) {
    response.cookies.set(name, "", {
      ...cookieOptions,
      maxAge: 0,
    });
  }
}

export async function refreshFromBackend(refreshToken: string): Promise<TokenRefresh | null> {
  const upstream = await fetch(`${BACKEND_URL}/api/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
    cache: "no-store",
  });

  if (!upstream.ok) {
    return null;
  }

  const data = (await upstream.json()) as { access: string; refresh?: string };
  return {
    access: data.access,
    refresh: data.refresh,
    user: userFromToken(data.access),
  };
}

export async function getAccessState(forceRefresh = false): Promise<AccessState> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!forceRefresh && isTokenFresh(accessToken)) {
    return { accessToken: accessToken ?? null };
  }

  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return { accessToken: null, clearCookies: true };
  }

  const refreshed = await refreshFromBackend(refreshToken);
  if (!refreshed) {
    return { accessToken: null, clearCookies: true };
  }

  return {
    accessToken: refreshed.access,
    refreshed,
  };
}

async function readUpstreamJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

async function callBackend(path: string, accessToken: string, init: RequestInit) {
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
}

export async function proxyAuthorized(path: string, init: RequestInit = {}) {
  let auth = await getAccessState();

  if (!auth.accessToken) {
    const response = NextResponse.json({ detail: "Authentication required." }, { status: 401 });
    if (auth.clearCookies) {
      clearAuthCookies(response);
    }
    return response;
  }

  let upstream = await callBackend(path, auth.accessToken, init);

  if (upstream.status === 401) {
    auth = await getAccessState(true);
    if (auth.accessToken) {
      upstream = await callBackend(path, auth.accessToken, init);
    }
  }

  const response =
    upstream.status === 204
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json(await readUpstreamJson(upstream), { status: upstream.status });

  if (auth.refreshed) {
    applyAuthCookies(response, auth.refreshed);
  }

  if (upstream.status === 401) {
    clearAuthCookies(response);
  }

  return response;
}

export { BACKEND_URL };
