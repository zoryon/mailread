import { proxyAuthorized } from "@/lib/server-auth";

export async function POST(request: Request) {
  const body = await request.json();

  return proxyAuthorized("/api/admin/users/elevated/confirm/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
