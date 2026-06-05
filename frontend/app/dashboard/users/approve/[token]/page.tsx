"use client";

import { useParams } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { FormMessage } from "@/components/form-message";
import { useAuth } from "@/components/use-auth";

function formatError(payload: unknown) {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.detail === "string") {
      return record.detail;
    }

    return Object.entries(record)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
      .join(" ");
  }

  return "Confirmation failed.";
}

export default function ApproveElevatedUserPage() {
  const params = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth("superuser");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function confirm() {
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/admin/users/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage({ kind: "error", text: formatError(data) });
      return;
    }

    setMessage({
      kind: "success",
      text: `Account confirmed: ${data.email}`,
    });
  }

  if (authLoading || !user) {
    return <div className="h-10 w-10 animate-spin rounded-full border border-zinc-700 border-t-emerald-300" />;
  }

  return (
    <div className="max-w-3xl">
      <div>
        <h2 className="text-3xl font-semibold text-white">Confirm elevated account</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          This action uses the token received by email and requires an active superuser session.
        </p>
      </div>

      <div className="mt-8 rounded-md border border-white/10 bg-[#0f141c] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-cyan-300/10 text-cyan-200">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">Final approval</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              After confirmation, the token is consumed and cannot be reused.
            </p>
          </div>
        </div>

        {message ? (
          <div className="mt-5">
            <FormMessage kind={message.kind}>{message.text}</FormMessage>
          </div>
        ) : null}

        <button
          type="button"
          onClick={confirm}
          disabled={loading || message?.kind === "success"}
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#061019] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <CheckCircle2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          )}
          {loading ? "Confirming..." : "Confirm creation"}
        </button>
      </div>
    </div>
  );
}
