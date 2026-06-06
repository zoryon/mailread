import { NextRequest } from "next/server";

import { proxyAuthorized } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get("page") ?? "1";
  const refresh = request.nextUrl.searchParams.get("refresh") === "1" ? "&refresh=1" : "";
  return proxyAuthorized(`/api/mail/?page=${encodeURIComponent(page)}${refresh}`);
}
