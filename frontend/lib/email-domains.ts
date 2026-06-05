const DEFAULT_DOMAINS = ["zoryo.uk", "gmail.com"];

export function configuredEmailDomains() {
  const configured = (
    process.env.NEXT_PUBLIC_FRONTEND_EMAIL_DOMAINS ??
    process.env.NEXT_PUBLIC_EMAIL_DOMAINS
  )?.split(",")
    .map((domain) => domain.trim().replace(/^@/, ""))
    .filter(Boolean);

  return configured?.length ? configured : DEFAULT_DOMAINS;
}

export function splitEmailAddress(email: string, domains = configuredEmailDomains()) {
  const [localPart = "", domain = domains[0]] = email.split("@");

  return {
    localPart,
    domain: domain || domains[0],
  };
}

export function joinEmailAddress(localPart: string, domain: string) {
  return `${localPart.trim()}@${domain.replace(/^@/, "")}`;
}
