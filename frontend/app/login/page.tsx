"use client";

import { Eye, EyeOff, KeyRound, LogIn, RotateCcw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { EmailAddressInput } from "@/components/email-address-input";
import { FormMessage } from "@/components/form-message";
import { rolePath } from "@/lib/jwt";

type LoginPayload = {
  redirectTo: string;
  user: {
    email: string;
    is_staff: boolean;
    is_superuser: boolean;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkSession() {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (response.ok) {
        const user = await response.json();
        router.replace(rolePath(user));
        return;
      }
      setCheckingSession(false);
    }

    void checkSession();
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.detail ?? "Invalid credentials.");
      setLoading(false);
      return;
    }

    const login = data as LoginPayload;
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") ? next : login.redirectTo);
  }

  if (checkingSession) {
    return (
      <main className="app-bg flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border border-zinc-700 border-t-emerald-300" />
      </main>
    );
  }

  return (
    <main className="app-bg min-h-screen text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-5 sm:px-5 sm:py-8 lg:px-8">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[1fr_430px] lg:items-center">
          <div className="order-2 min-w-0 max-w-2xl lg:order-1">
            <div className="hidden h-12 w-12 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-300/10 text-emerald-200 shadow-lg shadow-emerald-950/20 sm:inline-flex">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300 sm:mt-6">
              Secure Operations
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-5xl">
              Mailread
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-400">
              One login for users, staff, and superusers. Role controls where each session lands.
            </p>
            <div className="mt-8 hidden max-w-xl gap-3 sm:grid sm:grid-cols-2">
              <div className="panel-flat rounded-md p-4">
                <KeyRound className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-zinc-100">HttpOnly sessions</p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">Tokens stay server-side and away from browser storage.</p>
              </div>
              <div className="panel-flat rounded-md p-4">
                <RotateCcw className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-zinc-100">Automatic rotation</p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">Short access windows with silent refresh handling.</p>
              </div>
            </div>
          </div>

          <form
            onSubmit={submit}
            className="panel order-1 w-full min-w-0 rounded-md p-5 sm:p-6 lg:order-2"
          >
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 lg:hidden">
                Mailread
              </p>
              <h2 className="text-2xl font-semibold text-white">Sign in</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Use your account email and password.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <EmailAddressInput
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="name"
                autoComplete="email"
              />

              <label className="block">
                <span className="text-sm font-medium text-zinc-300">Password</span>
                <div className="mt-2 flex h-12 items-center rounded-md border border-white/10 bg-[#080c12] focus-within:border-emerald-300/70 focus-within:ring-2 focus-within:ring-emerald-300/15">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-zinc-600"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="mr-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </label>
            </div>

            {error ? (
              <div className="mt-5">
                <FormMessage kind="error">{error}</FormMessage>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-300 px-4 text-sm font-semibold text-[#06110d] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
