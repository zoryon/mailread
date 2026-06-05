"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      aria-label="Sign out"
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 text-sm font-medium text-zinc-300 transition hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{loading ? "Signing out..." : "Sign out"}</span>
    </button>
  );
}
