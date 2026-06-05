"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { EmailAddressInput } from "@/components/email-address-input";
import { FormMessage } from "@/components/form-message";
import { useAuth } from "@/components/use-auth";

type UserRole = "normal" | "staff" | "superuser";

type ManagedUser = {
  id: number;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  role: UserRole;
};

type EditState = {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  password: string;
};

const roleLabels: Record<UserRole, string> = {
  normal: "Standard",
  staff: "Staff",
  superuser: "Superuser",
};

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

function roleFromFlags(user: Pick<ManagedUser, "is_staff" | "is_superuser">): UserRole {
  if (user.is_superuser) {
    return "superuser";
  }
  if (user.is_staff) {
    return "staff";
  }
  return "normal";
}

function flagsFromRole(role: UserRole) {
  return {
    is_staff: role === "staff" || role === "superuser",
    is_superuser: role === "superuser",
  };
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function roleClass(role: UserRole) {
  if (role === "superuser") {
    return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  }
  if (role === "staff") {
    return "border-violet-300/25 bg-violet-300/10 text-violet-100";
  }
  return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
}

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth("admin");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [edit, setEdit] = useState<EditState | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(
    null,
  );

  const canManage = Boolean(user?.is_superuser);

  const fetchUsers = useCallback(async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage({ kind: "error", text: formatError(data) });
      return;
    }

    setUsers(data);
  }, []);

  function refreshUsers() {
    setLoading(true);
    setMessage(null);
    void fetchUsers();
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialUsers() {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await response.json();

      if (cancelled) {
        return;
      }

      setLoading(false);

      if (!response.ok) {
        setMessage({ kind: "error", text: formatError(data) });
        return;
      }

      setUsers(data);
    }

    if (!authLoading && user) {
      void loadInitialUsers();
    }

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const filteredUsers = useMemo(() => {
    return users.filter((managedUser) => {
      const matchesQuery = managedUser.email.toLowerCase().includes(query.toLowerCase());
      const matchesRole = roleFilter === "all" || managedUser.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [query, roleFilter, users]);

  function startEdit(managedUser: ManagedUser) {
    setMessage(null);
    setEdit({
      id: managedUser.id,
      email: managedUser.email,
      role: roleFromFlags(managedUser),
      is_active: managedUser.is_active,
      password: "",
    });
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit) {
      return;
    }

    setSaving(true);
    setMessage(null);

    const roleFlags = flagsFromRole(edit.role);
    const payload: Record<string, unknown> = {
      email: edit.email,
      is_active: edit.is_active,
      ...roleFlags,
    };

    if (edit.password) {
      payload.password = edit.password;
    }

    const response = await fetch(`/api/admin/users/${edit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage({ kind: "error", text: formatError(data) });
      return;
    }

    setUsers((current) => current.map((managedUser) => (managedUser.id === data.id ? data : managedUser)));
    setEdit(null);
    setMessage({ kind: "success", text: `User updated: ${data.email}` });
  }

  async function deleteUser(managedUser: ManagedUser) {
    const confirmed = window.confirm(`Permanently delete ${managedUser.email}?`);
    if (!confirmed) {
      return;
    }

    setMessage(null);
    const response = await fetch(`/api/admin/users/${managedUser.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      setMessage({ kind: "error", text: formatError(data) });
      return;
    }

    setUsers((current) => current.filter((userItem) => userItem.id !== managedUser.id));
    setMessage({ kind: "success", text: `User deleted: ${managedUser.email}` });
  }

  if (authLoading || !user) {
    return <div className="h-10 w-10 animate-spin rounded-full border border-zinc-700 border-t-emerald-300" />;
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:gap-5 sm:pb-7 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Identity management</p>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Users</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            {canManage
              ? "Full view of standard users, staff, and superusers."
              : "Limited view of standard users."}
          </p>
        </div>
        <button
          type="button"
          onClick={refreshUsers}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:mt-6 lg:grid-cols-[1fr_360px]">
        <div className="flex h-11 items-center rounded-md border border-white/10 bg-[#0c1118] px-3 shadow-sm">
          <Search className="h-4 w-4 text-zinc-500" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            placeholder="Search email"
          />
        </div>

        <div
          className={`grid gap-2 rounded-md border border-white/10 bg-[#0c1118] p-1 shadow-sm ${
            canManage ? "grid-cols-4" : "grid-cols-2"
          }`}
        >
          {(canManage
            ? [
                { value: "all", label: "All" },
                { value: "normal", label: "Standard" },
                { value: "staff", label: "Staff" },
                { value: "superuser", label: "Super" },
              ]
            : [
                { value: "all", label: "All" },
                { value: "normal", label: "Standard" },
              ]
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setRoleFilter(item.value as UserRole | "all")}
              className={`h-9 rounded-md text-xs font-medium transition ${
                roleFilter === item.value
                  ? "bg-emerald-300 text-[#06110d]"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {message ? (
        <div className="mt-5">
          <FormMessage kind={message.kind}>{message.text}</FormMessage>
        </div>
      ) : null}

      <div className="panel-flat mt-6 overflow-hidden rounded-md">
        <div className="hidden grid-cols-[minmax(240px,1fr)_140px_120px_130px_120px] border-b border-white/10 bg-white/[0.025] px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 lg:grid">
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span>Created</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border border-zinc-700 border-t-emerald-300" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-zinc-500">No users found.</div>
        ) : (
          filteredUsers.map((managedUser) => {
            const isSelf = managedUser.id === user.id;

            return (
              <div
                key={managedUser.id}
                className="grid gap-3 border-b border-white/10 px-4 py-4 transition last:border-b-0 hover:bg-white/[0.025] lg:grid-cols-[minmax(240px,1fr)_140px_120px_130px_120px] lg:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-400">
                    {managedUser.is_superuser ? (
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{managedUser.email}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Last login: {formatDate(managedUser.last_login)}
                    </p>
                  </div>
                </div>

                <div>
                  <span
                    className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${roleClass(
                      managedUser.role,
                    )}`}
                  >
                    {roleLabels[managedUser.role]}
                  </span>
                </div>

                <div>
                  <span
                    className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${
                      managedUser.is_active
                        ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                        : "border-red-300/25 bg-red-300/10 text-red-100"
                    }`}
                  >
                    {managedUser.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="text-sm text-zinc-500">{formatDate(managedUser.date_joined)}</p>

                <div className="flex gap-2 lg:justify-end">
                  {canManage && !isSelf ? (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(managedUser)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-zinc-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100"
                        aria-label={`Edit ${managedUser.email}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteUser(managedUser)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-zinc-300 transition hover:border-red-300/30 hover:bg-red-300/10 hover:text-red-100"
                        aria-label={`Delete ${managedUser.email}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-zinc-600">{isSelf ? "You" : "Read-only"}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {edit ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/75 px-4 py-4 backdrop-blur-sm sm:items-center sm:justify-center">
          <form
            onSubmit={saveEdit}
            className="panel w-full max-w-xl rounded-md p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Edit user</h3>
                <p className="mt-1 text-sm text-zinc-500">ID {edit.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/5 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <EmailAddressInput
                  label="Email"
                  value={edit.email}
                  onChange={(email) => setEdit({ ...edit, email })}
                  placeholder="user"
                  focusColor="cyan"
                />
              </div>

              <label className="block">
                <span className="text-sm font-medium text-zinc-300">Role</span>
                <select
                  value={edit.role}
                  onChange={(event) => setEdit({ ...edit, role: event.target.value as UserRole })}
                  className="mt-2 h-12 w-full rounded-md border border-white/10 bg-[#090b0f] px-3 text-sm text-white outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/15"
                >
                  <option value="normal">Standard</option>
                  <option value="staff">Staff</option>
                  <option value="superuser">Superuser</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-300">New password</span>
                <input
                  type="password"
                  minLength={8}
                  value={edit.password}
                  onChange={(event) => setEdit({ ...edit, password: event.target.value })}
                  className="mt-2 h-12 w-full rounded-md border border-white/10 bg-[#090b0f] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/15"
                  placeholder="Leave blank"
                />
              </label>
            </div>

            <label className="mt-5 flex items-center gap-3 rounded-md border border-white/10 bg-[#090b0f] px-3 py-3">
              <input
                type="checkbox"
                checked={edit.is_active}
                onChange={(event) => setEdit({ ...edit, is_active: event.target.checked })}
                className="h-4 w-4 rounded border-white/20 bg-[#090b0f] accent-emerald-300"
              />
              <span className="text-sm text-zinc-300">Account active</span>
            </label>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#061019] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} aria-hidden="true" />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
