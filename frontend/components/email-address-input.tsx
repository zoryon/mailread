"use client";

import { AtSign, Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
  configuredEmailDomains,
  joinEmailAddress,
  splitEmailAddress,
} from "@/lib/email-domains";

type EmailAddressInputProps = {
  label: string;
  value: string;
  onChange: (email: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  focusColor?: "emerald" | "cyan";
};

export function EmailAddressInput({
  label,
  value,
  onChange,
  placeholder = "name",
  autoComplete = "email",
  required = true,
  focusColor = "emerald",
}: EmailAddressInputProps) {
  const inputId = useId();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const configuredDomains = configuredEmailDomains();
  const { localPart, domain } = splitEmailAddress(value, configuredDomains);
  const domains = configuredDomains.includes(domain)
    ? configuredDomains
    : [domain, ...configuredDomains];
  const focusClasses =
    focusColor === "cyan"
      ? "focus-within:border-cyan-300/70 focus-within:ring-cyan-300/15"
      : "focus-within:border-emerald-300/70 focus-within:ring-emerald-300/15";

  function updateLocalPart(inputValue: string) {
    if (inputValue.includes("@")) {
      const pastedEmail = splitEmailAddress(inputValue, domains);
      onChange(joinEmailAddress(pastedEmail.localPart, pastedEmail.domain));
      return;
    }

    onChange(joinEmailAddress(inputValue, domain));
  }

  function updateDomain(nextDomain: string) {
    onChange(joinEmailAddress(localPart, nextDomain));
    setOpen(false);
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="block min-w-0">
      <label htmlFor={inputId} className="text-sm font-medium text-zinc-300">
        {label}
      </label>
      <div
        className={`relative mt-2 flex h-12 items-center rounded-md border border-white/10 bg-[#080c12] ring-2 ring-transparent transition ${focusClasses}`}
      >
        <AtSign className="ml-3 h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
        <input
          id={inputId}
          type="text"
          inputMode="email"
          autoComplete={autoComplete}
          required={required}
          value={localPart}
          onChange={(event) => updateLocalPart(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-zinc-600"
          placeholder={placeholder}
        />
        <div ref={dropdownRef} className="relative mr-1 shrink-0">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 min-w-24 items-center justify-between gap-1.5 rounded-md border border-white/10 bg-[#111923] px-2 text-sm text-zinc-200 outline-none transition hover:border-white/20 hover:bg-[#16202b] focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/15 sm:min-w-28 sm:gap-2 sm:px-2.5"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Email domain"
          >
            <span className="truncate">@{domain}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {open ? (
            <div
              role="listbox"
              className="absolute right-0 top-11 z-50 w-40 overflow-hidden rounded-md border border-white/10 bg-[#111923] py-1 shadow-2xl shadow-black/50"
            >
              {domains.map((domainOption) => {
                const selected = domainOption === domain;

                return (
                  <button
                    key={domainOption}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => updateDomain(domainOption)}
                    className={`flex h-10 w-full items-center justify-between gap-2 px-3 text-left text-sm transition ${
                      selected
                        ? "bg-emerald-300/10 text-emerald-100"
                        : "text-zinc-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="truncate">@{domainOption}</span>
                    {selected ? <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
