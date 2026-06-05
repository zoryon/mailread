import Link from "next/link";
import { ArrowRight, ShieldCheck, UserPlus, Users, Workflow } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:gap-5 sm:pb-7 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Control center</p>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Overview</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          Create standard users immediately. Staff and superuser accounts require one-time email approval.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/dashboard/users"
          className="panel-flat group rounded-md p-4 transition hover:border-violet-300/30 hover:bg-[#111923] sm:p-5"
        >
          <div className="flex items-center justify-between">
            <Users className="h-5 w-5 text-violet-300" aria-hidden="true" />
            <ArrowRight className="h-4 w-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-violet-200" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-white">User directory</h3>
          <p className="mt-2 hidden text-sm leading-6 text-zinc-500 sm:block">Role-based visibility and management.</p>
        </Link>

        <Link
          href="/dashboard/users/normal"
          className="panel-flat group rounded-md p-4 transition hover:border-emerald-300/30 hover:bg-[#111923] sm:p-5"
        >
          <div className="flex items-center justify-between">
            <UserPlus className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            <ArrowRight className="h-4 w-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-emerald-200" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-white">Create user</h3>
          <p className="mt-2 hidden text-sm leading-6 text-zinc-500 sm:block">Immediate creation with email and password.</p>
        </Link>

        <Link
          href="/dashboard/users/elevated"
          className="panel-flat group rounded-md p-4 transition hover:border-cyan-300/30 hover:bg-[#111923] sm:p-5"
        >
          <div className="flex items-center justify-between">
            <ShieldCheck className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            <ArrowRight className="h-4 w-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-white">Create admin</h3>
          <p className="mt-2 hidden text-sm leading-6 text-zinc-500 sm:block">Protected request with email confirmation.</p>
        </Link>

        <div className="panel-flat rounded-md p-4 sm:p-5">
          <Workflow className="h-5 w-5 text-rose-300" aria-hidden="true" />
          <h3 className="mt-4 text-base font-semibold text-white">Token rotation</h3>
          <p className="mt-2 hidden text-sm leading-6 text-zinc-500 sm:block">Short-lived access token, rotated refresh token, and HttpOnly cookies.</p>
        </div>
      </div>
    </div>
  );
}
