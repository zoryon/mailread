"use client";

import { FormEvent, useState } from "react";
import { MailCheck, ShieldCheck } from "lucide-react";

import { EmailAddressInput } from "@/components/email-address-input";
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

  return "Operation failed.";
}

export default function ElevatedUsersPage() {
  const { user, loading: authLoading } = useAuth("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"staff" | "superuser">("staff");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(
    null,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/admin/users/elevated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        is_staff: true,
        is_superuser: role === "superuser",
      }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage({ kind: "error", text: formatError(data) });
      return;
    }

    setEmail("");
    setPassword("");
    setRole("staff");
    setMessage({
      kind: "success",
      text: `Request sent to ${data.sent_to}. Open the email and confirm with the button.`,
    });
  }

  if (authLoading || !user) {
    return <div className="h-10 w-10 animate-spin rounded-full border border-zinc-700 border-t-emerald-300" />;
  }

  if (!user.is_superuser) {
    return (
      <div className="max-w-3xl">
        <h2 className="text-3xl font-semibold text-white">Create admin</h2>
        <div className="mt-6">
          <FormMessage kind="info">
            Only a superuser can request staff or superuser accounts.
          </FormMessage>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="border-b border-white/10 pb-5 sm:pb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Elevated access</p>
        <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Create admin</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          This request creates a one-time email token. The user is created only after confirmation.
        </p>
      </div>

      <form onSubmit={submit} className="panel mt-5 rounded-md p-5 sm:mt-8 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <EmailAddressInput
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="admin"
            focusColor="cyan"
          />

          <label className="block">
            <span className="text-sm font-medium text-zinc-300">Initial password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-md border border-white/10 bg-[#080c12] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/15"
              placeholder="Temporary password"
            />
          </label>
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-zinc-300">Role</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {[
              { value: "staff", label: "Staff", description: "Can create standard users." },
              { value: "superuser", label: "Superuser", description: "Can approve elevated accounts." },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value as "staff" | "superuser")}
                className={`rounded-md border p-4 text-left transition ${
                  role === option.value
                    ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-50"
                    : "border-white/10 bg-[#080c12] text-zinc-300 hover:border-white/20 hover:bg-white/5"
                }`}
              >
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-sm text-zinc-500">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        {message ? (
          <div className="mt-5">
            <FormMessage kind={message.kind}>{message.text}</FormMessage>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#061019] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <MailCheck className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          )}
          {loading ? "Sending request..." : "Send confirmation email"}
        </button>
      </form>
    </div>
  );
}
