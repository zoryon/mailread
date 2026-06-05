"use client";

import { Inbox, MailOpen, Search } from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { useAuth } from "@/components/use-auth";

const messages = [
  {
    from: "system@mailread.local",
    subject: "Welcome to Mailread",
    preview: "Your mailbox is ready. Administrators manage account access.",
    time: "Now",
  },
  {
    from: "security@mailread.local",
    subject: "Protected session",
    preview: "Tokens rotate in the background and are not stored in the browser.",
    time: "Today",
  },
];

export default function MailPage() {
  const { user, loading } = useAuth("normal");

  if (loading || !user) {
    return (
      <main className="app-bg flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border border-zinc-700 border-t-emerald-300" />
      </main>
    );
  }

  return (
    <main className="app-bg min-h-screen text-zinc-100">
      <header className="border-b border-white/10 bg-[#0b1017]/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-300">Mailread</p>
            <h1 className="mt-1 text-xl font-semibold text-white">Mail</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden max-w-64 truncate text-sm text-zinc-400 sm:block">{user.email}</p>
            <LogoutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Workspace</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Inbox</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Standard user workspace.
            </p>
          </div>
          <div className="flex h-11 items-center rounded-md border border-white/10 bg-[#0c1118] px-3 md:w-80">
            <Search className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <input
              className="min-w-0 flex-1 bg-transparent px-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
              placeholder="Search messages"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="panel-flat rounded-md p-3">
            <button className="flex h-11 w-full items-center gap-3 rounded-md bg-emerald-400/10 px-3 text-sm font-medium text-emerald-100">
              <Inbox className="h-4 w-4" aria-hidden="true" />
              Inbox
            </button>
          </aside>

          <div className="panel-flat overflow-hidden rounded-md">
            {messages.map((message) => (
              <article
                key={message.subject}
                className="grid gap-2 border-b border-white/10 px-4 py-4 last:border-b-0 sm:grid-cols-[220px_1fr_64px]"
              >
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <MailOpen className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  <span className="truncate">{message.from}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-white">{message.subject}</h3>
                  <p className="mt-1 truncate text-sm text-zinc-500">{message.preview}</p>
                </div>
                <p className="text-sm text-zinc-500 sm:text-right">{message.time}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
