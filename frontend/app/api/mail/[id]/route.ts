import { NextRequest } from "next/server";

import { proxyAuthorized } from "@/lib/server-auth";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyAuthorized(`/api/mail/${encodeURIComponent(id)}/`);
}
