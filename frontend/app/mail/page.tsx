"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Inbox, LoaderCircle, MailOpen, RefreshCw, Search } from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { useAuth } from "@/components/use-auth";

type MailMessage = {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string | null;
  preview: string;
  body: string | null;
  unread: boolean;
  truncated: boolean;
};

type MailResponse = {
  messages: MailMessage[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  latest_uid: string | null;
  poll_seconds: number;
  detail?: string;
};

type MailStatus = {
  total: number;
  latest_uid: string | null;
};

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function MailPage() {
  const { user, loading } = useAuth("normal");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [mailLoading, setMailLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [latestUid, setLatestUid] = useState<string | null>(null);
  const [pollIntervalMs, setPollIntervalMs] = useState(30_000);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bodyLoadingId, setBodyLoadingId] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    async function loadMail() {
      const append = page > 1;
      setError("");
      if (append) {
        setLoadingMore(true);
      } else {
        setMailLoading(true);
      }

      try {
        const refresh = reloadKey > 0 && page === 1 ? "&refresh=1" : "";
        const response = await fetch(`/api/mail?page=${page}${refresh}`, { cache: "no-store" });
        const data = (await response.json()) as MailResponse;
        if (!response.ok) {
          throw new Error(data.detail || "Impossibile caricare la posta.");
        }
        if (cancelled) {
          return;
        }

        setMessages((current) => (append ? [...current, ...data.messages] : data.messages));
        setHasMore(data.has_more);
        setTotal(data.total);
        if (!append) {
          setLatestUid(data.latest_uid);
          setPollIntervalMs(Math.max(data.poll_seconds, 10) * 1000);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Impossibile caricare la posta.");
        }
      } finally {
        if (!cancelled) {
          setMailLoading(false);
          setLoadingMore(false);
        }
      }
    }

    void loadMail();
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey, user]);

  useEffect(() => {
    if (!user || mailLoading) {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/mail/status", { cache: "no-store" });
        if (!response.ok || cancelled) {
          return;
        }

        const status = (await response.json()) as MailStatus;
        const mailboxChanged =
          status.latest_uid !== latestUid || status.total !== total;
        if (!cancelled && mailboxChanged) {
          setMessages([]);
          setPage(1);
          setExpandedId(null);
          setBodyError("");
          setReloadKey((value) => value + 1);
        }
      } catch {
        // Polling failures must not replace mail that is already visible.
      }
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [latestUid, mailLoading, pollIntervalMs, total, user]);

  const visibleMessages = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("it");
    if (!normalizedQuery) {
      return messages;
    }

    return messages.filter((message) =>
      [message.from, message.to, message.subject, message.body ?? ""]
        .join(" ")
        .toLocaleLowerCase("it")
        .includes(normalizedQuery),
    );
  }, [messages, query]);

  function refresh() {
    setMessages([]);
    setPage(1);
    setExpandedId(null);
    setBodyError("");
    setReloadKey((value) => value + 1);
  }

  async function toggleMessage(message: MailMessage) {
    if (expandedId === message.id) {
      setExpandedId(null);
      setBodyError("");
      return;
    }

    setExpandedId(message.id);
    setBodyError("");
    if (message.body !== null) {
      return;
    }

    setBodyLoadingId(message.id);
    try {
      const response = await fetch(`/api/mail/${encodeURIComponent(message.id)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as MailMessage & { detail?: string };
      if (!response.ok) {
        throw new Error(data.detail || "Impossibile caricare il messaggio.");
      }

      setMessages((current) =>
        current.map((item) => (item.id === message.id ? data : item)),
      );
    } catch (reason) {
      setBodyError(
        reason instanceof Error ? reason.message : "Impossibile caricare il messaggio.",
      );
    } finally {
      setBodyLoadingId(null);
    }
  }

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
              Messaggi ricevuti dall&apos;alias {user.email}.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex h-11 items-center rounded-md border border-white/10 bg-[#0c1118] px-3 md:w-80">
              <Search className="h-4 w-4 text-zinc-500" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent px-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
                placeholder="Cerca nei messaggi caricati"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={mailLoading}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-[#0c1118] text-zinc-400 transition hover:text-white disabled:opacity-50"
              aria-label="Aggiorna posta"
            >
              <RefreshCw className={`h-4 w-4 ${mailLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="panel-flat rounded-md p-3">
            <button className="flex h-11 w-full items-center gap-3 rounded-md bg-emerald-400/10 px-3 text-sm font-medium text-emerald-100">
              <Inbox className="h-4 w-4" aria-hidden="true" />
              Posta in arrivo
              <span className="ml-auto text-xs text-emerald-300/70">{total}</span>
            </button>
          </aside>

          <div className="panel-flat overflow-hidden rounded-md">
            {mailLoading ? (
              <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-zinc-500">
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                Caricamento posta...
              </div>
            ) : error ? (
              <div className="p-6 text-sm text-red-300">
                <p>{error}</p>
                <button type="button" onClick={refresh} className="mt-3 font-semibold text-white hover:underline">
                  Riprova
                </button>
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                {query ? "Nessun messaggio corrisponde alla ricerca." : "Nessun messaggio ricevuto da questo alias."}
              </div>
            ) : (
              visibleMessages.map((message) => {
                const expanded = expandedId === message.id;
                return (
                  <article key={message.id} className="border-b border-white/10 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => void toggleMessage(message)}
                      className="grid w-full gap-2 px-4 py-4 text-left transition hover:bg-white/[0.025] sm:grid-cols-[220px_1fr_150px_20px]"
                    >
                      <div className={`flex items-center gap-3 text-sm ${message.unread ? "font-semibold text-white" : "text-zinc-300"}`}>
                        <MailOpen className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                        <span className="truncate">{message.from || "Mittente sconosciuto"}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className={`truncate text-sm ${message.unread ? "font-semibold text-white" : "font-medium text-zinc-200"}`}>
                          {message.subject}
                        </h3>
                        <p className="mt-1 truncate text-sm text-zinc-500">{message.preview || "Nessuna anteprima"}</p>
                      </div>
                      <p className="text-sm text-zinc-500 sm:text-right">{formatDate(message.date)}</p>
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                      )}
                    </button>
                    {expanded ? (
                      <div className="border-t border-white/5 bg-black/10 px-5 py-5">
                        <p className="text-xs text-zinc-500">A: {message.to || user.email}</p>
                        {bodyLoadingId === message.id ? (
                          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Caricamento contenuto...
                          </div>
                        ) : bodyError ? (
                          <p className="mt-4 text-sm text-red-300">{bodyError}</p>
                        ) : (
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                            {message.body || "Questo messaggio non contiene testo visualizzabile."}
                          </p>
                        )}
                        {!bodyLoadingId && !bodyError && message.truncated ? (
                          <p className="mt-4 text-xs text-amber-300/80">
                            Contenuto abbreviato perche il messaggio o i suoi allegati sono molto grandi.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
            {!mailLoading && !error && hasMore && !query ? (
              <button
                type="button"
                onClick={() => setPage((value) => value + 1)}
                disabled={loadingMore}
                className="flex h-12 w-full items-center justify-center gap-2 border-t border-white/10 text-sm font-semibold text-emerald-200 transition hover:bg-white/[0.025] disabled:opacity-50"
              >
                {loadingMore ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {loadingMore ? "Caricamento..." : "Carica altre"}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
