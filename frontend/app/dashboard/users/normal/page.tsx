"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";

import { EmailAddressInput } from "@/components/email-address-input";
import { FormMessage } from "@/components/form-message";

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

  return "Operation failed.";
}

export default function NormalUsersPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/admin/users/normal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage({ kind: "error", text: formatError(data) });
      return;
    }

    setEmail("");
    setPassword("");
    setMessage({ kind: "success", text: `Standard user created: ${data.email}` });
  }

  return (
    <div className="max-w-3xl">
      <div className="border-b border-white/10 pb-5 sm:pb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Account provisioning</p>
        <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Create user</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Standard accounts are created immediately and can only access the mail workspace.
        </p>
      </div>

      <form onSubmit={submit} className="panel mt-5 rounded-md p-5 sm:mt-8 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <EmailAddressInput
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="user"
          />

          <label className="block">
            <span className="text-sm font-medium text-zinc-300">Initial password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-md border border-white/10 bg-[#080c12] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/15"
              placeholder="Temporary password"
            />
          </label>
        </div>

        {message ? (
          <div className="mt-5">
            <FormMessage kind={message.kind}>{message.text}</FormMessage>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-emerald-300 px-4 text-sm font-semibold text-[#06110d] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <CheckCircle2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden="true" />
          )}
          {loading ? "Creating..." : "Create user"}
        </button>
      </form>
    </div>
  );
}
