"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Mail, ShieldCheck, UserPlus, Users } from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { useAuth } from "@/components/use-auth";

const navItems = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    superuserOnly: false,
  },
  {
    href: "/dashboard/users",
    label: "User directory",
    icon: Users,
    superuserOnly: false,
  },
  {
    href: "/dashboard/users/normal",
    label: "Create user",
    icon: UserPlus,
    superuserOnly: false,
  },
  {
    href: "/dashboard/users/elevated",
    label: "Create admin",
    icon: ShieldCheck,
    superuserOnly: true,
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth("admin");

  if (loading || !user) {
    return (
      <main className="app-bg flex min-h-screen items-center justify-center text-zinc-200">
        <div className="h-10 w-10 animate-spin rounded-full border border-zinc-700 border-t-emerald-300" />
      </main>
    );
  }

  return (
    <main className="app-bg min-h-screen text-zinc-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-[#0b1017]/95 backdrop-blur lg:w-72 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 lg:block lg:px-6 lg:py-6">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Mailread</p>
                <h1 className="mt-0.5 text-lg font-semibold text-white">Admin Console</h1>
              </div>
            </div>
            <div className="lg:hidden">
              <LogoutButton />
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-4 lg:block lg:space-y-1.5 lg:px-4 lg:pb-4">
            {navItems
              .filter((item) => !item.superuserOnly || user.is_superuser)
              .map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/dashboard"
                    ? pathname === item.href
                    : item.href === "/dashboard/users"
                      ? pathname === item.href
                      : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex h-11 min-w-0 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition sm:gap-3 sm:px-3 lg:flex ${
                      active
                        ? "border border-emerald-300/15 bg-emerald-300/10 text-emerald-50 shadow-sm"
                        : "border border-transparent text-zinc-400 hover:border-white/8 hover:bg-white/5 hover:text-zinc-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
          </nav>

          <div className="hidden px-6 py-6 lg:block">
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Session</p>
              <p className="mt-1 truncate text-sm text-zinc-200">{user.email}</p>
              <p className="mt-1 text-xs text-emerald-300/80">
                {user.is_superuser ? "Superuser" : "Staff"}
              </p>
              <div className="mt-4">
                <LogoutButton />
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="hidden items-center justify-between border-b border-white/10 bg-[#090d13]/55 px-4 py-3 backdrop-blur sm:flex sm:px-5 sm:py-4 lg:px-8">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Administrative access</p>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-300">
                {user.is_superuser
                  ? "You can request and approve elevated accounts."
                  : "You can create standard users."}
              </p>
            </div>
            <Link
              href="/mail"
              className="hidden h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white sm:inline-flex"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Mail
            </Link>
          </header>
          <div className="flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
