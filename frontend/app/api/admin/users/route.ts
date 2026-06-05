import { proxyAuthorized } from "@/lib/server-auth";

export async function GET() {
  return proxyAuthorized("/api/admin/users/");
}
