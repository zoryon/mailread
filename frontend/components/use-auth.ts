"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { isAdmin } from "@/lib/jwt";
import type { AuthUser } from "@/lib/jwt";

type RequiredRole = "admin" | "normal" | "superuser";

export function useAuth(requiredRole?: RequiredRole) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setUser(null);
        setLoading(false);
        router.replace("/login");
        return;
      }

      const currentUser = (await response.json()) as AuthUser;
      if (cancelled) {
        return;
      }

      setUser(currentUser);
      setLoading(false);

      if (requiredRole === "admin" && !isAdmin(currentUser)) {
        router.replace("/mail");
      }

      if (requiredRole === "normal" && isAdmin(currentUser)) {
        router.replace("/dashboard");
      }

      if (requiredRole === "superuser" && !currentUser.is_superuser) {
        router.replace("/dashboard");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey, requiredRole, router]);

  return { user, loading, reload };
}
