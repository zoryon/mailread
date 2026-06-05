export type AuthUser = {
  id?: number;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  exp?: number;
};

type JwtPayload = {
  user_id?: number;
  email?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  exp?: number;
};

export const ACCESS_COOKIE = "mailread_access";
export const REFRESH_COOKIE = "mailread_refresh";
export const USER_COOKIE = "mailread_user";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  return atob(padded);
}

export function decodeJwtPayload<T>(token?: string): T | null {
  if (!token) {
    return null;
  }

  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(payload)) as T;
  } catch {
    return null;
  }
}

export function userFromToken(token?: string): AuthUser | null {
  const payload = decodeJwtPayload<JwtPayload>(token);

  if (!payload?.email) {
    return null;
  }

  return {
    id: payload.user_id,
    email: payload.email,
    is_staff: Boolean(payload.is_staff),
    is_superuser: Boolean(payload.is_superuser),
    exp: payload.exp,
  };
}

export function isTokenFresh(token?: string, leewaySeconds = 30) {
  const payload = decodeJwtPayload<JwtPayload>(token);
  if (!payload?.exp) {
    return false;
  }

  return payload.exp > Math.floor(Date.now() / 1000) + leewaySeconds;
}

export function rolePath(user: Pick<AuthUser, "is_staff" | "is_superuser">) {
  return user.is_staff || user.is_superuser ? "/dashboard" : "/mail";
}

export function isAdmin(user?: Pick<AuthUser, "is_staff" | "is_superuser"> | null) {
  return Boolean(user?.is_staff || user?.is_superuser);
}

export function encodeUserHint(user: AuthUser) {
  return encodeURIComponent(
    JSON.stringify({
      id: user.id,
      email: user.email,
      is_staff: user.is_staff,
      is_superuser: user.is_superuser,
    }),
  );
}

export function decodeUserHint(value?: string): AuthUser | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(value)) as AuthUser;
  } catch {
    return null;
  }
}
